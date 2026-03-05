import child_process from "child_process";

const queue = require("promise-queue");
const http = require("http");
const os = require("os");
const fs = require("fs-extra");
const path = require("upath");
const crypto = require("crypto");
const portscanner = require("portscanner");

export class WalletRPC {
  constructor(backend) {
    this.backend = backend;
    this.data_dir = null;
    this.wallet_dir = null;
    this.auth = [];
    this.id = 0;
    this.net_type = "legacy";
    this.heartbeat = null;
    this.onsHeartbeat = null;
    this.syncPoller = null; // Fast poller for initial sync progress
    this.isRefreshing = false; // Track if wallet is actively refreshing
    this.wallet_state = {
      open: false,
      name: "",
      password_hash: null,
      password: null,
      balance: null,
      unlocked_balance: null,
      accrued_balance: null,
      accrued_balance_next_payout: null,
      onsRecords: [],
      password_salt: null // Store salt for remote wallets
    };
    this.isRPCSyncing = false;
    this.dirs = null;
    this.last_height_send_time = Date.now();
    this.heartbeatCount = 0;

    // save a pending tx here, so we don't have to send the
    // whole thing to the renderer
    this.pending_tx = null;

    // A mapping of name => type
    this.purchasedNames = {};

    this.height_regexes = [
      {
        string: /Processed block: <([a-f0-9]+)>, height (\d+)/,
        height: match => match[2]
      },
      {
        string: /Skipped block by height: (\d+)/,
        height: match => match[1]
      },
      {
        string: /Skipped block by timestamp, height: (\d+)/,
        height: match => match[1]
      },
      {
        string: /Blockchain sync progress: <([a-f0-9]+)>, height (\d+)/,
        height: match => match[2]
      }
    ];

    this.agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    this.queue = new queue(1, Infinity);
  }

  // Get the correct binary path based on network type
  getBinaryPath(net_type = null) {
    const netType = net_type || this.net_type;
    // Use legacy binaries for legacy network
    if (netType === "legacy") {
      return __ryo_bin_legacy;
    }
    return __ryo_bin;
  }

  // Get the atomic unit divisor based on network type
  // Legacy network uses 1e4 (4 decimal places), new mainnet/testnet use 1e9
  getAtomicDivisor() {
    return this.net_type === "legacy" ? 1e4 : 1e9;
  }

