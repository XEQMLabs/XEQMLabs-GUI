import { Daemon } from "./daemon";
import { WalletRPC } from "./wallet-rpc";
import { SCEE } from "./SCEE-Node";
import { dialog } from "electron";
import semver from "semver";
import axios from "axios";
import { version } from "../../../package.json";
const bunyan = require("bunyan");

const WebSocket = require("ws");
const electron = require("electron");
const os = require("os");
const fs = require("fs-extra");
const path = require("upath");
const objectAssignDeep = require("object-assign-deep");

const { ipcMain: ipc } = electron;

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"];

export class Backend {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.daemon = null;
    this.walletd = null;
    this.wss = null;
    this.token = null;
    this.config_dir = null;
    this.wallet_dir = null;
    this.config_file = null;
    this.config_data = {};
    this.scee = new SCEE();
    this.log = null;
  }

  init(config) {
    // Store all data within the application folder for portability
    // Each copy of the wallet has its own isolated config and data
    const appDir = process.cwd();
    const configDir = path.join(appDir, "data");

    this.wallet_dir = path.join(appDir, "wallets");
    this.config_dir = configDir;

    // Create data directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirpSync(configDir);
    }

    this.config_file = path.join(this.config_dir, "config.json");

    const daemon = {
      type: "local",  // Default to local - no public remote nodes available
      p2p_bind_ip: "0.0.0.0",
      p2p_bind_port: 9230,
      rpc_bind_ip: "127.0.0.1",
      rpc_bind_port: 9231,
      zmq_rpc_bind_ip: "127.0.0.1",
      out_peers: -1,
      in_peers: -1,
      limit_rate_up: -1,
      limit_rate_down: -1,
      log_level: 0
    };

    const daemons = {
      mainnet: {
        ...daemon,
        type: "local",  // Mainnet is offline - use local mode for offline wallet creation
        remote_host: "seed1.equilibria.network",
        remote_port: 9231
      },
      stagenet: {
        ...daemon,
        type: "local",
        p2p_bind_port: 38153,
        rpc_bind_port: 38154
      },
      testnet: {
        ...daemon,
        type: "local",  // No public remote nodes available - use local mode
        remote_host: "84.247.143.210",
        remote_port: 38157,
        p2p_bind_port: 38156,
        rpc_bind_port: 38157
      },
      legacy: {
        ...daemon,
        type: "remote",  // Legacy mainnet has working remote nodes
        remote_host: "us.equilibriacc.com",
        remote_port: 9231,
        p2p_bind_port: 19230,
        rpc_bind_port: 19231
      }
    };

    // Default values
    // Use wallets folder in the application directory
    const defaultWalletDir = path.join(process.cwd(), "wallets");
    this.defaults = {
      daemons: objectAssignDeep({}, daemons),
      app: {
        data_dir: this.config_dir,
        wallet_data_dir: defaultWalletDir,
        ws_bind_port: 12313,
        net_type: "legacy"
      },
      wallet: {
        type: "local",
        rpc_bind_port: 22026,
        log_level: 2  // Debug level for troubleshooting
      }
    };

    this.config_data = {
      // Copy all the properties of defaults
      ...objectAssignDeep({}, this.defaults),
      appearance: {
        theme: "dark"
      }
    };

    // New XEQ mainnet seed nodes (mainnet currently offline)
    this.remotes = [
      {
        host: "seed1.equilibria.network",
        port: "9231"
      },
      {
        host: "seed2.equilibria.network",
        port: "9231"
      },
      {
        host: "seed3.equilibria.network",
        port: "9231"
      },
      {
        host: "seed4.equilibria.network",
        port: "9231"
      },
      {
        host: "seed5.equilibria.network",
        port: "9231"
      }
    ];

    // Legacy mainnet remote nodes (working nodes on original XEQ network)
    this.legacyRemotes = [
      {
        host: "us.equilibriacc.com",
        port: "9231"
      },
      {
        host: "eu.equilibriacc.com",
        port: "9231"
      },
      {
        host: "asia.equilibriacc.com",
        port: "9231"
      }
    ];

    this.token = config.token;

    this.wss = new WebSocket.Server({
      port: config.port,
      maxPayload: 10 * 1024 * 1024 // 10 MB cap; loopback only, prevents unbounded memory allocation
    });

    this.wss.on("connection", ws => {
      ws.on("message", data => this.receive(data));
    });
  }

  send(event, data = {}) {
    let message = {
      event,
      data
    };

    let encrypted_data = this.scee.encryptString(
      JSON.stringify(message),
      this.token
    );

    this.wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(encrypted_data);
      }
    });
  }

  sendLog(level, message) {
    // Mirror to terminal so logs are visible without opening the GUI Troubleshooting tab
    const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    consoleFn(`[${level.toUpperCase()}] ${message}`);
    this.send("session_log", { level, message });
  }

  receive(data) {
    // ws v8+ delivers text frames as Buffer objects; convert to string so that
    // SCEE.decryptString can correctly base64-decode the ciphertext.
    const message = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
    let decrypted_data = JSON.parse(this.scee.decryptString(message, this.token));

    // route incoming request to either the daemon, wallet, or here
    switch (decrypted_data.module) {
      case "core":
        this.handle(decrypted_data);
        break;
      case "daemon":
        if (this.daemon) {
          this.daemon.handle(decrypted_data);
        }
        break;
      case "wallet":
        if (this.walletd) {
          this.walletd.handle(decrypted_data);
        }
        break;
    }
  }

  handle(data) {
    let params = data.data;

    // check if config has changed
    let config_changed = false;

    switch (data.method) {
      case "set_language":
        this.send("set_language", { lang: params.lang });
        break;
      case "quick_save_config":
        // save only partial config settings
        console.log("[Backend] quick_save_config called with params:", JSON.stringify(params, null, 2));
        console.log("[Backend] Config file path:", this.config_file);
        console.log("[Backend] Current config_data.app BEFORE merge:", JSON.stringify(this.config_data.app, null, 2));

        Object.keys(params).map(key => {
          this.config_data[key] = Object.assign(
            this.config_data[key],
            params[key]
          );
        });

        console.log("[Backend] Config_data.app AFTER merge:", JSON.stringify(this.config_data.app, null, 2));

        // Use sync write to ensure config is saved before app restart
        try {
          const configJson = JSON.stringify(this.config_data, null, 4);
          console.log("[Backend] Writing config to disk, net_type:", this.config_data.app?.net_type);
          fs.writeFileSync(
            this.config_file,
            configJson,
            "utf8"
          );
          console.log("[Backend] Config written successfully to:", this.config_file);

          // Verify the write by reading back
          const verifyData = fs.readFileSync(this.config_file, "utf8");
          const verifyParsed = JSON.parse(verifyData);
          console.log("[Backend] Verified config on disk, net_type:", verifyParsed.app?.net_type);

          this.send("set_app_data", {
            config: params,
            pending_config: params
          });
        } catch (err) {
          console.error("[Backend] Failed to save config:", err);
          this.sendLog("error", `Failed to save config: ${err.message}`);
        }
        break;
      case "save_config_init":
      case "save_config": {
        if (data.method === "save_config") {
          Object.keys(this.config_data).map(i => {
            if (i == "appearance") return;
            Object.keys(this.config_data[i]).map(j => {
              if (this.config_data[i][j] !== params[i][j]) {
                config_changed = true;
              }
            });
          });
        }

        Object.keys(params).map(key => {
          this.config_data[key] = Object.assign(
            this.config_data[key],
            params[key]
          );
        });

        const validated = Object.keys(this.defaults)
          .filter(k => k in this.config_data)
          .map(k => [
            k,
            this.validate_values(this.config_data[k], this.defaults[k])
          ])
          .reduce((map, obj) => {
            map[obj[0]] = obj[1];
            return map;
          }, {});

        // Validate daemon data
        this.config_data = {
          ...this.config_data,
          ...validated
        };

        fs.writeFile(
          this.config_file,
          JSON.stringify(this.config_data, null, 4),
          "utf8",
          () => {
            if (data.method == "save_config_init") {
              this.startup();
            } else {
              this.send("set_app_data", {
                config: this.config_data,
                pending_config: this.config_data
              });
              if (config_changed) {
                this.send("settings_changed_reboot");
              }
            }
          }
        );
        break;
      }
      case "init":
        this.startup();
        break;

      case "open_explorer": {
        // Block explorer not yet available for new XEQ network
        // TODO: Update URLs when block explorer is deployed
        this.send("show_notification", {
          type: "warning",
          message: "Block explorer not yet available for the new XEQ network.",
          timeout: 3000
        });
        break;
      }

      case "open_url":
        if (typeof params.url === "string" && params.url.startsWith("https://")) {
          require("electron").shell.openExternal(params.url);
        }
        break;

      case "open_folder":
        if (typeof params.path === "string" && params.path.length > 0) {
          // Ensure the folder exists before trying to open it
          if (!fs.existsSync(params.path)) {
            try {
              fs.mkdirpSync(params.path);
            } catch (e) {
              this.send("show_notification", {
                type: "negative",
                message: `Could not create folder: ${params.path}`,
                timeout: 3000
              });
              break;
            }
          }
          require("electron").shell.openPath(params.path);
        }
        break;

      case "save_png": {
        dialog
          .showSaveDialog(this.mainWindow, {
            title: "Save " + params.type,
            filters: [{ name: "PNG", extensions: ["png"] }],
            defaultPath: os.homedir()
          })
          .then(({ filePath }) => {
            if (filePath) {
              let base64Data = params.img.replace(
                /^data:image\/png;base64,/,
                ""
              );
              let binaryData = Buffer.from(base64Data, "base64").toString(
                "binary"
              );
              fs.writeFile(filePath, binaryData, "binary", err => {
                if (err) {
                  this.send("show_notification", {
                    type: "negative",
                    i18n: [
                      "notification.errors.errorSavingItem",
                      { item: params.type }
                    ],
                    timeout: 2000
                  });
                } else {
                  this.send("show_notification", {
                    i18n: [
                      "notification.positive.itemSaved",
                      { item: params.type, filename: filePath }
                    ],
                    timeout: 2000
                  });
                }
              });
            }
          });
        break;
      }

      case "connect_daemon":
        this.connectDaemon();
        break;

      case "disconnect_daemon":
        this.disconnectDaemon();
        break;

      default:
        break;
    }
  }
  // TODO: Update the GitHub releases URL below to the XEQ flagship wallet repo
  // once the release infrastructure is established.
  // Example: "https://api.github.com/repos/EquilibriaCC/xeq-electron-wallet/releases/latest"
  async checkVersion() {
    this.send("set_update_required", false);
  }

  initLogger(logPath) {
    let log = bunyan.createLogger({
      name: "log",
      streams: [
        {
          type: "rotating-file",
          path: path.join(logPath, "electron.log"),
          period: "1d", // daily rotation
          count: 4 // keep 4 days of logs
        }
      ]
    });

    LOG_LEVELS.forEach(level => {
      ipc.on(`log-${level}`, (first, ...rest) => {
        log[level](...rest);
      });
    });

    this.log = log;

    process.on("uncaughtException", error => {
      log.error("Unhandled Error", error);
    });

    process.on("unhandledRejection", error => {
      log.error("Unhandled Promise Rejection", error);
    });
  }

  startup() {
    console.log("[Backend] ========== STARTUP BEGIN ==========");
    console.log("[Backend] Config file path:", this.config_file);
    console.log("[Backend] Default net_type:", this.defaults.app?.net_type);

    this.send("set_app_data", {
      remotes: this.remotes,
      legacyRemotes: this.legacyRemotes,
      defaults: this.defaults
    });

    this.sendLog("info", `Platform: ${os.platform()}, arch: ${os.arch()}`);
    this.sendLog("info", `Config dir: ${this.config_dir}`);
    this.sendLog("info", `Wallet dir: ${this.wallet_dir}`);
    this.sendLog("info", `Working dir: ${process.cwd()}`);

    this.checkVersion();

    fs.readFile(this.config_file, "utf8", (err, data) => {
      if (err) {
        console.log("[Backend] No config file found, using defaults");
        // First run — no config file. Save defaults to disk and auto-start
        // using the default US remote node without showing the setup wizard.
        fs.writeFile(
          this.config_file,
          JSON.stringify(this.config_data, null, 4),
          "utf8",
          () => {}
        );
      } else {
        // Remove BOM (Byte Order Mark) if present
        if (data.charCodeAt(0) === 0xfeff) {
          data = data.slice(1);
        }

        let disk_config_data = JSON.parse(data);
        console.log("[Backend] Config read from disk, net_type:", disk_config_data.app?.net_type);
        console.log("[Backend] Config read from disk, daemon type:", disk_config_data.daemons?.[disk_config_data.app?.net_type]?.type);

        // semi-shallow object merge
        Object.keys(disk_config_data).map(key => {
          if (!this.config_data.hasOwnProperty(key)) {
            this.config_data[key] = {};
          }
          this.config_data[key] = Object.assign(
            this.config_data[key],
            disk_config_data[key]
          );
        });

        console.log("[Backend] After merge, net_type:", this.config_data.app?.net_type);
      }

      // here we may want to check if config data is valid, if not also send code -1
      // i.e. check ports are integers and > 1024, check that data dir path exists, etc
      const validated = Object.keys(this.defaults)
        .filter(k => k in this.config_data)
        .map(k => [
          k,
          this.validate_values(this.config_data[k], this.defaults[k])
        ])
        .reduce((map, obj) => {
          map[obj[0]] = obj[1];
          return map;
        }, {});

      console.log("[Backend] Validated app config:", JSON.stringify(validated.app, null, 2));

      // Make sure the daemon data is valid
      this.config_data = {
        ...this.config_data,
        ...validated
      };

      console.log("[Backend] After validation, net_type:", this.config_data.app?.net_type);

      // Migrate local_remote -> remote (option removed for Legacy XEQ)
      for (const net of ["mainnet", "stagenet", "testnet", "legacy"]) {
        if (
          this.config_data.daemons &&
          this.config_data.daemons[net] &&
          this.config_data.daemons[net].type === "local_remote"
        ) {
          this.config_data.daemons[net].type = "remote";
        }
      }

      // save config file back to file, so updated options are stored on disk
      fs.writeFile(
        this.config_file,
        JSON.stringify(this.config_data, null, 4),
        "utf8",
        () => {}
      );

      console.log("[Backend] Sending to frontend - net_type:", this.config_data.app?.net_type);
      console.log("[Backend] ========== STARTUP COMPLETE ==========");

      this.send("set_app_data", {
        config: this.config_data,
        pending_config: this.config_data
      });

      // Make the wallet dir
      const { wallet_data_dir, data_dir } = this.config_data.app;
      // Ensure wallet_data_dir uses the wallets folder in project root
      const defaultWalletDir = path.join(process.cwd(), "wallets");
      if (
        !this.config_data.app.wallet_data_dir ||
        this.config_data.app.wallet_data_dir !== defaultWalletDir
      ) {
        // Update to use the wallets folder if it's different
        this.config_data.app.wallet_data_dir = defaultWalletDir;
      }
      if (!fs.existsSync(this.config_data.app.wallet_data_dir)) {
        fs.mkdirpSync(this.config_data.app.wallet_data_dir);
      }
      console.log(
        `[Backend] Wallet directory set to: ${this.config_data.app.wallet_data_dir}`
      );

      // Ensure data and wallet directories exist (create if missing)
      const dirs_to_check = [data_dir, wallet_data_dir];
      for (const dir of dirs_to_check) {
        if (!fs.existsSync(dir)) {
          try {
            fs.mkdirpSync(dir);
            console.log(`[Backend] Created missing directory: ${dir}`);
          } catch (e) {
            console.error(`[Backend] Failed to create directory: ${dir}`, e);
            this.sendLog(
              "error",
              `Failed to create directory: ${dir} — ${e.message}`
            );
            this.send("show_notification", {
              type: "negative",
              message: `Failed to create directory: ${dir}`,
              timeout: 3000
            });
            this.send("set_app_data", {
              status: {
                code: -1
              }
            });
            return;
          }
        }
      }

      const { net_type } = this.config_data.app;

      const dirs = {
        mainnet: this.config_data.app.data_dir,
        stagenet: path.join(this.config_data.app.data_dir, "stagenet"),
        testnet: path.join(this.config_data.app.data_dir, "testnet"),
        legacy: path.join(this.config_data.app.data_dir, "legacy")
      };

      // Make sure we have the directories we need
      const net_dir = dirs[net_type];
      if (!fs.existsSync(net_dir)) {
        fs.mkdirpSync(net_dir);
      }

      const log_dir = path.join(net_dir, "logs");
      if (!fs.existsSync(log_dir)) {
        fs.mkdirpSync(log_dir);
      }

      this.initLogger(log_dir);

      this.daemon = new Daemon(this);
      this.walletd = new WalletRPC(this);

      // Check if we should auto-connect (legacy network with remote node)
      const shouldAutoConnect =
        net_type === "legacy" &&
        this.config_data.daemons[net_type] &&
        this.config_data.daemons[net_type].type === "remote";

      if (shouldAutoConnect) {
        this.sendLog("info", "Legacy network detected with remote node - auto-connecting...");
      } else {
        this.sendLog("info", "Backend initialized in offline mode.");
      }

      // Start in appropriate mode
      this.send("set_app_data", {
        status: {
          code: 6 // Starting wallet
        },
        daemon_connected: false
      });

      // Start wallet-rpc first
      this.walletd
        .start(this.config_data)
        .then(() => {
          this.send("set_app_data", { status: { code: 7 } }); // Reading wallet list
          this.walletd.listWallets(true);
          this.send("set_app_data", {
            status: { code: 0 }, // Ready
            daemon_connected: false
          });

          // Auto-connect for legacy remote, otherwise show welcome message
          if (shouldAutoConnect) {
            this.send("show_notification", {
              type: "info",
              message: "Connecting to remote node...",
              timeout: 3000
            });
            // Auto-connect to daemon
            this.connectDaemon();
          } else {
            // Show welcome message for new users or non-legacy networks
            this.send("show_notification", {
              type: "info",
              color: "cyan",
              textColor: "dark",
              message: "Welcome to Equilibria! Please select a network and connect via remote or local node.",
              timeout: 8000
            });
          }
        })
        .catch(walletError => {
          const wMsg = walletError && walletError.message ? walletError.message : String(walletError || "unknown");
          this.sendLog("error", `Wallet RPC failed: ${wMsg}`);
          this.send("show_notification", {
            type: "negative",
            message: `Could not start wallet: ${wMsg}`,
            timeout: 5000
          });
          this.send("set_app_data", { status: { code: -1 } });
        });
    }); // closes fs.readFile callback
  } // closes startup() method

  // Manual daemon connection - called from Network Settings
  connectDaemon() {
    const { net_type } = this.config_data.app;

    this.sendLog("info", `Connecting to daemon (${net_type})...`);
    this.send("set_app_data", {
      daemon_connecting: true,
      daemon_connected: false
    });

    this.daemon.checkVersion().then(version => {
      if (version) {
        this.sendLog("info", `Daemon version: ${version}`);
      } else {
        this.sendLog("warn", "Daemon binary not found");
        this.send("show_notification", {
          type: "negative",
          message: "Daemon binary not found. Please check your installation.",
          timeout: 5000
        });
        this.send("set_app_data", {
          daemon_connecting: false,
          daemon_connected: false
        });
        return;
      }

      this.daemon.start(this.config_data).then(() => {
        this.sendLog("info", "Daemon connected successfully!");

        // Update wallet-rpc to use the new daemon address (only if a wallet is open)
        if (this.walletd && this.walletd.wallet_state && this.walletd.wallet_state.open) {
          const daemon = this.config_data.daemons[net_type];
          let daemonHost, daemonPort;
          if (daemon.type === "remote") {
            daemonHost = daemon.remote_host;
            daemonPort = daemon.remote_port;
          } else {
            daemonHost = daemon.rpc_bind_ip;
            daemonPort = daemon.rpc_bind_port;
          }

          // Tell wallet-rpc to use this daemon
          this.walletd.setDaemon(daemonHost, daemonPort).then(success => {
            if (success) {
              this.sendLog("info", "Wallet-rpc daemon address updated");
              // Notify user that wallet will now sync
              this.send("show_notification", {
                type: "info",
                color: "cyan",
                textColor: "dark",
                message: "Wallet syncing with network - this may take a moment...",
                timeout: 5000
              });
            }
          });
        }

        this.send("set_app_data", {
          daemon_connecting: false,
          daemon_connected: true
        });
        this.send("show_notification", {
          type: "positive",
          message: "Connected to daemon successfully!",
          timeout: 3000
        });
      }).catch(error => {
        const msg = error && error.message ? error.message : String(error || "unknown");
        this.sendLog("warn", `Failed to connect to daemon: ${msg}`);
        this.send("show_notification", {
          type: "negative",
          message: `Failed to connect: ${msg}`,
          timeout: 5000
        });
        this.send("set_app_data", {
          daemon_connecting: false,
          daemon_connected: false
        });
      });
    }).catch(error => {
      const msg = error && error.message ? error.message : String(error || "unknown");
      this.sendLog("error", `Daemon check failed: ${msg}`);
      this.send("set_app_data", {
        daemon_connecting: false,
        daemon_connected: false
      });
    });
  }

  // Disconnect daemon
  disconnectDaemon() {
    if (this.daemon) {
      this.daemon.quit().then(() => {
        this.sendLog("info", "Daemon disconnected");
        this.send("set_app_data", {
          daemon_connected: false
        });
        this.send("show_notification", {
          type: "info",
          message: "Disconnected from daemon.",
          timeout: 3000
        });
      });
    }
  }

  quit() {
    return new Promise(resolve => {
      let process = [];
      if (this.daemon) {
        process.push(this.daemon.quit());
      }
      if (this.walletd) {
        process.push(this.walletd.quit());
      }
      if (this.wss) {
        this.wss.close();
      }

      Promise.all(process).then(() => {
        resolve();
      });
    });
  }

  // Replace any invalid value with default values
  validate_values(values, defaults) {
    const isDictionary = v =>
      typeof v === "object" &&
      v !== null &&
      !(v instanceof Array) &&
      !(v instanceof Date);
    const modified = { ...values };

    // Make sure we have valid defaults
    if (!isDictionary(defaults)) return modified;

    for (const key in modified) {
      // Only modify if we have a default
      if (!(key in defaults)) continue;

      const defaultValue = defaults[key];
      const invalidDefault =
        defaultValue === null ||
        defaultValue === undefined ||
        Number.isNaN(defaultValue);
      if (invalidDefault) continue;

      const value = modified[key];

      // If we have a object then recurse through it
      if (isDictionary(value)) {
        modified[key] = this.validate_values(value, defaultValue);
      } else {
        // Check if we need to replace the value
        const isValidValue = !(
          value === undefined ||
          value === null ||
          value === "" ||
          Number.isNaN(value)
        );
        if (isValidValue) continue;

        // Otherwise set the default value
        modified[key] = defaultValue;
      }
    }
    return modified;
  }
}