  // this function will take an options object for testnet, data-dir, etc
  start(options) {
    const { net_type } = options.app;
    const daemon = options.daemons[net_type];
    const wallet = options.wallet;

    // Check if wallet RPC is remote
    if (wallet.type === "remote") {
      this.local = false;
      this.protocol = "http://";
      this.hostname = wallet.remote_host;
      this.port = wallet.remote_port;
      // No authentication for remote wallet RPC (assumes --disable-rpc-login)
      this.auth = [null, null, null];
      this.disable_rpc_login = wallet.disable_rpc_login || false;

      // Set wallet directory paths for remote wallet (still need to read local files for listing)
      const { net_type, wallet_data_dir, data_dir } = options.app;
      this.net_type = net_type;
      this.data_dir = data_dir;
      this.wallet_data_dir = wallet_data_dir;

      this.dirs = {
        mainnet: path.join(this.wallet_data_dir, "mainnet"),
        stagenet: path.join(this.wallet_data_dir, "stagenet"),
        testnet: path.join(this.wallet_data_dir, "testnet"),
        legacy: path.join(this.wallet_data_dir, "legacy")
      };

      // Use network-specific wallet directory (same as local wallet-rpc)
      this.wallet_dir = path.resolve(this.dirs[net_type]);

      // For Docker setups, if wallet_data_dir doesn't exist, try common locations
      if (!this.local && !fs.existsSync(this.wallet_dir)) {
        // Try ./wallets (common Docker location)
        const cwdWallets = path.join(process.cwd(), "wallets");
        if (fs.existsSync(cwdWallets)) {
          this.wallet_dir = cwdWallets;
        } else {
          // Try wallets folder in user's home directory
          const homeWallets = path.join(os.homedir(), "wallets");
          if (fs.existsSync(homeWallets)) {
            this.wallet_dir = homeWallets;
          }
        }
      }

      return new Promise((resolve, reject) => {
        // Test connection to remote wallet RPC
        this.sendRPC("get_languages", {}, 5000)
          .then(data => {
            if (!data.hasOwnProperty("error")) {
              this.startHeartbeat();
              resolve();
            } else {
              reject(new Error("Could not connect to remote wallet RPC"));
            }
          })
          .catch(error => {
            reject(
              new Error(
                `Could not connect to remote wallet RPC: ${error.message}`
              )
            );
          });
      });
    }

    return new Promise((resolve, reject) => {
      let daemon_address = `${daemon.rpc_bind_ip}:${daemon.rpc_bind_port}`;
      if (daemon.type == "remote") {
        daemon_address = `${daemon.remote_host}:${daemon.remote_port}`;
      }

      crypto.randomBytes(64 + 64 + 32, (err, buffer) => {
        if (err) throw err;

        let auth = buffer.toString("hex");

        this.auth = [
          auth.substr(0, 64), // rpc username
          auth.substr(64, 64), // rpc password
          auth.substr(128, 32) // password salt
        ];

        const args = [
          "--disable-rpc-login",
          "--rpc-bind-port",
          options.wallet.rpc_bind_port,
          "--daemon-address",
          daemon_address,
          "--rpc-bind-ip",
          "127.0.0.1",
          "--log-level",
          "1"  // Normal logging (0=warning, 1=info, 2=debug)
        ];

        const { net_type, wallet_data_dir, data_dir } = options.app;
        this.net_type = net_type;
        this.data_dir = data_dir;
        this.wallet_data_dir = wallet_data_dir;

        this.dirs = {
          mainnet: path.join(this.wallet_data_dir, "mainnet"),
          stagenet: path.join(this.wallet_data_dir, "stagenet"),
          testnet: path.join(this.wallet_data_dir, "testnet"),
          legacy: path.join(this.wallet_data_dir, "legacy")
        };

        // Use network-specific wallet directory
        // Mainnet wallets go in wallet_data_dir/mainnet
        // Testnet wallets go in wallet_data_dir/testnet
        // Legacy wallets go in wallet_data_dir/legacy
        this.wallet_dir = path.resolve(this.dirs[net_type]);
        args.push("--wallet-dir", this.wallet_dir);

        // Ensure wallet directory and logs subdirectory exist
        if (!fs.existsSync(this.wallet_dir)) {
          fs.mkdirpSync(this.wallet_dir);
        }
        const logs_dir = path.join(this.dirs[net_type], "logs");
        if (!fs.existsSync(logs_dir)) {
          fs.mkdirpSync(logs_dir);
        }

        const log_file = path.join(logs_dir, "wallet-rpc.log");
        args.push("--log-file", log_file);

        // Add network flags - legacy uses no flag (it's mainnet on the old chain)
        if (net_type === "testnet") {
          args.push("--testnet");
        } else if (net_type === "stagenet") {
          args.push("--stagenet");
        }
        // Note: legacy and mainnet don't need network flags

        if (fs.existsSync(log_file)) {
          fs.truncateSync(log_file, 0);
        }

        // Log the wallet directory for debugging
        console.log(`[WalletRPC] Wallet directory set to: ${this.wallet_dir}`);
        console.log(
          `[WalletRPC] Wallet directory exists: ${fs.existsSync(
            this.wallet_dir
          )}`
        );
        console.log(
          `[WalletRPC] Wallet directory is absolute: ${path.isAbsolute(
            this.wallet_dir
          )}`
        );

        // save this info for later RPC calls and process restarts
        this.protocol = "http://";
        this.hostname = "127.0.0.1";
        this.port = options.wallet.rpc_bind_port;
        this.rpcPath = null;
        this.rpcArgs = args;

        // Try .exe first on Windows, then without extension
        // Use correct binary path based on network type
        const binPath = this.getBinaryPath(net_type);
        let rpcPath;
        if (process.platform === "win32") {
          rpcPath = path.join(binPath, "xeq-wallet-rpc.exe");
          if (!fs.existsSync(rpcPath)) {
            rpcPath = path.join(binPath, "xeq-wallet-rpc");
          }
        } else {
          rpcPath = path.join(binPath, "xeq-wallet-rpc");
        }

        this.backend.sendLog("info", `Looking for wallet-rpc at: ${rpcPath}`);
        this.backend.sendLog(
          "info",
          `Binary directory: ${binPath}`
        );

        if (!fs.existsSync(rpcPath)) {
          this.backend.sendLog("error", `wallet-rpc NOT FOUND at: ${rpcPath}`);
          reject(
            new Error(
              "Failed to find Equilibria Wallet RPC. Please make sure your anti-virus has not removed it."
            )
          );
          return;
        }
        this.backend.sendLog("info", `wallet-rpc found at: ${rpcPath}`);

        this.rpcPath = rpcPath;
        this.backend.sendLog(
          "info",
          `Starting wallet RPC (daemon: ${daemon_address})`
        );
        this.backend.sendLog("info", `[${net_type}] Wallet RPC: binary_dir=${binPath}, binary=${rpcPath}`);
        this.backend.sendLog("info", `[${net_type}] Wallet RPC: wallet_dir=${this.wallet_dir}, log_file=${log_file}`);
        this.backend.sendLog("info", `[${net_type}] Wallet RPC: daemon_address=${daemon_address}, rpc_bind=127.0.0.1:${options.wallet.rpc_bind_port}`);

        portscanner
          .checkPortStatus(this.port, this.hostname)
          .catch(() => "closed")
          .then(status => {
            if (status === "closed") {
              const pathSep = process.platform === "win32" ? ";" : ":";
              const spawnOptions =
                process.platform === "win32"
                  ? {
                      cwd: binPath,
                      env: { ...process.env, PATH: `${binPath}${pathSep}${process.env.PATH}` }
                    }
                  : {
                      detached: true,
                      cwd: binPath,
                      env: { ...process.env, PATH: `${binPath}${pathSep}${process.env.PATH}` }
                    };
              this.walletRPCProcess = child_process.spawn(
                rpcPath,
                args,
                spawnOptions
              );

              this.walletRPCProcess.stdout.on("data", data => {
                process.stdout.write(`Wallet: ${data}`);

                let lines = data.toString().split("\n");
                let match,
                  height = null;
                let isRPCSyncing = false;
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (trimmed.length === 0) continue;

                  // Forward important wallet-rpc output to troubleshooting logs
                  // Parse log level from lines like "2026-02-23 15:39:42.710 E ..."
                  const levelMatch = trimmed.match(
                    /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s+([EWID])\s+/
                  );
                  if (levelMatch) {
                    const lvl = levelMatch[1];
                    // Only log errors and warnings, skip routine INFO messages
                    if (lvl === "E") {
                      this.backend.sendLog("error", `[wallet-rpc] ${trimmed}`);
                    } else if (lvl === "W") {
                      this.backend.sendLog("warn", `[wallet-rpc] ${trimmed}`);
                    } else if (lvl === "I" && (
                      trimmed.includes("Refresh done") ||
                      trimmed.includes("Received money") ||
                      trimmed.includes("Spent money") ||
                      (trimmed.includes("balance") && !trimmed.includes("Calling RPC method"))
                    )) {
                      // Only log important INFO messages, exclude RPC call spam
                      this.backend.sendLog("info", `[wallet-rpc] ${trimmed}`);
                    }
                  } else if (
                    trimmed.includes("Equilibria") ||
                    trimmed.includes("THROW EXCEPTION") ||
                    trimmed.includes("Logging to") ||
                    trimmed.includes("Binding on") ||
                    trimmed.includes("wallet RPC server") ||
                    trimmed.includes("Loaded wallet")
                  ) {
                    const isErr = trimmed.includes("THROW EXCEPTION");
                    this.backend.sendLog(
                      isErr ? "error" : "info",
                      `[wallet-rpc] ${trimmed}`
                    );
                  }

                  for (const regex of this.height_regexes) {
                    match = line.match(regex.string);
                    if (match) {
                      height = regex.height(match);
                      isRPCSyncing = true;
                      break;
                    }
                  }
                }

                // Keep track on wether a wallet is syncing or not
                this.sendGateway("set_wallet_data", {
                  isRPCSyncing
                });
                this.isRPCSyncing = isRPCSyncing;

                if (height && Date.now() - this.last_height_send_time > 1000) {
                  this.last_height_send_time = Date.now();
                  this.sendGateway("set_wallet_data", {
                    info: {
                      height
                    }
                  });
                }
              });
              this.walletRPCProcess.on("error", err => {
                process.stderr.write(`Wallet: ${err}`);
                this.backend.sendLog(
                  "error",
                  `[wallet-rpc] Process error: ${err}`
                );
              });
              this.walletRPCProcess.on("close", code => {
                process.stderr.write(`Wallet: exited with code ${code} \n`);
                let exitMsg = `[wallet-rpc] Process exited with code ${code}`;
                if (code !== null && (code > 255 || code < 0)) {
                  exitMsg += ` (Windows error code; hex 0x${(code >>> 0).toString(16).toUpperCase()})`;
                }
                this.backend.sendLog("warn", exitMsg);
                this.walletRPCProcess = null;
                this.agent.destroy();
                if (code === null) {
                  reject(new Error("Failed to start wallet RPC"));
                }
              });
              if (this.walletRPCProcess.stderr) {
                this.walletRPCProcess.stderr.on("data", data => {
                  const lines = String(data).split("\n");
                  for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed) this.backend.sendLog("error", `[wallet-rpc stderr] ${trimmed}`);
                  }
                });
              }

              let intrvl = setInterval(() => {
                this.sendRPC("get_languages").then(data => {
                  if (!data.hasOwnProperty("error")) {
                    clearInterval(intrvl);
                    this.backend.sendLog(
                      "info",
                      "Wallet RPC started and responding"
                    );
                    resolve();
                  } else {
                    if (
                      this.walletRPCProcess &&
                      data.error.cause &&
                      data.error.cause.code === "ECONNREFUSED"
                    ) {
                      // Ignore
                    } else {
                      clearInterval(intrvl);
                      this.backend.sendLog("error", `[${net_type}] Could not connect to wallet RPC after startup (port ${this.port})`);
                      if (this.walletRPCProcess) this.walletRPCProcess.kill();
                      this.walletRPCProcess = null;
                      reject(new Error("Could not connect to wallet RPC"));
                    }
                  }
                });
              }, 1000);
            } else {
              this.backend.sendLog("warn", `[${net_type}] Wallet RPC port ${this.port} is in use; cannot start`);
              reject(new Error(`Wallet RPC port ${this.port} is in use`));
            }
          });
      });
    });
  }

  async handle(data) {
    let params = data.data;

    switch (data.method) {
      case "has_password":
        this.hasPassword();
        break;

      case "validate_address":
        this.validateAddress(params.address);
        break;

      case "decrypt_record": {
        const record = await this.decryptONSRecord(params.type, params.name);
        this.sendGateway("set_decrypt_record_result", {
          record,
          decrypted: !!record
        });
        break;
      }

      case "copy_old_gui_wallets":
        this.copyOldGuiWallets(params.wallets || []);
        break;

      case "list_wallets":
        this.listWallets();
        break;

      case "create_wallet":
        this.createWallet(
          params.name,
          params.password,
          params.language,
          params.hardware_wallet
        );
        break;

      case "restore_wallet":
        this.restoreWallet(
          params.name,
          params.password,
          params.seed,
          params.refresh_type,
          params.refresh_type == "date"
            ? params.refresh_start_date
            : params.refresh_start_height
        );
        break;

      case "restore_view_wallet":
        this.restoreViewWallet(
          params.name,
          params.password,
          params.address,
          params.viewkey,
          params.refresh_type,
          params.refresh_type == "date"
            ? params.refresh_start_date
            : params.refresh_start_height
        );
        break;

      case "import_wallet":
        this.importWallet(params.name, params.password, params.path);
        break;

      case "open_wallet":
        this.openWallet(params.name, params.password);
        break;

      case "close_wallet":
        this.closeWallet();
        break;

      case "stake":
        this.stake(
          params.password,
          params.amount,
          params.key,
          params.destination
        );
        break;

      case "register_service_node":
        this.registerSnode(params.password, params.string);
        break;

      case "update_service_node_list":
        this.updateServiceNodeList();
        break;

      case "unlock_stake":
        this.unlockStake(
          params.password,
          params.service_node_key,
          params.confirmed || false
        );
        break;

      case "transfer":
        this.transfer(
          params.password,
          params.amount,
          params.address,
          params.priority,
          !!params.isSweepAll
        );
        break;
      case "relay_tx":
        this.relayTransaction(
          params.isBlink,
          params.addressSave,
          params.note,
          !!params.isSweepAll
        );
        break;
      case "purchase_ons":
        this.purchaseONS(
          params.password,
          params.type,
          params.name,
          params.value,
          params.owner || "",
          params.backup_owner || ""
        );
        break;
      case "ons_renew_mapping":
        this.onsRenewMapping(params.password, params.type, params.name);
        break;
      case "update_ons_mapping":
        this.updateONSMapping(
          params.password,
          params.type,
          params.name,
          params.value,
          params.owner || "",
          params.backup_owner || ""
        );
        break;

      case "prove_transaction":
        this.proveTransaction(params.txid, params.address, params.message);
        break;

      case "check_transaction":
        this.checkTransactionProof(
          params.signature,
          params.txid,
          params.address,
          params.message
        );
        break;

      case "sign":
        this.sign(params.data);
        break;

      case "verify":
        this.verify(params.data, params.address, params.signature);
        break;

      case "add_address_book":
        this.addAddressBook(
          params.address,
          params.description,
          params.name,
          params.starred,
          params.hasOwnProperty("index") ? params.index : false
        );
        break;

      case "delete_address_book":
        this.deleteAddressBook(
          params.hasOwnProperty("index") ? params.index : false
        );
        break;

      case "save_tx_notes":
        this.saveTxNotes(params.txid, params.note);
        break;

      case "rescan_blockchain":
        this.rescanBlockchain();
        break;
      case "rescan_spent":
        this.rescanSpent();
        break;
      case "refresh_wallet":
        this.refreshWallet();
        break;
      case "get_private_keys":
        this.getPrivateKeys(params.password);
        break;
      case "export_key_images":
        this.exportKeyImages(params.password, params.path);
        break;
      case "import_key_images":
        this.importKeyImages(params.password, params.path);
        break;
      case "export_transfers":
        this.exportTransfers(params.password, params.path);
        break;

      case "change_wallet_password":
        this.changeWalletPassword(params.old_password, params.new_password);
        break;

      case "delete_wallet":
        this.deleteWallet(params.password);
        break;

      default:
    }
  }

  // Get password salt - use stored salt or auth[2], or generate/store a new one for remote wallets
  getPasswordSalt() {
    if (this.auth[2]) {
      return this.auth[2];
    }
    // For remote wallets, use stored salt or generate and store one
    if (!this.wallet_state.password_salt) {
      this.wallet_state.password_salt = crypto
        .randomBytes(32)
        .toString("hex")
        .substr(0, 32);
    }
    return this.wallet_state.password_salt;
  }

  isValidPasswordHash(password_hash) {
    if (this.wallet_state.password_hash === null) return true;
    return this.wallet_state.password_hash === password_hash.toString("hex");
  }

  hasPassword() {
    if (this.wallet_state.password_hash === null) {
      this.sendGateway("set_has_password", false);
      return;
    }

    // We need to check if the hash generated with an empty string is the same as the password_hash we are storing
    crypto.pbkdf2(
      "",
      this.getPasswordSalt(),
      100000,
      64,
      "sha512",
      (err, password_hash) => {
        if (err) {
          this.sendGateway("set_has_password", false);
          return;
        }

        // If the pass hash doesn't match empty string then we don't have a password
        this.sendGateway(
          "set_has_password",
          this.wallet_state.password_hash !== password_hash.toString("hex")
        );
      }
    );
  }

  validateAddress(address) {
    this.sendRPC("validate_address", {
      address
    }).then(data => {
      if (data.hasOwnProperty("error")) {
        this.sendGateway("set_valid_address", {
          address,
          valid: false
        });
        return;
      }

      const { valid, nettype } = data.result;

      const netMatches = this.net_type === nettype;
      const isValid = valid && netMatches;

      this.sendGateway("set_valid_address", {
        address,
        valid: isValid,
        nettype
      });
    });
  }

  isHardwareWallet(filename) {
    let hwfile = path.join(this.wallet_dir, filename + ".hwdev.txt");
    return fs.existsSync(hwfile);
  }

  createWallet(filename, password, language, hardware_wallet) {
    // Reset the status error
    this.sendGateway("reset_wallet_error");

    console.log(`[WalletRPC] Creating wallet: ${filename}`);
    console.log(`[WalletRPC] Wallet directory: ${this.wallet_dir}`);

    this.sendRPC("create_wallet", {
      filename,
      password,
      language,
      hardware_wallet: !!hardware_wallet,
      device_label: hardware_wallet ? "hardware_wallet" : undefined
    }).then(data => {
      if (data.hasOwnProperty("error")) {
        console.error(`[WalletRPC] Error creating wallet:`, data.error);
        this.backend.sendLog(
          "error",
          `Error creating wallet: ${JSON.stringify(data.error)}`
        );
        this.sendGateway("set_wallet_error", { status: data.error });
        return;
      }

      console.log(`[WalletRPC] Wallet created successfully: ${filename}`);
      this.backend.sendLog("info", `Wallet created: ${filename}`);

      // Verify wallet files were created
      const wallet_file = path.join(this.wallet_dir, filename);
      const keys_file = wallet_file + ".keys";
      console.log(
        `[WalletRPC] Checking wallet file: ${wallet_file}, exists: ${fs.existsSync(
          wallet_file
        )}`
      );
      console.log(
        `[WalletRPC] Checking keys file: ${keys_file}, exists: ${fs.existsSync(
          keys_file
        )}`
      );

      // store hash of the password so we can check against it later when requesting private keys, or for sending txs
      // For remote wallets, this.auth[2] might be null, so generate a salt if needed
      const salt = this.getPasswordSalt();
      this.wallet_state.password_hash = crypto
        .pbkdf2Sync(password, salt, 100000, 64, "sha512")
        .toString("hex");
      this.wallet_state.password = password;
      this.wallet_state.name = filename;
      this.wallet_state.open = true;

      this.backend.syncWalletsToBackup(true);
      this.finalizeNewWallet(filename);
    });
  }

  // the date should be in ms from epoch (Jan 1 1970)
  restoreWallet(
    filename,
    password,
    seed,
    refresh_type,
    refresh_start_timestamp_or_height
  ) {
    console.log(`[WalletRPC] restoreWallet ENTRY: name="${filename}", type=${refresh_type}, val=${refresh_start_timestamp_or_height}`);
    this.backend.sendLog("info", `restoreWallet ENTRY: name="${filename}", type=${refresh_type}`);
    if (refresh_type == "date") {
      // Convert timestamp to 00:00 and move back a day
      // Core code also moved back some amount of blocks
      let timestamp = refresh_start_timestamp_or_height;
      timestamp = timestamp - (timestamp % 86400000) - 86400000;

      this.sendGateway("reset_wallet_error");
      console.log(`[WalletRPC] restoreWallet: calling timestampToHeight(${timestamp})`);
      this.backend.sendLog("info", `restoreWallet: calling timestampToHeight(${timestamp})`);
      this.backend.daemon.timestampToHeight(timestamp).then(height => {
        console.log(`[WalletRPC] restoreWallet: timestampToHeight resolved → height=${height}`);
        this.backend.sendLog("info", `restoreWallet: timestampToHeight → height=${height}`);
        if (height === false) {
          this.sendGateway("set_wallet_error", {
            status: {
              code: -1,
              i18n: "notification.errors.invalidRestoreDate"
            }
          });
        } else {
          this.restoreWallet(filename, password, seed, "height", height);
        }
      });
      return;
    }
    let restore_height = Number.parseInt(refresh_start_timestamp_or_height);

    // if the height can't be parsed just start from block 0
    if (!restore_height) {
      restore_height = 0;
    }
    seed = seed.trim().replace(/\s{2,}/g, " ");

    this.sendGateway("reset_wallet_error");
    console.log(`[WalletRPC] restoreWallet: calling restore_deterministic_wallet for "${filename}", height=${restore_height}`);
    this.backend.sendLog("info", `restoreWallet: restore_deterministic_wallet for "${filename}", height=${restore_height}`);
    this.sendRPC("restore_deterministic_wallet", {
      filename,
      password,
      seed,
      restore_height
    }).then(data => {
      if (data.hasOwnProperty("error")) {
        console.error(`[WalletRPC] restoreWallet: RPC error:`, data.error);
        this.backend.sendLog("error", `restoreWallet: RPC error: ${JSON.stringify(data.error)}`);
        this.sendGateway("set_wallet_error", { status: data.error });
        return;
      }

      console.log(`[WalletRPC] restoreWallet: success, finalizing wallet "${filename}"`);
      this.backend.sendLog("info", `restoreWallet: restore_deterministic_wallet succeeded for "${filename}"`);

      // store hash of the password so we can check against it later when requesting private keys, or for sending txs
      // For remote wallets, this.auth[2] might be null, so generate a salt if needed
      const salt = this.getPasswordSalt();
      this.wallet_state.password_hash = crypto
        .pbkdf2Sync(password, salt, 100000, 64, "sha512")
        .toString("hex");
      this.wallet_state.password = password;
      this.wallet_state.name = filename;
      this.wallet_state.open = true;

      this.backend.syncWalletsToBackup(true);
      this.finalizeNewWallet(filename);
    });
  }

  restoreViewWallet(
    filename,
    password,
    address,
    viewkey,
    refresh_type,
    refresh_start_timestamp_or_height
  ) {
    if (refresh_type == "date") {
      // Convert timestamp to 00:00 and move back a day
      // Core code also moved back some amount of blocks
      let timestamp = refresh_start_timestamp_or_height;
      timestamp = timestamp - (timestamp % 86400000) - 86400000;

      this.backend.daemon.timestampToHeight(timestamp).then(height => {
        if (height === false) {
          this.sendGateway("set_wallet_error", {
            status: {
              code: -1,
              i18n: "notification.errors.invalidRestoreDate"
            }
          });
        } else {
          this.restoreViewWallet(
            filename,
            password,
            address,
            viewkey,
            "height",
            height
          );
        }
      });
      return;
    }

    let refresh_start_height = refresh_start_timestamp_or_height;

    if (!Number.isInteger(refresh_start_height)) {
      refresh_start_height = 0;
    }

    this.sendRPC("restore_view_wallet", {
      filename,
      password,
      address,
      viewkey,
      refresh_start_height
    }).then(data => {
      if (data.hasOwnProperty("error")) {
        this.sendGateway("set_wallet_error", { status: data.error });
        return;
      }

      // store hash of the password so we can check against it later when requesting private keys, or for sending txs
      // For remote wallets, this.auth[2] might be null, so generate a salt if needed
      const salt = this.getPasswordSalt();
      this.wallet_state.password_hash = crypto
        .pbkdf2Sync(password, salt, 100000, 64, "sha512")
        .toString("hex");
      this.wallet_state.password = password;
      this.wallet_state.name = filename;
      this.wallet_state.open = true;

      this.backend.syncWalletsToBackup(true);
      this.finalizeNewWallet(filename);
    });
  }

  importWallet(wallet_name, password, import_path) {
    // Reset the status error
    this.sendGateway("reset_wallet_error");

    // trim off suffix if exists
    if (import_path.endsWith(".keys")) {
      import_path = import_path.substring(
        0,
        import_path.length - ".keys".length
      );
    } else if (import_path.endsWith(".address.txt")) {
      import_path = import_path.substring(
        0,
        import_path.length - ".address.txt".length
      );
    }

    if (!fs.existsSync(import_path)) {
      this.sendGateway("set_wallet_error", {
        status: {
          code: -1,
          i18n: "notification.errors.invalidWalletPath"
        }
      });
      return;
    } else {
      let destination = path.join(this.wallet_dir, wallet_name);
      if (fs.existsSync(destination) || fs.existsSync(destination + ".keys")) {
        this.sendGateway("set_wallet_error", {
          status: {
            code: -1,
            i18n: "notification.errors.walletAlreadyExists"
          }
        });
        return;
      }

      try {
        fs.copySync(import_path, destination, { errorOnExist: true });
        if (fs.existsSync(import_path + ".keys")) {
          fs.copySync(import_path + ".keys", destination + ".keys", {
            errorOnExist: true
          });
        }

        if (fs.existsSync(import_path + ".hwdev.txt")) {
          fs.copySync(
            import_path + ".hwdev.txt",
            destination + ".hwdev.txt",
            fs.constants.COPYFILE_EXCL
          );
        }
      } catch (e) {
        this.sendGateway("set_wallet_error", {
          status: {
            code: -1,
            i18n: "notification.errors.copyWalletFail"
          }
        });
        return;
      }
      this.sendRPC("open_wallet", {
        filename: wallet_name,
        password
      })
        .then(data => {
          if (data.hasOwnProperty("error")) {
            if (fs.existsSync(destination)) fs.unlinkSync(destination);
            if (fs.existsSync(destination + ".keys"))
              fs.unlinkSync(destination + ".keys");
            this.sendGateway("set_wallet_error", {
              status: data.error
            });
            return;
          }
          // store hash of the password so we can check against it later when requesting private keys, or for sending txs
          // For remote wallets, this.auth[2] might be null, so generate a salt if needed
          const salt = this.getPasswordSalt();
          this.wallet_state.password_hash = crypto
            .pbkdf2Sync(password, salt, 100000, 64, "sha512")
            .toString("hex");
          this.wallet_state.password = password;
          this.wallet_state.name = wallet_name;
          this.wallet_state.open = true;
          this.backend.syncWalletsToBackup(true);
          // Refresh wallet list with address so imported wallet shows address in list (like restored)
          this.sendRPC("get_address", { account_index: 0 }, 5000).then(addrRes => {
            const address = (addrRes && addrRes.result && addrRes.result.address) ? addrRes.result.address : "";
            this.listWallets(false, { name: wallet_name, address });
          }).catch(() => {});
          this.finalizeNewWallet(wallet_name);
        })
        .catch(() => {
          this.sendGateway("set_wallet_error", {
            status: {
              code: -1,
              i18n: "notification.errors.unknownError"
            }
          });
        });
    }
  }

  finalizeNewWallet(filename) {
    // Fetch wallet info and secret keys with timeouts to prevent blocking.
    // We send the wallet data (including secrets) first, then start the
    // heartbeat. This ensures the UI has the mnemonic before navigating
    // to the created page (which is triggered by status code 0).
    Promise.all([
      this.sendRPC("get_address", { account_index: 0 }, 10000),
      this.sendRPC("getheight", {}, 10000),
      this.sendRPC("getbalance", { account_index: 0 }, 10000),
      this.sendRPC("query_key", { key_type: "mnemonic" }, 10000),
      this.sendRPC("query_key", { key_type: "spend_key" }, 10000),
      this.sendRPC("query_key", { key_type: "view_key" }, 10000)
    ]).then(data => {
      let wallet = {
        info: {
          name: filename,
          address: "",
          balance: 0,
          unlocked_balance: 0,
          accrued_balance: 0,
          accrued_balance_next_payout: 0,
          height: 0,
          view_only: false
        },
        secret: {
          mnemonic: "",
          spend_key: "",
          view_key: ""
        }
      };
      for (let n of data) {
        if (n.hasOwnProperty("error") || !n.hasOwnProperty("result")) {
          continue;
        }
        if (n.method == "get_address") {
          wallet.info.address = n.result.address;
        } else if (n.method == "getheight") {
          wallet.info.height = n.result.height;
        } else if (n.method == "getbalance") {
          wallet.info.balance = n.result.balance;
          wallet.info.unlocked_balance = n.result.unlocked_balance;
          wallet.info.accrued_balance = n.result.accrued_balance;
          wallet.info.accrued_balance_next_payout =
            n.result.accrued_balance_next_payout;
        } else if (n.method == "query_key") {
          wallet.secret[n.params.key_type] = n.result.key;
          if (n.params.key_type == "spend_key") {
            if (/^0*$/.test(n.result.key)) {
              wallet.info.view_only = true;
            }
          }
        }
      }

      if (this.isHardwareWallet(filename)) {
        wallet.info.hardware_wallet = true;
      }

      this.saveWallet().then(() => {
        let address_txt_path = path.join(
          this.wallet_dir,
          filename + ".address.txt"
        );
        if (!fs.existsSync(address_txt_path) && wallet.info.address) {
          try {
            fs.writeFileSync(address_txt_path, wallet.info.address, "utf8");
          } catch (e) {
            console.warn("[WalletRPC] Could not write .address.txt:", e.message);
          }
        }
        this.listWallets(false, { name: filename, address: wallet.info.address });
      });

      // Send wallet data with secrets FIRST
      this.sendGateway("set_wallet_data", wallet);

      // THEN start heartbeat which will send status: { code: 0 }
      // This ensures the UI has the mnemonic before navigating to created page
      if (this.isHardwareWallet(filename)) {
        this.startHeartbeat(10);
      } else {
        this.startHeartbeat();
      }
    });
  }

  openWallet(filename, password) {
    this.sendGateway("reset_wallet_error");
    this.backend.sendLog("info", `Opening wallet: ${filename}`);
    this.sendRPC("open_wallet", {
      filename,
      password
    }).then(data => {
      if (data.hasOwnProperty("error")) {
        this.backend.sendLog(
          "error",
          `Failed to open wallet "${filename}": ${data.error.message ||
            JSON.stringify(data.error)}`
        );
        this.sendGateway("set_wallet_error", { status: data.error });
        return;
      }
      this.backend.sendLog("info", `Wallet "${filename}" opened successfully`);

      // If daemon is connected, trigger a refresh to sync with the network
      // Note: wallet-rpc is already started with --daemon-address, so no need to call set_daemon
      if (this.backend.daemon && this.backend.config_data) {
        this.backend.send("show_notification", {
          type: "info",
          color: "cyan",
          textColor: "dark",
          message: "Wallet opened! Syncing with network...",
          timeout: 10000
        });

        // Check wallet height and refresh if needed
        this.sendRPC("getheight", {}, 5000).then(heightResult => {
          const walletHeight = heightResult.result?.height || 0;
          this.backend.sendLog("info", `Wallet height on open: ${walletHeight}`);

          // If wallet is at a very low height, do a full refresh from block 0
          if (walletHeight < 100) {
            this.backend.sendLog("info", "Wallet needs full sync - calling refresh with start_height=0...");
            this.isRefreshing = true;
            const startTime = Date.now();
            this.sendRPC("refresh", { start_height: 0 }, 600000).then(refreshResult => {
              this.isRefreshing = false;
              const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
              const blocks = refreshResult.result?.blocks_fetched || 0;
              this.backend.sendLog("info", `Refresh completed in ${elapsed}s - blocks: ${blocks}, full result: ${JSON.stringify(refreshResult)}`);

              // Get balance after refresh
              this.sendRPC("getbalance", { account_index: 0 }, 10000).then(balResult => {
                const bal = balResult.result?.balance || 0;
                const unlocked = balResult.result?.unlocked_balance || 0;
                this.backend.sendLog("info", `Balance after refresh: ${(bal/1e9).toFixed(4)} XEQ (unlocked: ${(unlocked/1e9).toFixed(4)} XEQ)`);
                this.wallet_state.balance = bal;
                this.wallet_state.unlocked_balance = unlocked;
                this.sendGateway("set_wallet_data", { info: { balance: bal, unlocked_balance: unlocked } });
              });
            }).catch(err => {
              this.isRefreshing = false;
              this.backend.sendLog("warn", `Refresh failed: ${err.message || err}`);
            });
          } else {
            this.backend.sendLog("info", `Wallet already at height ${walletHeight}, doing quick refresh...`);
            this.sendRPC("refresh", {}, 60000).then(refreshResult => {
              const blocks = refreshResult.result?.blocks_fetched || 0;
              this.backend.sendLog("info", `Quick refresh done - ${blocks} blocks`);
            });
          }
        }).catch(err => {
          this.backend.sendLog("warn", `getheight failed: ${err.message || err}`);
        });
      }

      let address_txt_path = path.join(
        this.wallet_dir,
        filename + ".address.txt"
      );
      if (!fs.existsSync(address_txt_path)) {
        this.sendRPC("get_address", { account_index: 0 }).then(data => {
          if (data.hasOwnProperty("error") || !data.hasOwnProperty("result")) {
            return;
          }
          fs.writeFile(address_txt_path, data.result.address, "utf8", () => {
            this.listWallets();
          });
        });
      }

      const hardware_wallet_file = path.join(
        this.wallet_dir,
        filename + ".hwdev.txt"
      );
      const hardware_wallet = fs.existsSync(hardware_wallet_file);

      // store hash of the password so we can check against it later when requesting private keys, or for sending txs
      // For remote wallets, this.auth[2] might be null, so generate a salt if needed
      const salt = this.getPasswordSalt();
      this.wallet_state.password_hash = crypto
        .pbkdf2Sync(password, salt, 100000, 64, "sha512")
        .toString("hex");
      this.wallet_state.password = password;
      this.wallet_state.name = filename;
      this.wallet_state.open = true;

      if (hardware_wallet) {
        this.startHeartbeat(10);
      } else {
        this.startHeartbeat();
      }

      this.purchasedNames = {};

      this.sendGateway("set_wallet_data", {
        info: {
          hardware_wallet
        }
      });

      // Check if we have a view only wallet by querying the spend key
      this.sendRPC("query_key", { key_type: "spend_key" }).then(data => {
        if (data.hasOwnProperty("error") || !data.hasOwnProperty("result")) {
          return;
        }
        if (/^0*$/.test(data.result.key)) {
          this.sendGateway("set_wallet_data", {
            info: {
              view_only: true
            }
          });
        }
      });
    });
  }

  startHeartbeat(multiplier = 1) {
    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      this.heartbeatAction();
    }, 5000 * multiplier);
    this.heartbeatAction(true);

    clearInterval(this.onsHeartbeat);
    this.onsHeartbeat = setInterval(() => {
      this.updateLocalONSRecords();
    }, 30 * 1000 * multiplier); // Every 30 seconds
    this.updateLocalONSRecords();

    // Start fast sync polling for initial wallet sync
    this.startSyncPoller();
  }

  // Fast polling for sync progress - runs every 1 second during initial sync
  startSyncPoller() {
    clearInterval(this.syncPoller);
    this.syncPollerActive = true;
    this.lastSyncHeight = 0;
    this.syncStableCount = 0;

    this.syncPoller = setInterval(() => {
      if (!this.syncPollerActive) {
        clearInterval(this.syncPoller);
        return;
      }

      // Only poll height quickly during sync
      this.sendRPC("getheight", {}, 3000).then(data => {
        if (data.hasOwnProperty("error") || !data.hasOwnProperty("result")) {
          return;
        }

        const height = data.result.height;

        // Send height update to UI
        this.sendGateway("set_wallet_data", {
          info: { height }
        });

        // Track if height has stabilized (not changing = sync complete)
        // But only consider sync complete if we're at a reasonable height (> 1000)
        // And not while refresh is in progress
        if (height === this.lastSyncHeight && !this.isRefreshing) {
          this.syncStableCount++;
          // If height stable for 5 polls (5 seconds) AND at a reasonable height, assume sync complete
          if (this.syncStableCount >= 5 && height > 1000) {
            this.stopSyncPoller();
            this.backend.sendLog("info", `Wallet sync complete at height ${height}`);
          }
        } else {
          this.syncStableCount = 0;
          this.lastSyncHeight = height;
        }
      });
    }, 1000); // Poll every 1 second

    this.backend.sendLog("info", "Started fast sync polling");
  }

  stopSyncPoller() {
    if (this.syncPoller) {
      clearInterval(this.syncPoller);
      this.syncPoller = null;
    }
    this.syncPollerActive = false;
  }

  heartbeatAction(extended = false) {
    this.heartbeatCount = (this.heartbeatCount || 0) + 1;
    Promise.all([
      this.sendRPC("get_address", { account_index: 0 }, 5000),
      this.sendRPC("getheight", {}, 5000),
      this.sendRPC("getbalance", { account_index: 0 }, 5000)
    ]).then(data => {
      let didError = false;
      let balanceChanged = false;
      let rpcFailures = [];

      for (const n of data) {
        if (n && n.hasOwnProperty("error") && n.error) {
          rpcFailures.push(
            `${n.method || "unknown"}: ${n.error.message ||
              JSON.stringify(n.error)}`
          );
        }
      }

      if (rpcFailures.length > 0) {
        this.backend.sendLog(
          "error",
          `Wallet RPC heartbeat failures — ${rpcFailures.join("; ")}`
        );
      }
      let wallet = {
        status: {
          code: 0,
          message: "OK"
        },
        info: {
          name: this.wallet_state.name
        },
        transactions: {
          tx_list: []
        },
        address_list: {
          primary: [],
          used: [],
          unused: [],
          address_book: [],
          address_book_starred: []
        }
      };

      for (let n of data) {
        if (n.hasOwnProperty("error") || !n.hasOwnProperty("result")) {
          // Maybe we also need to look into the other error codes it could give us
          // Error -13: No wallet file - This occurs when you call open wallet while another wallet is still syncing
          if (extended && n.error && n.error.code === -13) {
            didError = true;
          }
          continue;
        }

        if (n.method == "getheight") {
          wallet.info.height = n.result.height;
          this.sendGateway("set_wallet_data", {
            info: {
              height: n.result.height
            }
          });
        } else if (n.method == "get_address") {
          wallet.info.address = n.result.address;
          this.sendGateway("set_wallet_data", {
            info: {
              address: n.result.address
            }
          });
        } else if (n.method == "getbalance") {
          // Log raw balance from RPC for debugging
          const rawBal = n.result.balance;
          const rawUnlocked = n.result.unlocked_balance;
          if (this.heartbeatCount <= 3 || rawBal !== this.wallet_state.balance) {
            this.backend.sendLog(
              "info",
              `[getbalance RPC] raw balance: ${rawBal} (${(rawBal / this.getAtomicDivisor()).toFixed(4)} XEQ), unlocked: ${rawUnlocked} (${(rawUnlocked / this.getAtomicDivisor()).toFixed(4)} XEQ)`
            );
          }

          if (
            this.wallet_state.balance == n.result.balance &&
            this.wallet_state.unlocked_balance == n.result.unlocked_balance &&
            this.wallet_state.accrued_balance == n.result.accrued_balance &&
            this.wallet_state.accrued_balance_next_payout ==
              n.result.accrued_balance_next_payout
          ) {
            continue;
          }

          this.wallet_state.balance = wallet.info.balance = n.result.balance;
          this.wallet_state.unlocked_balance = wallet.info.unlocked_balance =
            n.result.unlocked_balance;
          this.wallet_state.accrued_balance = wallet.info.accrued_balance =
            n.result.accrued_balance;
          this.wallet_state.accrued_balance_next_payout = wallet.info.accrued_balance_next_payout =
            n.result.accrued_balance_next_payout;

          // Debug: log what we're sending to the gateway
          console.log(`[WalletRPC] Sending balance to gateway: ${wallet.info.balance} (${(wallet.info.balance/1e9).toFixed(4)} XEQ)`);

          this.sendGateway("set_wallet_data", {
            info: wallet.info
          });

          balanceChanged = true;

          // if balance has recently changed, get updated list of transactions and used addresses
          let actions = [this.getTransactions(), this.getAddressList()];
          actions.push(this.getAddressBook());
          Promise.all(actions).then(data => {
            for (let n of data) {
              Object.keys(n).map(key => {
                wallet[key] = Object.assign(wallet[key], n[key]);
              });
            }
            this.sendGateway("set_wallet_data", wallet);
          });
        }
      }

      if (this.heartbeatCount % 6 === 1 && wallet.info.height !== undefined) {
        const bal = this.wallet_state.balance;
        const unlocked = this.wallet_state.unlocked_balance;
        const divisor = this.getAtomicDivisor();
        // Convert from atomic units (legacy: 1e4, mainnet: 1e9)
        const balXEQ = bal !== null ? (bal / divisor).toFixed(4) : "null";
        const unlockedXEQ = unlocked !== null ? (unlocked / divisor).toFixed(4) : "null";
        this.backend.sendLog(
          "info",
          `Wallet status — height: ${wallet.info.height}, syncing: ${
            this.isRPCSyncing ? "yes" : "no"
          }, balance: ${balXEQ} XEQ, unlocked: ${unlockedXEQ} XEQ`
        );
      }

      // Poll transactions every ~30s even if balance hasn't changed
      // This catches pending->confirmed transitions and new incoming TXs
      if (!extended && !balanceChanged && this.heartbeatCount % 6 === 0) {
        this.getTransactions().then(txData => {
          if (txData && txData.transactions) {
            this.sendGateway("set_wallet_data", txData);
          }
        });
      }

      // Set the wallet state on initial heartbeat or after refresh
      if (extended) {
        if (!didError) {
          if (
            !wallet.info.hasOwnProperty("balance") &&
            this.wallet_state.balance !== null
          ) {
            wallet.info.balance = this.wallet_state.balance;
            wallet.info.unlocked_balance = this.wallet_state.unlocked_balance;
            wallet.info.accrued_balance = this.wallet_state.accrued_balance;
            wallet.info.accrued_balance_next_payout = this.wallet_state.accrued_balance_next_payout;
          }
          // Send wallet data immediately so UI transitions (removes loading spinner).
          // This is critical in offline mode where daemon is unreachable — the
          // additional RPC calls below may hang indefinitely without a daemon.
          this.sendGateway("set_wallet_data", wallet);

          // Fetch transactions/addresses asynchronously with a timeout.
          // If these fail or timeout, the wallet is still usable.
          const extTimeout = 10000;
          Promise.race([
            Promise.all([
              this.getTransactions(),
              this.getAddressList(),
              this.getAddressBook()
            ]),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Extended heartbeat timeout")), extTimeout)
            )
          ])
            .then(extData => {
              for (let n of extData) {
                Object.keys(n).map(key => {
                  wallet[key] = Object.assign(wallet[key] || {}, n[key]);
                });
              }
              this.sendGateway("set_wallet_data", wallet);
            })
            .catch(err => {
              this.backend.sendLog(
                "warn",
                `Extended heartbeat skipped: ${err.message || err}`
              );
            });
        } else {
          this.closeWallet().then(() => {
            this.sendGateway("set_wallet_error", {
              status: {
                code: -1,
                i18n: "notification.errors.failedWalletOpen"
              }
            });
          });
        }
      }
    });
  }

  async updateLocalONSRecords() {
    try {
      const addressData = await this.sendRPC(
        "get_address",
        { account_index: 0 },
        5000
      );
      if (
        addressData.hasOwnProperty("error") ||
        !addressData.hasOwnProperty("result")
      ) {
        return;
      }

      // Pull out all our addresses from the data and make sure they're valid
      const results = addressData.result.addresses || [];
      const addresses = results.map(a => a.address).filter(a => !!a);
      if (addresses.length === 0) return;

      const records = await this.backend.daemon.getONSRecordsForOwners(
        addresses
      );

      // We need to ensure that we decrypt any incoming records that we already have
      const currentRecords = this.wallet_state.onsRecords;
      const recordsToUpdate = { ...this.purchasedNames };
      const newRecords = records.map(record => {
        // If we have a new record or we haven't decrypted our current record then we should return the new record
        const current = currentRecords.find(
          c => c.name_hash === record.name_hash
        );
        if (!current || !current.name) return record;

        // We need to check if we need to re-decrypt the record.
        // This is only necessary if the encrypted_value changed.
        const needsToUpdate =
          current.encrypted_value !== record.encrypted_value;
        if (needsToUpdate) {
          const { name, type } = current;
          recordsToUpdate[name] = type;

          return {
            name,
            ...record
          };
        }

        // Otherwise just update our current record with new information (in the case that owner or backup_owner was updated)
        return {
          ...current,
          ...record
        };
      });

      this.wallet_state.onsRecords = newRecords;

      // fetch the known (cached) records from the wallet and add the data
      // to the records being set in state
      let known_names = await this.onsKnownNames();

      // Fill the necessary decrypted values of the cached ONS names
      for (let r of newRecords) {
        for (let k of known_names) {
          if (k.hashed === r.name_hash) {
            r["name"] = k.name;
            r["value"] = k.value;
            r["expiration_height"] = k.expiration_height;
          }
        }
      }

      this.sendGateway("set_wallet_data", { onsRecords: newRecords });

      // Decrypt the records serially
      let updatePromise = Promise.resolve();
      for (const [name, type] of Object.entries(recordsToUpdate)) {
        updatePromise = updatePromise.then(() => {
          this.decryptONSRecord(type, name);
        });
      }
    } catch (e) {
      console.debug("Something went wrong when updating ons records: ", e);
    }
  }

  /*
  Get the ONS records cached in this wallet. 
  */
  async onsKnownNames() {
    try {
      let params = {
        decrypt: true,
        include_expired: false
      };

      let data = await this.sendRPC("ons_known_names", params);

      if (data.result && data.result.known_names) {
        return data.result.known_names;
      } else {
        return [];
      }
    } catch (e) {
      console.debug("There was an error getting known records: " + e);
      return [];
    }
  }

  /*
  Renews an ONS (Lokinet) mapping, since they can expire
  type can be:
  lokinet_1y, lokinet_2y, lokinet_5y, lokinet_10y
  */
  onsRenewMapping(password, type, name) {
    let _name = name.trim().toLowerCase();

    // the RPC accepts names with the .loki already appeneded only
    // can be lokinet_1y, lokinet_2y, lokinet_5y, lokinet_10y
    if (type.startsWith("lokinet")) {
      _name = _name + ".loki";
    }

    crypto.pbkdf2(
      password,
      this.getPasswordSalt(),
      100000,
      64,
      "sha512",
      (err, password_hash) => {
        if (err) {
          this.sendGateway("set_ons_status", {
            code: -1,
            i18n: "notification.errors.internalError",
            sending: false
          });
          return;
        }
        if (!this.isValidPasswordHash(password_hash)) {
          this.sendGateway("set_ons_status", {
            code: -1,
            i18n: "notification.errors.invalidPassword",
            sending: false
          });
          return;
        }

        const params = {
          type,
          name: _name
        };

        this.sendRPC("ons_renew_mapping", params).then(data => {
          if (data.hasOwnProperty("error")) {
            let error =
              data.error.message.charAt(0).toUpperCase() +
              data.error.message.slice(1);
            this.sendGateway("set_ons_status", {
              code: -1,
              message: error,
              sending: false
            });
            return;
          }

          this.purchasedNames[name.trim()] = type;

          setTimeout(() => this.updateLocalONSRecords(), 5000);

          this.sendGateway("set_ons_status", {
            code: 0,
            i18n: "notification.positive.nameRenewed",
            sending: false
          });
        });
      }
    );
  }

  /*
  Get our ONS record and update our wallet state with decrypted values.
  This will return `null` if the record is not in our currently stored records.
  */
  async decryptONSRecord(type, name) {
    let _type = type;
    // type can initially be "lokinet_1y" etc. on a purchase
    if (type.startsWith("lokinet")) {
      _type = "lokinet";
    }
    try {
      const record = await this.getONSRecord(_type, name);
      if (!record) return null;

      // Update our current records with the new decrypted record
      const currentRecords = this.wallet_state.onsRecords;
      const isOurRecord = currentRecords.find(
        c => c.name_hash === record.name_hash
      );
      if (!isOurRecord) {
        return null;
      } else {
        // if it's our record, we can cache it
        const _record = {
          type: record.type,
          name: record.name
        };
        const params = {
          names: [_record]
        };
        this.sendRPC("ons_add_known_names", params);
      }

      const newRecords = currentRecords.map(current => {
        if (current.name_hash === record.name_hash) {
          return record;
        }
        return current;
      });
      this.wallet_state.onsRecords = newRecords;
      this.sendGateway("set_wallet_data", { onsRecords: newRecords });
      return record;
    } catch (e) {
      console.debug("Something went wrong decrypting ons record: ", e);
      return null;
    }
  }

  /*
  Get a ONS record associated with the given name
  */
  async getONSRecord(type, name) {
    // We support session, wallet and lokinet
    const types = ["session", "wallet", "lokinet"];
    if (!types.includes(type)) return null;

    if (!name || name.trim().length === 0) return null;

    const lowerCaseName = name.toLowerCase();

    let fullName = lowerCaseName;
    if (type === "lokinet" && !name.endsWith(".loki")) {
      fullName = fullName + ".loki";
    }

    const nameHash = await this.hashONSName(type, lowerCaseName);
    if (!nameHash) return null;

    const record = await this.backend.daemon.getONSRecord(nameHash);
    if (!record || !record.encrypted_value) return null;

    // Decrypt the value if possible
    const value = await this.decryptONSValue(
      type,
      fullName,
      record.encrypted_value
    );

    return {
      name: fullName,
      value,
      ...record
    };
  }

  async hashONSName(type, name) {
    if (!type || !name) return null;

    let fullName = name;
    if (type === "lokinet" && !name.endsWith(".loki")) {
      fullName = fullName + ".loki";
    }

    try {
      const data = await this.sendRPC("ons_hash_name", {
        type,
        name: fullName
      });

      if (data.hasOwnProperty("error")) {
        let error =
          data.error.message.charAt(0).toUpperCase() +
          data.error.message.slice(1);
        throw new Error(error);
      }

      return (data.result && data.result.name) || null;
    } catch (e) {
      console.debug("Failed to hash ons name: ", e);
      return null;
    }
  }

  async decryptONSValue(type, name, encrypted_value) {
    if (!type || !name || !encrypted_value) return null;

    let fullName = name;
    if (type === "lokinet" && !name.endsWith(".loki")) {
      fullName = fullName + ".loki";
    }

    try {
      const data = await this.sendRPC("ons_decrypt_value", {
        type,
        name: fullName,
        encrypted_value
      });

      if (data.hasOwnProperty("error")) {
        let error =
          data.error.message.charAt(0).toUpperCase() +
          data.error.message.slice(1);
        throw new Error(error);
      }

      return (data.result && data.result.value) || null;
    } catch (e) {
      console.debug("Failed to decrypt ons value: ", e);
      return null;
    }
  }

  async sign(data) {
    // set to loading
    this.sendGateway("set_sign_status", {
      code: 0,
      sending: true
    });
    try {
      const rpcData = await this.sendRPC("sign", { data });
      if (
        !rpcData ||
        rpcData.hasOwnProperty("error") ||
        !rpcData.hasOwnProperty("result")
      ) {
        const error = rpcData?.error?.message || "Unknown error";
        this.sendGateway("set_sign_status", {
          code: -1,
          message: error,
          sending: false
        });
        return;
      }
      const signature = rpcData.result.signature;

      this.sendGateway("set_sign_status", {
        code: 1,
        sending: false,
        signature: signature
      });
      return;
    } catch (err) {
      console.debug(`Failed to sign data: ${data} with error: ${err}`);
      this.sendGateway("set_sign_status", {
        code: -1,
        message: err,
        sending: false
      });
    }
  }

  async verify(data, address, signature) {
    this.sendGateway("set_verify_status", {
      code: 0,
      sending: true
    });
    try {
      const rpcData = await this.sendRPC("verify", {
        data,
        address,
        signature
      });
      if (
        !rpcData ||
        rpcData.hasOwnProperty("error") ||
        !rpcData.hasOwnProperty("result")
      ) {
        let errorI18n = "";
        const error = rpcData.error.message || "Unknown error";
        if (error && error.includes("Invalid address")) {
          errorI18n = "notification.errors.invalidAddress";
        }
        this.sendGateway("set_verify_status", {
          code: -1,
          message: "",
          i18n: errorI18n || "Unknown error",
          sending: false
        });
        return;
      }
      const good = rpcData.result.good;
      if (good) {
        // success
        this.sendGateway("set_verify_status", {
          code: 1,
          sending: false,
          i18n: "notification.positive.signatureVerified",
          message: ""
        });
      } else {
        // error
        this.sendGateway("set_verify_status", {
          code: -1,
          sending: false,
          i18n: "notification.errors.invalidSignature",
          message: ""
        });
      }

      return;
    } catch (err) {
      this.sendGateway("set_verify_status", {
        code: -1,
        message: err.toString(),
        i18n: "",
        sending: false
      });
    }
  }

  stake(password, amount, service_node_key, destination) {
    crypto.pbkdf2(
      password,
      this.getPasswordSalt(),
      100000,
      64,
      "sha512",
      (err, password_hash) => {
        if (err) {
          this.sendGateway("set_snode_status", {
            stake: {
              code: -1,
              i18n: "notification.errors.internalError",
              sending: false
            }
          });
          return;
        }
        if (!this.isValidPasswordHash(password_hash)) {
          this.sendGateway("set_snode_status", {
            stake: {
              code: -1,
              i18n: "notification.errors.invalidPassword",
              sending: false
            }
          });
          return;
        }

        amount = (parseFloat(amount) * this.getAtomicDivisor()).toFixed(0);

        this.sendRPC("stake", {
          amount,
          destination,
          service_node_key
        }).then(data => {
          if (data.hasOwnProperty("error")) {
            let error =
              data.error.message.charAt(0).toUpperCase() +
              data.error.message.slice(1);
            this.sendGateway("set_snode_status", {
              stake: {
                code: -1,
                message: error,
                sending: false
              }
            });
            return;
          }

          // Update the new snode list
          this.backend.daemon.updateServiceNodes();

          this.sendGateway("set_snode_status", {
            stake: {
              code: 0,
              i18n: "notification.positive.stakeSuccess",
              sending: false
            }
          });
        });
      }
    );
  }

  registerSnode(password, register_service_node_str) {
    crypto.pbkdf2(
      password,
      this.getPasswordSalt(),
      100000,
      64,
      "sha512",
      (err, password_hash) => {
        if (err) {
          this.sendGateway("set_snode_status", {
            registration: {
              code: -1,
              i18n: "notification.errors.internalError",
              sending: false
            }
          });
          return;
        }

        if (!this.isValidPasswordHash(password_hash)) {
          this.sendGateway("set_snode_status", {
            registration: {
              code: -1,
              i18n: "notification.errors.invalidPassword",
              sending: false
            }
          });
          return;
        }

        this.sendRPC("register_service_node", {
          register_service_node_str
        }).then(data => {
          if (data.hasOwnProperty("error")) {
            const error =
              data.error.message.charAt(0).toUpperCase() +
              data.error.message.slice(1);
            this.sendGateway("set_snode_status", {
              registration: {
                code: -1,
                message: error,
                sending: false
              }
            });
            return;
          }

          // Update the new snode list
          this.backend.daemon.updateServiceNodes();

          this.sendGateway("set_snode_status", {
            registration: {
              code: 0,
              i18n: "notification.positive.registerServiceNodeSuccess",
              sending: false
            }
          });
        });
      }
    );
  }

  async updateServiceNodeList() {
    this.backend.daemon.updateServiceNodes();
  }

  unlockStake(password, service_node_key, confirmed = false) {
    const sendError = (message, i18n = true) => {
      const key = i18n ? "i18n" : "message";
      this.sendGateway("set_snode_status", {
        unlock: {
          code: -1,
          [key]: message,
          sending: false
        }
      });
    };

    // Unlock code 0 means success, 1 means can unlock, -1 means error
    crypto.pbkdf2(
      password,
      this.getPasswordSalt(),
      100000,
      64,
      "sha512",
      (err, password_hash) => {
        if (err) {
          sendError("notification.errors.internalError");
          return;
        }

        if (!this.isValidPasswordHash(password_hash)) {
          sendError("notification.errors.invalidPassword");
          return;
        }

        const sendRPC = path => {
          return this.sendRPC(path, {
            service_node_key
          }).then(data => {
            if (data.hasOwnProperty("error")) {
              const error =
                data.error.message.charAt(0).toUpperCase() +
                data.error.message.slice(1);
              sendError(error, false);
              return null;
            }

            if (!data.hasOwnProperty("result")) {
              sendError("notification.errors.failedServiceNodeUnlock");
              return null;
            }

            return data.result;
          });
        };

        if (confirmed) {
          sendRPC("request_stake_unlock").then(data => {
            if (!data) return;

            const unlock = {
              code: data.unlocked ? 0 : -1,
              message: data.msg,
              sending: false
            };

            // Update the new snode list
            if (data.unlocked) {
              this.backend.daemon.updateServiceNodes();
            }

            this.sendGateway("set_snode_status", { unlock });
          });
        } else {
          sendRPC("can_request_stake_unlock").then(data => {
            if (!data) return;

            const unlock = {
              code: data.can_unlock ? 1 : -1,
              message: data.msg,
              sending: false
            };

            this.sendGateway("set_snode_status", { unlock });
          });
        }
      }
    );
  }

  // submits the transaction to the blockchain, irreversible from here
  async relayTransaction(isBlink, addressSave, note, isSweepAll) {
    // for a sweep these don't exist
    let address = "";
    let address_book = "";
    if (addressSave) {
      address = addressSave.address;
      address_book = addressSave.address_book;
    }

    let failed = false;
    let errorMessage = "Failed to relay transaction";
    let txHashList = []; // Collect all tx hashes for display

    // submit each transaction individually
    for (let hex of this.pending_tx.metadataList) {
      let params = {
        hex,
        blink: isBlink
      };

      // don't try submit more txs if a prev one failed
      if (failed) break;

      let txSuccess = false;
      try {
        let data = await this.sendRPC("relay_tx", params);
        if (data.hasOwnProperty("error")) {
          // If Blink transaction failed with timeout or rejection, retry as regular transaction
          const errorMsg = (
            data.error.message ||
            data.error.msg ||
            ""
          ).toLowerCase();
          const errorCode = (data.error.code || "").toString().toLowerCase();
          const errorString = JSON.stringify(data.error).toLowerCase();
          const isBlinkError =
            errorMsg.includes("blink") ||
            errorMsg.includes("quorum") ||
            errorMsg.includes("timeout") ||
            errorCode.includes("blink") ||
            errorCode.includes("quorum") ||
            errorString.includes("tx_blink_rejected") ||
            errorString.includes("blink quorum");

          // Check for double spend or verification failed - these usually mean outputs are already spent
          const isDoubleSpend =
            errorMsg.includes("double spend") ||
            errorMsg.includes("verification failed") ||
            errorString.includes("double spend") ||
            errorCode.includes("double_spend");

          if (isBlink && isBlinkError) {
            // Retry as regular (non-Blink) transaction
            console.log(
              "[WalletRPC] Blink transaction failed, retrying as regular transaction"
            );
            params.blink = false;
            data = await this.sendRPC("relay_tx", params);

            if (data.hasOwnProperty("error")) {
              errorMessage = data.error.message || errorMessage;
              failed = true;
              break;
            }
          } else if (isDoubleSpend) {
            // Double spend error - clear pending tx and suggest rescan
            console.warn(
              "[WalletRPC] Double spend detected, clearing pending transaction. User should rescan wallet."
            );
            this.pending_tx = null;
            errorMessage =
              "Transaction failed: Outputs already spent. Please rescan your wallet to sync with the blockchain.";
            failed = true;
            break;
          } else {
            errorMessage = errorMsg || errorMessage;
            failed = true;
            break;
          }
        }

        if (data.hasOwnProperty("result")) {
          const tx_hash = data.result.tx_hash;
          txHashList.push(tx_hash);
          if (note && note !== "") {
            this.saveTxNotes(tx_hash, note);
          }
          txSuccess = true;
        } else {
          errorMessage = "Invalid format of relay_tx RPC return message";
          failed = true;
          break;
        }
      } catch (e) {
        // If Blink transaction threw an error, try regular transaction as fallback
        if (isBlink && !txSuccess) {
          try {
            console.log(
              "[WalletRPC] Blink transaction exception, retrying as regular transaction"
            );
            params.blink = false;
            let data = await this.sendRPC("relay_tx", params);
            if (data.hasOwnProperty("result")) {
              const tx_hash = data.result.tx_hash;
              txHashList.push(tx_hash);
              if (note && note !== "") {
                this.saveTxNotes(tx_hash, note);
              }
              txSuccess = true;
            } else if (data.hasOwnProperty("error")) {
              errorMessage = data.error.message || e.toString();
              failed = true;
              break;
            }
          } catch (retryError) {
            failed = true;
            errorMessage = e.toString();
            break;
          }
        } else {
          failed = true;
          errorMessage = e.toString();
          break;
        }
      }
    }

    // for updating state on the correct page
    const gatewayEndpoint = isSweepAll
      ? "set_sweep_all_status"
      : "set_tx_status";

    if (!failed) {
      this.sendGateway(gatewayEndpoint, {
        code: 0,
        i18n: "notification.positive.sendSuccess",
        sending: false,
        txid: txHashList.length > 0 ? txHashList[0] : null,
        txidList: txHashList
      });

      if (address_book.hasOwnProperty("save") && address_book.save) {
        this.addAddressBook(
          address,
          address_book.description,
          address_book.name
        );
      }
      // no more pending txs, clear it out.
      this.pending_tx = null;

      // Save wallet immediately to persist tx_key for proof generation,
      // then schedule process restart. The internal_error fires ~9s after relay_tx
      // and deadlocks wallet-rpc, so we kill and restart the process.
      console.log(
        "[WalletRPC] TX sent successfully - saving wallet then scheduling restart"
      );
      this.backend.sendLog(
        "info",
        "Transaction sent successfully — scheduling wallet recovery"
      );
      this.saveWallet()
        .then(() => {
          console.log(
            "[WalletRPC] Wallet saved to disk, scheduling process restart in 5s"
          );
          setTimeout(() => {
            this.postTxRefresh();
          }, 5000);
        })
        .catch(() => {
          console.log(
            "[WalletRPC] Wallet save failed, scheduling process restart immediately"
          );
          setTimeout(() => {
            this.postTxRefresh();
          }, 2000);
        });

      return;
    }

    // no more pending txs, clear it out.
    this.pending_tx = null;
    this.sendGateway(gatewayEndpoint, {
      code: -1,
      message: errorMessage,
      sending: false
    });
  }

  // prepares params and provides a "confirm" popup to allow the user to check
  // send address and tx fees before sending
  // isSweepAll refers to if it's the sweep from service nodes page
  transfer(password, amount, address, priority, isSweepAll) {
    const cryptoCallback = (err, password_hash) => {
      if (err) {
        this.sendGateway("set_tx_status", {
          code: -1,
          i18n: "notification.errors.internalError",
          sending: false
        });
        return;
      }
      if (!this.isValidPasswordHash(password_hash)) {
        this.sendGateway("set_tx_status", {
          code: -1,
          i18n: "notification.errors.invalidPassword",
          sending: false
        });
        return;
      }

      amount = (parseFloat(amount) * this.getAtomicDivisor()).toFixed(0);

      const isSweepAllRPC = amount == this.wallet_state.unlocked_balance;
      const rpc_endpoint = isSweepAllRPC ? "sweep_all" : "transfer_split";

      // the call coming from the SN page will have address = wallet primary address
      const rpcSpecificParams = isSweepAllRPC
        ? {
            address,
            // gui wallet only supports one account currently
            account_index: 0,
            // sweep *all* funds from all subaddresses to the address specified
            subaddr_indices_all: true
          }
        : {
            destinations: [{ amount: amount, address: address }]
          };
      const params = {
        ...rpcSpecificParams,
        priority,
        do_not_relay: true,
        get_tx_metadata: true
      };

      // for updating state on the correct page
      const gatewayEndpoint = isSweepAll
        ? "set_sweep_all_status"
        : "set_tx_status";

      this.sendRPC(rpc_endpoint, params)
        .then(data => {
          if (data.hasOwnProperty("error") || !data.hasOwnProperty("result")) {
            let error = "";
            if (data.error && data.error.message) {
              error =
                data.error.message.charAt(0).toUpperCase() +
                data.error.message.slice(1);
            } else {
              error = `Incorrect result from ${rpc_endpoint} RPC call`;
            }
            this.sendGateway(gatewayEndpoint, {
              code: -1,
              message: error,
              sending: false
            });
            return;
          }

          this.pending_tx = {
            metadataList: data.result.tx_metadata_list
          };

          // async relayTransaction(metadataList, isBlink, addressSave, note, isSweepAll)
          // update state to show a confirm popup
          this.sendGateway(gatewayEndpoint, {
            code: 1,
            i18n: "strings.awaitingConfirmation",
            sending: false,
            txData: {
              // target address for a sweep all
              address: data.params.address,
              isSweepAll: isSweepAllRPC,
              amountList: data.result.amount_list,
              feeList: data.result.fee_list,
              priority: data.params.priority,
              // for a "send" tx
              destinations: data.params.destinations
            }
          });
        })
        .catch(err => {
          this.sendGateway(gatewayEndpoint, {
            code: -1,
            message: err.message,
            sending: false
          });
        });
    };

    crypto.pbkdf2(
      password,
      this.getPasswordSalt(),
      100000,
      64,
      "sha512",
      cryptoCallback
    );
  }

  purchaseONS(password, type, name, value, owner, backupOwner) {
    let _name = name.trim().toLowerCase();
    const _owner = owner.trim() === "" ? null : owner;
    const backup_owner = backupOwner.trim() === "" ? null : backupOwner;

    // the RPC accepts names with the .loki already appeneded only
    // can be lokinet_1y, lokinet_2y, lokinet_5y, lokinet_10y
    if (type.startsWith("lokinet")) {
      _name = _name + ".loki";
      value = value + ".loki";
    }

    crypto.pbkdf2(
      password,
      this.getPasswordSalt(),
      100000,
      64,
      "sha512",
      (err, password_hash) => {
        if (err) {
          this.sendGateway("set_ons_status", {
            code: -1,
            i18n: "notification.errors.internalError",
            sending: false
          });
          return;
        }
        if (!this.isValidPasswordHash(password_hash)) {
          this.sendGateway("set_ons_status", {
            code: -1,
            i18n: "notification.errors.invalidPassword",
            sending: false
          });
          return;
        }

        const params = {
          type,
          owner: _owner,
          backup_owner,
          name: _name,
          value
        };

        this.sendRPC("ons_buy_mapping", params).then(data => {
          if (data.hasOwnProperty("error")) {
            let error =
              data.error.message.charAt(0).toUpperCase() +
              data.error.message.slice(1);
            this.sendGateway("set_ons_status", {
              code: -1,
              message: error,
              sending: false
            });
            return;
          }

          this.purchasedNames[name.trim()] = type;

          // Fetch new records and then get the decrypted record for the one we just inserted
          setTimeout(() => this.updateLocalONSRecords(), 5000);

          this.sendGateway("set_ons_status", {
            code: 0,
            i18n: "notification.positive.namePurchased",
            sending: false
          });
        });
      }
    );
  }

  updateONSMapping(password, type, name, value, owner, backupOwner) {
    let _name = name.trim().toLowerCase();
    const _owner = owner.trim() === "" ? null : owner;
    const backup_owner = backupOwner.trim() === "" ? null : backupOwner;

    // updated records have type "lokinet" or "session"
    // UI passes the values without the extension
    if (type === "lokinet") {
      _name = _name + ".loki";
      value = value + ".loki";
    }

    crypto.pbkdf2(
      password,
      this.getPasswordSalt(),
      100000,
      64,
      "sha512",
      (err, password_hash) => {
        if (err) {
          this.sendGateway("set_ons_status", {
            code: -1,
            i18n: "notification.errors.internalError",
            sending: false
          });
          return;
        }
        if (!this.isValidPasswordHash(password_hash)) {
          this.sendGateway("set_ons_status", {
            code: -1,
            i18n: "notification.errors.invalidPassword",
            sending: false
          });
          return;
        }

        const params = {
          type,
          owner: _owner,
          backup_owner,
          name: _name,
          value
        };

        this.sendRPC("ons_update_mapping", params).then(data => {
          if (data.hasOwnProperty("error")) {
            let error =
              data.error.message.charAt(0).toUpperCase() +
              data.error.message.slice(1);
            this.sendGateway("set_ons_status", {
              code: -1,
              message: error,
              sending: false
            });
            return;
          }

          this.purchasedNames[name.trim()] = type;

          // Fetch new records and then get the decrypted record for the one we just inserted
          setTimeout(() => this.updateLocalONSRecords(), 5000);

          // Optimistically update our record
          const { onsRecords } = this.wallet_state;
          const newRecords = onsRecords.map(record => {
            if (
              record.type === type &&
              record.name &&
              record.name.toLowerCase() === _name
            ) {
              return {
                ...record,
                owner: _owner,
                backup_owner,
                value
              };
            }

            return record;
          });
          this.wallet_state.onsRecords = newRecords;
          this.sendGateway("set_wallet_data", { onsRecords: newRecords });

          this.sendGateway("set_ons_status", {
            code: 0,
            i18n: "notification.positive.onsRecordUpdated",
            sending: false
          });
        });
      }
    );
  }

  proveTransaction(txid, address, message) {
    const _address = address && address.trim() !== "" ? address.trim() : null;
    const _message = message && message.trim() !== "" ? message.trim() : null;

    const rpc_endpoint = _address ? "get_tx_proof" : "get_spend_proof";

    // Build params object, only including non-null values
    const params = { txid };
    if (_address) params.address = _address;
    if (_message) params.message = _message;

    console.log(
      `[WalletRPC] proveTransaction: endpoint=${rpc_endpoint}, params=`,
      JSON.stringify(params)
    );

    this.sendGateway("set_prove_transaction_status", {
      code: 1,
      message: "",
      state: {}
    });

    this.sendRPC(rpc_endpoint, params)
      .then(data => {
        console.log(
          `[WalletRPC] proveTransaction response:`,
          JSON.stringify(data)
        );

        if (data.hasOwnProperty("error")) {
          let error = "Unknown error";
          if (data.error && data.error.message) {
            error =
              data.error.message.charAt(0).toUpperCase() +
              data.error.message.slice(1);
          }
          console.log(`[WalletRPC] proveTransaction error:`, error);
          this.backend.sendLog("error", `Proof generation failed: ${error}`);
          this.sendGateway("set_prove_transaction_status", {
            code: -1,
            message: error,
            state: {}
          });
          return;
        }

        console.log(
          `[WalletRPC] proveTransaction success:`,
          JSON.stringify(data.result)
        );
        this.sendGateway("set_prove_transaction_status", {
          code: 0,
          message: "",
          state: {
            txid,
            ...(data.result || {})
          }
        });
      })
      .catch(err => {
        console.log(`[WalletRPC] proveTransaction exception:`, err);
        this.sendGateway("set_prove_transaction_status", {
          code: -1,
          message: err.toString(),
          state: {}
        });
      });
  }

  checkTransactionProof(signature, txid, address, message) {
    const _address = address.trim() === "" ? null : address;
    const _message = message.trim() === "" ? null : message;

    const rpc_endpoint = _address ? "check_tx_proof" : "check_spend_proof";
    const params = {
      txid,
      signature,
      address: _address,
      message: _message
    };

    this.sendGateway("set_check_transaction_status", {
      code: 1,
      message: "",
      state: {}
    });

    this.sendRPC(rpc_endpoint, params).then(data => {
      if (data.hasOwnProperty("error")) {
        let error =
          data.error.message.charAt(0).toUpperCase() +
          data.error.message.slice(1);
        this.sendGateway("set_check_transaction_status", {
          code: -1,
          message: error,
          state: {}
        });
        return;
      }

      this.sendGateway("set_check_transaction_status", {
        code: 0,
        message: "",
        state: {
          txid,
          ...(data.result || {})
        }
      });
    });
  }

  rescanBlockchain() {
    this.backend.sendLog("info", "Starting blockchain rescan from block 0...");
    this.backend.send("show_notification", {
      type: "info",
      color: "cyan",
      textColor: "dark",
      message: "Rescanning blockchain - this may take a while...",
      timeout: 10000
    });
    this.sendRPC("rescan_blockchain", {}, 600000).then(result => {
      if (result.hasOwnProperty("error")) {
        this.backend.sendLog("error", `Rescan failed: ${result.error.message || JSON.stringify(result.error)}`);
      } else {
        this.backend.sendLog("info", "Blockchain rescan complete");
        // Force balance refresh
        this.wallet_state.balance = null;
        this.wallet_state.unlocked_balance = null;
        this.heartbeatAction(true);
      }
    });
  }

  rescanSpent() {
    this.sendRPC("rescan_spent");
  }

  // Refresh RPC connection - closes and reopens the wallet to clear stuck state
  async refreshWallet() {
    console.log(
      "[WalletRPC] Refreshing RPC wallet connection (process restart)..."
    );
    this.backend.sendLog(
      "info",
      "Refreshing RPC wallet connection (process restart)..."
    );

    this.sendGateway("set_wallet_data", {
      status: {
        code: 0,
        message: "Refreshing RPC wallet connection..."
      }
    });

    await this.postTxRefresh();
  }

  // Automatic recovery after sending a TX.
  // wallet-rpc's internal refresh thread crashes with wallet_internal_error after
  // relay_tx, deadlocking its internal mutex. ALL RPCs hang after this.
  // The ONLY fix is to kill and restart the wallet-rpc process entirely.
  async postTxRefresh() {
    const walletName = this.wallet_state.name;
    const walletPassword = this.wallet_state.password;

    if (
      !walletName ||
      walletPassword == null ||
      !this.rpcPath ||
      !this.rpcArgs
    ) {
      console.log(
        "[WalletRPC] postTxRefresh: missing credentials or startup info, cannot recover"
      );
      return;
    }

    console.log(
      "[WalletRPC] postTxRefresh: killing and restarting wallet-rpc process"
    );

    // Stop all heartbeats and abandon the stuck RPC queue
    clearInterval(this.heartbeat);
    clearInterval(this.onsHeartbeat);
    this.stopSyncPoller();
    this.queue = new queue(1, Infinity);

    this.sendGateway("set_wallet_data", {
      status: {
        code: 0,
        message: "Syncing wallet after transaction..."
      }
    });

    // Kill the stuck wallet-rpc process
    if (this.walletRPCProcess) {
      try {
        // Remove all listeners to prevent the old close handler from interfering
        this.walletRPCProcess.removeAllListeners();
        this.walletRPCProcess.stdout.removeAllListeners();
        this.walletRPCProcess.stderr &&
          this.walletRPCProcess.stderr.removeAllListeners();
        this.walletRPCProcess.kill("SIGKILL");
        this.walletRPCProcess = null;
        console.log("[WalletRPC] postTxRefresh: killed wallet-rpc process");
        this.backend.sendLog(
          "warn",
          "Wallet RPC process killed for post-TX recovery"
        );
      } catch (e) {
        console.error(
          "[WalletRPC] postTxRefresh: error killing process:",
          e.message
        );
        this.backend.sendLog(
          "error",
          `postTxRefresh: error killing process: ${e.message}`
        );
      }
    }

    // Wait for the process to fully exit and the port to free up
    await new Promise(resolve => {
      const checkPort = () => {
        portscanner
          .checkPortStatus(this.port, this.hostname)
          .catch(() => "closed")
          .then(status => {
            if (status === "closed") {
              resolve();
            } else {
              setTimeout(checkPort, 500);
            }
          });
      };
      // Give it a moment to die first
      setTimeout(checkPort, 1500);
    });

    console.log(
      "[WalletRPC] postTxRefresh: port is free, starting new wallet-rpc process"
    );

    // Destroy old HTTP agent and create a fresh one
    if (this.agent) this.agent.destroy();
    this.agent = new http.Agent({ keepAlive: true, maxSockets: 1 });

    // Start a fresh wallet-rpc process with the same args
    try {
      const spawnOptions =
        process.platform === "win32" ? {} : { detached: true };
      this.walletRPCProcess = child_process.spawn(
        this.rpcPath,
        this.rpcArgs,
        spawnOptions
      );

      this.walletRPCProcess.stdout.on("data", data => {
        process.stdout.write(`Wallet: ${data}`);
        let lines = data.toString().split("\n");
        let match,
          height = null;
        let isRPCSyncing = false;
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.length === 0) continue;

          // Forward important wallet-rpc output to troubleshooting logs
          const levelMatch = trimmed.match(
            /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s+([EWID])\s+/
          );
          if (levelMatch) {
            const lvl = levelMatch[1];
            // Only log errors and warnings, skip routine INFO messages
            if (lvl === "E") {
              this.backend.sendLog("error", `[wallet-rpc] ${trimmed}`);
            } else if (lvl === "W") {
              this.backend.sendLog("warn", `[wallet-rpc] ${trimmed}`);
            } else if (lvl === "I" && (
              trimmed.includes("Refresh done") ||
              trimmed.includes("Received money") ||
              trimmed.includes("Spent money") ||
              (trimmed.includes("balance") && !trimmed.includes("Calling RPC method"))
            )) {
              // Only log important INFO messages, exclude RPC call spam
              this.backend.sendLog("info", `[wallet-rpc] ${trimmed}`);
            }
          } else if (
            trimmed.includes("Equilibria") ||
            trimmed.includes("THROW EXCEPTION") ||
            trimmed.includes("Logging to") ||
            trimmed.includes("Binding on") ||
            trimmed.includes("wallet RPC server") ||
            trimmed.includes("Loaded wallet")
          ) {
            const isErr = trimmed.includes("THROW EXCEPTION");
            this.backend.sendLog(
              isErr ? "error" : "info",
              `[wallet-rpc] ${trimmed}`
            );
          }

          for (const regex of this.height_regexes) {
            match = line.match(regex.string);
            if (match) {
              height = regex.height(match);
              isRPCSyncing = true;
              break;
            }
          }
        }
        this.sendGateway("set_wallet_data", { isRPCSyncing });
        this.isRPCSyncing = isRPCSyncing;
        if (height && Date.now() - this.last_height_send_time > 1000) {
          this.last_height_send_time = Date.now();
          this.sendGateway("set_wallet_data", { info: { height } });
        }
      });
      this.walletRPCProcess.on("error", err => {
        process.stderr.write(`Wallet: ${err}`);
        this.backend.sendLog("error", `[wallet-rpc] Process error: ${err}`);
      });
      this.walletRPCProcess.on("close", code => {
        process.stderr.write(`Wallet: exited with code ${code} \n`);
        let exitMsg = `[wallet-rpc] Process exited with code ${code}`;
        if (code !== null && (code > 255 || code < 0)) {
          exitMsg += ` (Windows error code; hex 0x${(code >>> 0).toString(16).toUpperCase()})`;
        }
        this.backend.sendLog("warn", exitMsg);
        this.walletRPCProcess = null;
        if (this.agent) this.agent.destroy();
      });
      if (this.walletRPCProcess.stderr) {
        this.walletRPCProcess.stderr.on("data", data => {
          const lines = String(data).split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) this.backend.sendLog("error", `[wallet-rpc stderr] ${trimmed}`);
          }
        });
      }

      // Wait for wallet-rpc to be ready (responds to get_languages)
      await new Promise((resolve, reject) => {
        let attempts = 0;
        const intrvl = setInterval(() => {
          attempts++;
          if (attempts > 30) {
            clearInterval(intrvl);
            reject(new Error("Timed out waiting for wallet-rpc to start"));
            return;
          }
          this.sendRPC("get_languages").then(data => {
            if (!data.hasOwnProperty("error")) {
              clearInterval(intrvl);
              resolve();
            }
          });
        }, 1000);
      });

      console.log("[WalletRPC] postTxRefresh: wallet-rpc process ready");
      this.backend.sendLog("info", "Wallet RPC restarted and ready");

      // Open the wallet
      const openResult = await this.sendRPC(
        "open_wallet",
        {
          filename: walletName,
          password: walletPassword
        },
        30000
      );

      if (openResult.hasOwnProperty("error")) {
        console.error(
          "[WalletRPC] postTxRefresh: failed to open wallet:",
          openResult.error
        );
      } else {
        console.log(
          "[WalletRPC] postTxRefresh: wallet opened, scanning blocks"
        );
        await this.sendRPC("refresh", {}, 120000);
        console.log("[WalletRPC] postTxRefresh: block scan complete");
      }
    } catch (e) {
      console.error("[WalletRPC] postTxRefresh: restart failed:", e.message);
      this.backend.sendLog(
        "error",
        `postTxRefresh restart failed: ${e.message}`
      );
    }

    // Reset balance tracking for fresh data
    this.wallet_state.balance = null;
    this.wallet_state.unlocked_balance = null;
    this.wallet_state.accrued_balance = null;
    this.wallet_state.accrued_balance_next_payout = null;

    this.startHeartbeat();
    console.log("[WalletRPC] postTxRefresh: recovery complete");
    this.backend.sendLog("info", "Post-TX recovery complete — wallet synced");
  }

  getPrivateKeys(password) {
    crypto.pbkdf2(
      password,
      this.getPasswordSalt(),
      100000,
      64,
      "sha512",
      (err, password_hash) => {
        if (err) {
          this.sendGateway("set_wallet_data", {
            secret: {
              mnemonic: "notification.errors.internalError",
              spend_key: -1,
              view_key: -1
            }
          });
          return;
        }
        if (!this.isValidPasswordHash(password_hash)) {
          this.sendGateway("set_wallet_data", {
            secret: {
              mnemonic: "notification.errors.invalidPassword",
              spend_key: -1,
              view_key: -1
            }
          });
          return;
        }
        Promise.all([
          this.sendRPC("query_key", { key_type: "mnemonic" }),
          this.sendRPC("query_key", { key_type: "spend_key" }),
          this.sendRPC("query_key", { key_type: "view_key" })
        ]).then(data => {
          let wallet = {
            secret: {
              mnemonic: "",
              spend_key: "",
              view_key: ""
            }
          };
          for (let n of data) {
            if (n.hasOwnProperty("error") || !n.hasOwnProperty("result")) {
              continue;
            }
            wallet.secret[n.params.key_type] = n.result.key;
          }

          this.sendGateway("set_wallet_data", wallet);
        });
      }
    );
  }

  getAddressList() {
    return new Promise(resolve => {
      Promise.all([
        this.sendRPC("get_address", { account_index: 0 }),
        this.sendRPC("getbalance", { account_index: 0 })
      ]).then(data => {
        for (let n of data) {
          if (n.hasOwnProperty("error") || !n.hasOwnProperty("result")) {
            resolve({});
            return;
          }
        }

        let num_unused_addresses = 10;

        let wallet = {
          info: {
            address: data[0].result.address,
            balance: data[1].result.balance,
            unlocked_balance: data[1].result.unlocked_balance,
            accrued_balance: data[1].result.accrued_balance,
            accrued_balance_next_payout:
              data[1].result.accrued_balance_next_payout
            // num_unspent_outputs: data[1].result.num_unspent_outputs
          },
          address_list: {
            primary: [],
            used: [],
            unused: []
          }
        };

        for (let address of data[0].result.addresses) {
          address.balance = null;
          address.unlocked_balance = null;
          address.num_unspent_outputs = null;

          if (data[1].result.hasOwnProperty("per_subaddress")) {
            for (let address_balance of data[1].result.per_subaddress) {
              if (address_balance.address_index == address.address_index) {
                address.balance = address_balance.balance;
                address.unlocked_balance = address_balance.unlocked_balance;
                address.num_unspent_outputs =
                  address_balance.num_unspent_outputs;
                break;
              }
            }
          }

          if (address.address_index == 0) {
            wallet.address_list.primary.push(address);
          } else if (address.used) {
            wallet.address_list.used.push(address);
          } else {
            wallet.address_list.unused.push(address);
          }
        }

        // limit to 10 unused addresses
        wallet.address_list.unused = wallet.address_list.unused.slice(0, 10);

        if (wallet.address_list.unused.length < num_unused_addresses) {
          for (
            let n = wallet.address_list.unused.length;
            n < num_unused_addresses;
            n++
          ) {
            this.sendRPC("create_address", {
              account_index: 0
            }).then(data => {
              wallet.address_list.unused.push(data.result);
              if (wallet.address_list.unused.length == num_unused_addresses) {
                // should sort them here
                resolve(wallet);
              }
            });
          }
        } else {
          resolve(wallet);
        }
      });
    });
  }

  getTransactions() {
    return new Promise(resolve => {
      this.sendRPC("get_transfers", {
        in: true,
        out: true,
        pending: true,
        failed: true,
        pool: true
      }).then(data => {
        if (data.hasOwnProperty("error") || !data.hasOwnProperty("result")) {
          resolve({});
          return;
        }
        let wallet = {
          transactions: {
            tx_list: []
          }
        };

        const types = [
          "in",
          "out",
          "pending",
          "failed",
          "pool",
          "miner",
          "snode",
          "gov",
          "stake"
        ];
        types.forEach(type => {
          if (data.result.hasOwnProperty(type)) {
            wallet.transactions.tx_list = wallet.transactions.tx_list.concat(
              data.result[type]
            );
          }
        });

        wallet.transactions.tx_list.sort(function(a, b) {
          if (a.timestamp < b.timestamp) return 1;
          if (a.timestamp > b.timestamp) return -1;
          return 0;
        });
        resolve(wallet);
      });
    });
  }

  getAddressBook() {
    return new Promise(resolve => {
      this.sendRPC("get_address_book").then(data => {
        if (data.hasOwnProperty("error") || !data.hasOwnProperty("result")) {
          resolve({});
          return;
        }
        let wallet = {
          address_list: {
            address_book: [],
            address_book_starred: []
          }
        };

        const entries = data.result.entries || [];
        const addresses = entries.map(e => {
          const entry = { ...e };
          const desc = entry.description.split("::");
          if (desc.length == 3) {
            entry.starred = desc[0] == "starred";
            entry.name = desc[1];
            entry.description = desc[2];
          } else if (desc.length == 2) {
            entry.starred = false;
            entry.name = desc[0];
            entry.description = desc[1];
          } else {
            entry.starred = false;
            entry.name = entry.description;
            entry.description = "";
          }

          return entry;
        });

        for (const entry of addresses) {
          const list = entry.starred
            ? wallet.address_list.address_book_starred
            : wallet.address_list.address_book;
          const hasAddress = list.find(a => {
            return a.address === entry.address && a.name === entry.name;
          });
          if (!hasAddress) {
            list.push(entry);
          }
        }

        resolve(wallet);
      });
    });
  }

  deleteAddressBook(index = false) {
    if (index !== false) {
      this.sendRPC("delete_address_book", { index: index }).then(() => {
        this.saveWallet().then(() => {
          this.getAddressBook().then(data => {
            this.sendGateway("set_wallet_data", data);
          });
        });
      });
    }
  }

  addAddressBook(
    address,
    description = "",
    name = "",
    starred = false,
    index = false
  ) {
    if (index !== false) {
      this.sendRPC("delete_address_book", { index: index }).then(() => {
        this.addAddressBook(address, description, name, starred);
      });
      return;
    }

    let params = {
      address
    };

    let desc = [];
    if (starred) {
      desc.push("starred");
    }
    desc.push(name, description);

    params.description = desc.join("::");

    this.sendRPC("add_address_book", params).then(() => {
      this.saveWallet().then(() => {
        this.getAddressBook().then(data => {
          this.sendGateway("set_wallet_data", data);
        });
      });
    });
  }

  saveTxNotes(txid, note) {
    this.sendRPC("set_tx_notes", { txids: [txid], notes: [note] }).then(() => {
      this.getTransactions().then(wallet => {
        this.sendGateway("set_wallet_data", wallet);
      });
    });
  }

  exportKeyImages(password, filename = null) {
    crypto.pbkdf2(
      password,
      this.getPasswordSalt(),
      100000,
      64,
      "sha512",
      (err, password_hash) => {
        if (err) {
          this.sendGateway("show_notification", {
            type: "negative",
            i18n: "notification.errors.internalError",
            timeout: 2000
          });
          return;
        }
        if (!this.isValidPasswordHash(password_hash)) {
          this.sendGateway("show_notification", {
            type: "negative",
            i18n: "notification.errors.invalidPassword",
            timeout: 2000
          });
          return;
        }

        if (filename == null) {
          filename = path.join(
            this.wallet_data_dir,
            "images",
            this.wallet_state.name,
            "key_image_export"
          );
        } else {
          filename = path.join(filename, "key_image_export");
        }

        const onError = () =>
          this.sendGateway("show_notification", {
            type: "negative",
            i18n: "notification.errors.keyImages.exporting",
            timeout: 2000
          });

        this.sendRPC("export_key_images")
          .then(data => {
            if (
              data.hasOwnProperty("error") ||
              !data.hasOwnProperty("result")
            ) {
              onError();
              return;
            }

            if (data.result.signed_key_images) {
              fs.outputJSONSync(filename, data.result.signed_key_images);
              this.sendGateway("show_notification", {
                i18n: [
                  "notification.positive.keyImages.exported",
                  { filename }
                ],
                timeout: 2000
              });
            } else {
              this.sendGateway("show_notification", {
                type: "warning",
                textColor: "black",
                i18n: "notification.warnings.noKeyImageExport",
                timeout: 2000
              });
            }
          })
          .catch(onError);
      }
    );
  }

  importKeyImages(password, filename = null) {
    crypto.pbkdf2(
      password,
      this.getPasswordSalt(),
      100000,
      64,
      "sha512",
      (err, password_hash) => {
        if (err) {
          this.sendGateway("show_notification", {
            type: "negative",
            i18n: "notification.errors.internalError",
            timeout: 2000
          });
          return;
        }
        if (!this.isValidPasswordHash(password_hash)) {
          this.sendGateway("show_notification", {
            type: "negative",
            i18n: "notification.errors.invalidPassword",
            timeout: 2000
          });
          return;
        }

        if (filename == null) {
          filename = path.join(
            this.wallet_data_dir,
            "images",
            this.wallet_state.name,
            "key_image_export"
          );
        }

        const onError = i18n =>
          this.sendGateway("show_notification", {
            type: "negative",
            i18n,
            timeout: 2000
          });

        fs.readJSON(filename)
          .then(signed_key_images => {
            this.sendRPC("import_key_images", {
              signed_key_images
            }).then(data => {
              if (
                data.hasOwnProperty("error") ||
                !data.hasOwnProperty("result")
              ) {
                onError("notification.errors.keyImages.importing");
                return;
              }

              this.sendGateway("show_notification", {
                i18n: "notification.positive.keyImages.imported",
                timeout: 2000
              });
            });
          })
          .catch(() => onError("notification.errors.keyImages.reading"));
      }
    );
  }

  exportTransfers(password, filename = null) {
    crypto.pbkdf2(
      password,
      this.getPasswordSalt(),
      100000,
      64,
      "sha512",
      (err, password_hash) => {
        if (err) {
          this.sendGateway("show_notification", {
            type: "negative",
            i18n: "notification.errors.internalError",
            timeout: 2000
          });
          return;
        }
        if (!this.isValidPasswordHash(password_hash)) {
          this.sendGateway("show_notification", {
            type: "negative",
            i18n: "notification.errors.invalidPassword",
            timeout: 2000
          });
          return;
        }

        if (filename == null) {
          filename = path.join(
            this.wallet_data_dir,
            "CSV",
            this.wallet_state.name,
            "transfers.csv"
          );
        } else {
          filename = path.join(filename, "transfers.csv");
        }

        const onError = () =>
          this.sendGateway("show_notification", {
            type: "negative",
            i18n: "notification.errors.exportTransfers",
            timeout: 2000
          });

        this.sendRPC("export_transfers")
          .then(data => {
            if (
              data.hasOwnProperty("error") ||
              !data.hasOwnProperty("result")
            ) {
              onError();
              return;
            }

            if (data.result.data) {
              fs.outputFileSync(filename, data.result.data);
              this.sendGateway("show_notification", {
                i18n: ["notification.positive.exportTransfers", { filename }],
                timeout: 2000
              });
            } else {
              this.sendGateway("show_notification", {
                type: "warning",
                textColor: "black",
                i18n: "notification.warnings.noExportTransfers",
                timeout: 2000
              });
            }
          })
          .catch(onError);
      }
    );
  }

  copyOldGuiWallets(wallets) {
    this.sendGateway("set_old_gui_import_status", {
      code: 1,
      failed_wallets: []
    });

    /*
        Old wallets were in the following format:
            wallets:
                <name>:
                    <name>
                    <name>.keys
                    <name>.address.txt

        We need to change it so it becomes:
            wallets:
                <name>
                <name>.keys
                <name>.address.txt
        */

    const failed_wallets = [];

    for (const wallet of wallets) {
      const { type, directory } = wallet;

      const old_gui_path = path.join(this.wallet_dir, "old-gui");
      const dir_path = path.join(this.wallet_dir, directory);
      const stat = fs.statSync(dir_path);
      if (!stat.isDirectory()) continue;

      // Make sure the directory has the keys file
      const wallet_file = path.join(dir_path, directory);
      const key_file = wallet_file + ".keys";

      // If we don't have them then don't bother copying
      if (!fs.existsSync(key_file)) {
        failed_wallets.push(directory);
        continue;
      }

      // Copy out the file into the relevant directory
      const destination = path.join(this.dirs[type], "wallets");
      if (!fs.existsSync(destination)) fs.mkdirpSync(destination);

      try {
        // Don't move file if we already have copied the keys file
        if (fs.existsSync(path.join(destination, directory) + ".keys")) {
          failed_wallets.push(directory);
          continue;
        }

        // Archive the folder
        if (!fs.existsSync(old_gui_path)) fs.mkdirpSync(old_gui_path);
        const archive_path = path.join(old_gui_path, directory);
        fs.moveSync(dir_path, archive_path, { overwrite: true });

        // Copy contents of archived folder into the wallet folder
        fs.copySync(archive_path, this.wallet_dir, { overwrite: true });
      } catch (e) {
        failed_wallets.push(directory);
        continue;
      }
    }

    this.sendGateway("set_old_gui_import_status", {
      code: 0,
      failed_wallets
    });
    this.listWallets();
  }

  // Helper function to scan a directory for wallets
  _scanWalletDirectory(dir_to_scan, net_type) {
    let wallets = [];
    let directories = [];

    if (!dir_to_scan || !fs.existsSync(dir_to_scan)) {
      return { wallets, directories };
    }

    let walletFiles = [];
    try {
      walletFiles = fs.readdirSync(dir_to_scan);
      console.log(`[WalletRPC] Scanning ${net_type} wallets in: ${dir_to_scan}`);
      console.log(`[WalletRPC] Found ${walletFiles.length} files/directories`);
    } catch (e) {
      console.error(`[WalletRPC] Error reading wallet directory ${dir_to_scan}:`, e);
      return { wallets, directories };
    }

    walletFiles.forEach(filename => {
      try {
        // Skip system files and special directories
        if ([".DS_Store", ".DS_Store?", "._.DS_Store", ".Spotlight-V100",
             ".Trashes", "ehthumbs.db", "Thumbs.db", "old-gui", "testnet", "stagenet", "legacy", "mainnet"].includes(filename)) {
          return;
        }

        const name = path.join(dir_to_scan, filename);
        const stat = fs.statSync(name);

        if (stat.isDirectory()) {
          // Check if it's an old gui wallet
          const wallet_file = path.join(name, filename);
          const key_file = wallet_file + ".keys";
          if (fs.existsSync(key_file)) {
            directories.push(filename);
          }
          return;
        }

        // Exclude all files without keys
        if (path.extname(filename) !== ".keys") return;

        const wallet_name = path.parse(filename).name;
        if (!wallet_name) return;

        let wallet_data = {
          name: wallet_name,
          address: null,
          password_protected: null,
          hardware_wallet: false,
          net_type: net_type  // Add network type to wallet data
        };

        // Read metadata
        if (fs.existsSync(path.join(dir_to_scan, wallet_name + ".meta.json"))) {
          let meta = fs.readFileSync(path.join(dir_to_scan, wallet_name + ".meta.json"), "utf8");
          if (meta) {
            meta = JSON.parse(meta);
            wallet_data.address = meta.address;
            wallet_data.password_protected = meta.password_protected;
          }
        } else if (fs.existsSync(path.join(dir_to_scan, wallet_name + ".address.txt"))) {
          let address = fs.readFileSync(path.join(dir_to_scan, wallet_name + ".address.txt"), "utf8");
          if (address) {
            wallet_data.address = address;
          }
        }

        if (fs.existsSync(path.join(dir_to_scan, wallet_name + ".hwdev.txt"))) {
          wallet_data.hardware_wallet = true;
        }

        wallets.push(wallet_data);
      } catch (e) {
        // Something went wrong
      }
    });

    return { wallets, directories };
  }

  listWallets(legacy = false, addressPatch = null) {
    let wallets = {
      list: [],
      directories: []
    };

    // Use wallet_data_dir as the base (e.g., wallets/)
    // Network-specific folders are wallets/mainnet, wallets/testnet, etc.
    let base_wallet_dir = this.wallet_data_dir;

    if (!base_wallet_dir) {
      base_wallet_dir = path.join(process.cwd(), "wallets");
    }

    // Ensure base directory exists
    if (!fs.existsSync(base_wallet_dir)) {
      fs.mkdirpSync(base_wallet_dir);
    }

    // Scan mainnet wallets (wallets/mainnet)
    const mainnetDir = path.join(base_wallet_dir, "mainnet");
    if (!fs.existsSync(mainnetDir)) {
      fs.mkdirpSync(mainnetDir);
    }
    const mainnetResult = this._scanWalletDirectory(mainnetDir, "mainnet");
    wallets.list.push(...mainnetResult.wallets);
    wallets.directories.push(...mainnetResult.directories);

    // Scan testnet wallets (wallets/testnet)
    const testnetDir = path.join(base_wallet_dir, "testnet");
    if (!fs.existsSync(testnetDir)) {
      fs.mkdirpSync(testnetDir);
    }
    const testnetResult = this._scanWalletDirectory(testnetDir, "testnet");
    wallets.list.push(...testnetResult.wallets);

    // Scan stagenet wallets (wallets/stagenet) - just in case
    const stagenetDir = path.join(base_wallet_dir, "stagenet");
    if (fs.existsSync(stagenetDir)) {
      const stagenetResult = this._scanWalletDirectory(stagenetDir, "stagenet");
      wallets.list.push(...stagenetResult.wallets);
    }

    // Scan legacy wallets (wallets/legacy)
    const legacyDir = path.join(base_wallet_dir, "legacy");
    if (!fs.existsSync(legacyDir)) {
      fs.mkdirpSync(legacyDir);
    }
    const legacyResult = this._scanWalletDirectory(legacyDir, "legacy");
    wallets.list.push(...legacyResult.wallets);

    console.log(`[WalletRPC] Total wallets found: ${wallets.list.length}`);

    // Check for legacy wallet files
    if (legacy) {
      wallets.legacy = [];
      let legacy_paths = [];
      if (os.platform() == "win32") {
        legacy_paths = ["C:\\ProgramData\\Loki"];
      } else {
        legacy_paths = [path.join(os.homedir(), "Loki")];
      }
      for (var i = 0; i < legacy_paths.length; i++) {
        try {
          let legacy_config_path = path.join(
            legacy_paths[i],
            "config",
            "wallet_info.json"
          );
          if (this.net_type === "test") {
            legacy_config_path = path.join(
              legacy_paths[i],
              "testnet",
              "config",
              "wallet_info.json"
            );
          }
          if (!fs.existsSync(legacy_config_path)) {
            continue;
          }

          let legacy_config = JSON.parse(
            fs.readFileSync(legacy_config_path, "utf8")
          );
          let legacy_wallet_path = legacy_config.wallet_filepath;
          if (!fs.existsSync(legacy_wallet_path)) {
            continue;
          }

          let legacy_address = "";
          if (fs.existsSync(legacy_wallet_path + ".address.txt")) {
            legacy_address = fs.readFileSync(
              legacy_wallet_path + ".address.txt",
              "utf8"
            );
          }
          wallets.legacy.push({
            path: legacy_wallet_path,
            address: legacy_address
          });
        } catch (e) {
          // Something went wrong
        }
      }
    }

    // Ensure newly created/restored wallet has address in list (in case .address.txt not read yet)
    if (addressPatch && addressPatch.name && addressPatch.address) {
      const entry = wallets.list.find(w => w.name === addressPatch.name);
      if (entry && !entry.address) {
        entry.address = addressPatch.address;
      }
    }

    console.log(`[WalletRPC] Found ${wallets.list.length} wallets in list`);
    this.sendGateway("wallet_list", wallets);
  }

  changeWalletPassword(old_password, new_password) {
    crypto.pbkdf2(
      old_password,
      this.getPasswordSalt(),
      100000,
      64,
      "sha512",
      (err, password_hash) => {
        if (err) {
          this.sendGateway("show_notification", {
            type: "negative",
            i18n: "notification.errors.internalError",
            timeout: 2000
          });
          return;
        }
        if (!this.isValidPasswordHash(password_hash)) {
          this.sendGateway("show_notification", {
            type: "negative",
            i18n: "notification.errors.invalidOldPassword",
            timeout: 2000
          });
          return;
        }

        this.sendRPC("change_wallet_password", {
          old_password,
          new_password
        }).then(data => {
          if (data.hasOwnProperty("error") || !data.hasOwnProperty("result")) {
            this.sendGateway("show_notification", {
              type: "negative",
              i18n: "notification.errors.changingPassword",
              timeout: 2000
            });
            return;
          }

          // store hash of the password so we can check against it later when requesting private keys, or for sending txs
          // For remote wallets, this.auth[2] might be null, so generate a salt if needed
          const salt =
            this.auth[2] ||
            crypto
              .randomBytes(32)
              .toString("hex")
              .substr(0, 32);
          this.wallet_state.password_hash = crypto
            .pbkdf2Sync(new_password, salt, 100000, 64, "sha512")
            .toString("hex");

          this.sendGateway("show_notification", {
            i18n: "notification.positive.passwordUpdated",
            timeout: 2000
          });
        });
      }
    );
  }

  deleteWallet(password) {
    crypto.pbkdf2(
      password,
      this.getPasswordSalt(),
      100000,
      64,
      "sha512",
      (err, password_hash) => {
        if (err) {
          this.sendGateway("show_notification", {
            type: "negative",
            i18n: "notification.errors.internalError",
            timeout: 2000
          });
          return;
        }
        if (!this.isValidPasswordHash(password_hash)) {
          this.sendGateway("show_notification", {
            type: "negative",
            i18n: "notification.errors.invalidPassword",
            timeout: 2000
          });
          return;
        }

        this.sendGateway("show_loading", {
          message: "Deleting wallet"
        });

        let wallet_path = path.join(this.wallet_dir, this.wallet_state.name);
        this.closeWallet().then(() => {
          try {
            if (fs.existsSync(wallet_path + ".keys"))
              fs.unlinkSync(wallet_path + ".keys");
            if (fs.existsSync(wallet_path + ".address.txt"))
              fs.unlinkSync(wallet_path + ".address.txt");
            if (fs.existsSync(wallet_path)) fs.unlinkSync(wallet_path);
          } catch (e) {
            console.warn(`Failed to delete wallet files: ${e}`);
          }

          this.listWallets();
          this.sendGateway("hide_loading");
          this.sendGateway("return_to_wallet_select");
        });
      }
    );
  }

  async saveWallet() {
    await this.sendRPC("store");
  }

  async closeWallet() {
    clearInterval(this.heartbeat);
    clearInterval(this.onsHeartbeat);
    this.stopSyncPoller();
    this.wallet_state = {
      open: false,
      name: "",
      password_hash: null,
      password: null,
      balance: null,
      unlocked_balance: null,
      accrued_balance: null,
      accrued_balance_next_payout: null,
      onsRecords: []
    };

    this.purchasedNames = {};

    await this.saveWallet();
    await this.sendRPC("close_wallet");
  }

  sendGateway(method, data) {
    // if wallet is closed, do not send any wallet data to gateway
    // this is for the case that we close the wallet at the same
    // after another action has started, but before it has finished
    if (!this.wallet_state.open && method == "set_wallet_data") {
      return;
    }
    this.backend.send(method, data);
  }

  // Update the daemon address for the wallet-rpc (used when manually changing daemon)
  setDaemon(host, port) {
    const address = `${host}:${port}`;
    console.log(`[WalletRPC] Setting daemon address to: ${address}`);
    this.backend.sendLog("info", `Updating wallet daemon to: ${address}`);

    return this.sendRPC("set_daemon", {
      address: address,
      trusted: false
    }).then(data => {
      if (data.hasOwnProperty("error")) {
        console.log(`[WalletRPC] set_daemon error:`, data.error);
        this.backend.sendLog("warn", `Failed to set daemon: ${data.error.message || "unknown error"}`);
        return false;
      }
      console.log(`[WalletRPC] Daemon address updated successfully`);
      this.backend.sendLog("info", `Wallet daemon updated to ${address}`);
      return true;
    }).catch(err => {
      console.log(`[WalletRPC] set_daemon exception:`, err);
      return false;
    });
  }

  sendRPC(method, params = {}, timeout = 0) {
    let id = this.id++;
    const url = `${this.protocol}${this.hostname}:${this.port}/json_rpc`;
    const body = {
      jsonrpc: "2.0",
      id: id,
      method: method
    };
    if (Object.keys(params).length !== 0) {
      body.params = params;
    }

    const headers = { "Content-Type": "application/json" };

    const fetchOptions = {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      agent: this.agent
    };
    if (timeout > 0) {
      fetchOptions.signal = AbortSignal.timeout(timeout);
    }

    return this.queue.add(() => {
      return fetch(url, fetchOptions)
        .then(res => res.json())
        .then(response => {
          if (response.hasOwnProperty("error")) {
            return {
              method: method,
              params: params,
              error: response.error
            };
          }
          return {
            method: method,
            params: params,
            result: response.result
          };
        })
        .catch(error => {
          return {
            method: method,
            params: params,
            error: {
              code: -1,
              message: "Cannot connect to wallet-rpc",
              cause: error.cause
            }
          };
        });
    });
  }

  getRPC(parameter, params = {}) {
    return this.sendRPC(`get_${parameter}`, params);
  }

  async quit() {
    return new Promise(resolve => {
      // If using remote wallet RPC, nothing to quit
      if (!this.walletRPCProcess) {
        resolve();
        return;
      }

      // Register process exit handler and absolute force-kill safety net
      this.walletRPCProcess.on("close", () => {
        this.agent.destroy();
        clearTimeout(this.forceKill);
        resolve();
      });

      this.forceKill = setTimeout(() => {
        if (this.walletRPCProcess) {
          this.walletRPCProcess.kill("SIGKILL");
        }
      }, 30000);

      // Wait for store + close_wallet to complete, then send SIGTERM for graceful shutdown.
      // Previously a 2500ms timer fired regardless, killing the process before store
      // could finish — causing the wallet to lose sync progress and rescan from block 1.
      this.closeWallet()
        .then(() => {
          if (this.walletRPCProcess) {
            this.walletRPCProcess.kill("SIGTERM");
          }
        })
        .catch(() => {
          if (this.walletRPCProcess) {
            this.walletRPCProcess.kill("SIGTERM");
          }
        });
    });
  }
}
