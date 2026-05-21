import child_process from "child_process";

const queue = require("promise-queue");
const http = require("http");
const fs = require("fs");
const path = require("upath");
const portscanner = require("portscanner");

export class Daemon {
  constructor(backend) {
    this.backend = backend;
    this.heartbeat = null;
    this.heartbeat_slow = null;
    this.id = 0;
    this.net_type = "mainnet";
    this.local = false; // do we have a local daemon ?

    this.agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    this.queue = new queue(1, Infinity);

    // Settings for timestamp to height conversion
    // These are initial values used to calculate the height
    this.PIVOT_BLOCK_HEIGHT = 119681;
    this.PIVOT_BLOCK_TIMESTAMP = 1539676273;
    this.PIVOT_BLOCK_TIME = 120;
  }

  // Get the binary path for the active network
  getBinaryPath() {
    return __ryo_bin;
  }

  checkVersion(net_type = null) {
    const binPath = this.getBinaryPath(net_type);
    return new Promise(resolve => {
      if (process.platform === "win32") {
        // Try .exe first, then without extension
        let xeqd_path = path.join(binPath, "xeqm-d.exe");
        if (!fs.existsSync(xeqd_path)) {
          xeqd_path = path.join(binPath, "xeqm-d");
        }
        if (!fs.existsSync(xeqd_path)) {
          console.log(`[Daemon] xeqm-d not found at: ${xeqd_path}`);
          console.log(`[Daemon] bin path is: ${binPath}`);
          const netLabel = net_type ? ` (network: ${net_type})` : "";
          this.backend.sendLog(
            "warn",
            `xeqm-d not found at: ${xeqd_path} (bin dir: ${binPath})${netLabel}`
          );
          resolve(false);
          return;
        }
        console.log(`[Daemon] Found xeqm-d at: ${xeqd_path}`);
        let xeqd_version_cmd = `"${xeqd_path}" --version`;
        // Add common DLL locations to PATH (Git's mingw64 for OpenSSL, etc.)
        const gitMingw = "C:\\Program Files\\Git\\mingw64\\bin";
        const extendedPath = `${binPath};${gitMingw};${process.env.PATH}`;
        child_process.exec(xeqd_version_cmd, {
          cwd: binPath,
          env: { ...process.env, PATH: extendedPath }
        }, (error, stdout) => {
          if (error) {
            console.log(`[Daemon] Error running xeqm-d --version:`, error);
            const netLabel = net_type ? `[${net_type}] ` : "";
            this.backend.sendLog("warn", `${netLabel}Daemon binary failed to run: ${error.message || String(error)}`);
            resolve(false);
            return;
          }
          resolve(stdout);
        });
      } else {
        let xeqd_path = path.join(binPath, "xeqm-d");
        let xeqd_version_cmd = `"${xeqd_path}" --version`;
        if (!fs.existsSync(xeqd_path)) {
          console.log(`[Daemon] xeqm-d not found at: ${xeqd_path}`);
          const netLabel = net_type ? ` (network: ${net_type})` : "";
          this.backend.sendLog(
            "warn",
            `xeqm-d not found at: ${xeqd_path} (bin dir: ${binPath})${netLabel}`
          );
          resolve(false);
          return;
        }
        child_process.exec(
          xeqd_version_cmd,
          { detached: true },
          (error, stdout) => {
            if (error) {
              const netLabel = net_type ? `[${net_type}] ` : "";
              this.backend.sendLog("warn", `${netLabel}Daemon binary failed to run: ${error.message || String(error)}`);
              resolve(false);
              return;
            }
            resolve(stdout);
          }
        );
      }
    });
  }

  checkRemote(daemon) {
    if (daemon.type === "local") {
      return Promise.resolve({});
    }

    return this.sendRPC(
      "get_info",
      {},
      {
        protocol: "http://",
        hostname: daemon.remote_host,
        port: daemon.remote_port,
        timeout: 20000
      }
    ).then(data => {
      if (data.error) return { error: data.error };
      return {
        net_type: data.result.nettype
      };
    });
  }

  start(options) {
    // Stash for self-restart from heartbeat watchdog (maybeRestartDaemon).
    this._lastStartOptions = options;
    const { net_type } = options.app;
    const daemon = options.daemons[net_type];
    if (daemon.type === "remote") {
      this.local = false;

      // save this info for later RPC calls
      this.protocol = "http://";
      this.hostname = daemon.remote_host;
      this.port = daemon.remote_port;

      this.backend.sendLog(
        "info",
        `[${net_type}] Connecting to remote node ${daemon.remote_host}:${daemon.remote_port}...`
      );

      return new Promise((resolve, reject) => {
        this.sendRPC("get_info", {}, { timeout: 20000 }).then(data => {
          if (!data.hasOwnProperty("error")) {
            const h = data.result ? data.result.height : "unknown";
            this.backend.sendLog(
              "info",
              `Connected to remote node — daemon height: ${h}`
            );
            this.startHeartbeat();
            resolve();
          } else {
            const msg = data.error
              ? data.error.message || JSON.stringify(data.error)
              : "unknown error";
            this.backend.sendLog(
              "error",
              `Failed to connect to remote node ${daemon.remote_host}:${daemon.remote_port} — ${msg}`
            );
            reject();
          }
        });
      });
    }
    return new Promise((resolve, reject) => {
      this.local = true;

      const { net_type } = options.app;
      this.net_type = net_type;

      // Define network-specific data directories
      const dirs = {
        mainnet: options.app.data_dir,
        stagenet: path.join(options.app.data_dir, "stagenet"),
        testnet: path.join(options.app.data_dir, "testnet")
      };

      // Use network-specific data directory
      const dataDir = dirs[net_type] || options.app.data_dir;

      const args = [
        "--data-dir",
        dataDir,
        "--p2p-bind-ip",
        daemon.p2p_bind_ip,
        "--p2p-bind-port",
        daemon.p2p_bind_port,
        "--rpc-admin",
        `${daemon.rpc_bind_ip}:${daemon.rpc_bind_port}`,
        "--out-peers",
        daemon.out_peers,
        "--in-peers",
        daemon.in_peers,
        "--limit-rate-up",
        daemon.limit_rate_up,
        "--limit-rate-down",
        daemon.limit_rate_down,
        "--log-level",
        daemon.log_level
      ];

      if (net_type === "testnet") {
        args.push("--testnet");
      } else if (net_type === "stagenet") {
        args.push("--stagenet");
      }

      args.push("--log-file", path.join(dirs[net_type], "logs", "xeqm-d.log"));
      if (daemon.rpc_bind_ip !== "127.0.0.1") {
        args.push("--confirm-external-bind");
      }

      // Priority node for testnet bootstrap (P2P port 18080)
      if (net_type === "testnet") {
        args.push("--add-priority-node", "84.247.143.210:18080");
      }

      // local_remote option removed — XEQM mainnet only
      // if (daemon.type === "local_remote" && net_type === "mainnet") {
      //   args.push(
      //     "--bootstrap-daemon-address",
      //     `${daemon.remote_host}:${daemon.remote_port}`
      //   );
      // }

      // save this info for later RPC calls
      this.protocol = "http://";
      this.hostname = daemon.rpc_bind_ip;
      this.port = daemon.rpc_bind_port;

      portscanner
        .checkPortStatus(this.port, this.hostname)
        .catch(() => "closed")
        .then(status => {
          if (status === "closed") {
            // No daemon running, start a new one
            console.log("[Daemon] Port is closed, starting new daemon...");
            const binPath = this.getBinaryPath(net_type);
            this.backend.sendLog("info", `[${net_type}] Starting local daemon: data-dir=${dataDir}, RPC 127.0.0.1:${daemon.rpc_bind_port}, P2P :${daemon.p2p_bind_port}`);
            const daemonExePath = path.join(binPath, process.platform === "win32" ? "xeqm-d.exe" : "xeqm-d");
            this.backend.sendLog("info", `[${net_type}] Daemon binary: ${daemonExePath}`);
            if (process.platform === "win32") {
              // Try .exe first, then without extension
              let xeqd_path = path.join(binPath, "xeqm-d.exe");
              if (!fs.existsSync(xeqd_path)) {
                xeqd_path = path.join(binPath, "xeqm-d");
              }
              this.daemonProcess = child_process.spawn(xeqd_path, args, {
                cwd: binPath,
                env: { ...process.env, PATH: `${binPath};${process.env.PATH}` }
              });
            } else {
              this.daemonProcess = child_process.spawn(
                path.join(binPath, "xeqm-d"),
                args,
                {
                  detached: true,
                  cwd: binPath,
                  env: { ...process.env, PATH: `${binPath}:${process.env.PATH}` }
                }
              );
            }

            this.daemonProcess.stdout.on("data", data => {
              process.stdout.write(`Daemon: ${data}`);
              let lines = data.toString().split("\n");
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.length === 0) continue;
                const levelMatch = trimmed.match(
                  /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s+([EWID])\s+/
                );
                if (levelMatch) {
                  const lvl = levelMatch[1];
                  const logLevel =
                    lvl === "E" ? "error" : lvl === "W" ? "warn" : "info";
                  this.backend.sendLog(logLevel, `[daemon] ${trimmed}`);
                } else if (
                  trimmed.includes("XEQMLabs") ||
                  trimmed.includes("Error") ||
                  trimmed.includes("error") ||
                  trimmed.includes("THROW EXCEPTION") ||
                  trimmed.includes("Synchronized") ||
                  trimmed.includes("Binding on")
                ) {
                  const isErr =
                    trimmed.includes("Error") ||
                    trimmed.includes("error") ||
                    trimmed.includes("THROW EXCEPTION");
                  this.backend.sendLog(
                    isErr ? "error" : "info",
                    `[daemon] ${trimmed}`
                  );
                }
              }
            });
            this.daemonProcess.on("error", err => {
              process.stderr.write(`Daemon: ${err}`);
              this.backend.sendLog("error", `[daemon] Process error: ${err}`);
            });
            this.daemonProcess.on("close", code => {
              process.stderr.write(`Daemon: exited with code ${code} \n`);
              let exitMsg = `[daemon] Process exited with code ${code}`;
              if (code !== null && (code > 255 || code < 0)) {
                exitMsg += ` (Windows error code; hex 0x${(code >>> 0).toString(16).toUpperCase()})`;
              }
              this.backend.sendLog("warn", exitMsg);
              this.daemonProcess = null;
              this.agent.destroy();
              if (code === null) {
                reject(new Error("Failed to start local daemon"));
              }
            });

            // To let caller know when the daemon is ready
            // We can't apply timeout to this because the local daemon might be syncing in the background
            let intrvl = setInterval(() => {
              this.sendRPC("get_info").then(data => {
                if (!data.hasOwnProperty("error")) {
                  this.startHeartbeat();
                  clearInterval(intrvl);
                  resolve();
                } else {
                  if (
                    this.daemonProcess &&
                    data.error.cause &&
                    data.error.cause.code === "ECONNREFUSED"
                  ) {
                    // Ignore
                  } else {
                    clearInterval(intrvl);
                    this.killProcess();
                    reject(new Error("Could not connect to local daemon"));
                  }
                }
              });
            }, 1000);
          } else {
            // Port is already in use - try to connect to existing daemon
            console.log(
              "[Daemon] Port is already in use, checking for existing daemon..."
            );
            this.sendRPC("get_info", {}, { timeout: 5000 })
              .then(data => {
                if (!data.hasOwnProperty("error")) {
                  // Existing daemon is responding, use it
                  console.log(
                    "[Daemon] Found existing daemon running on port " +
                      this.port +
                      ", connecting to it..."
                  );
                  console.log(
                    "[Daemon] Daemon info:",
                    JSON.stringify(data.result).substring(0, 200)
                  );
                  this.daemonProcess = null; // We didn't start it, so don't track it
                  // Keep this.local = true so heartbeat works correctly
                  this.startHeartbeat();
                  resolve();
                } else {
                  // Port is in use but not by a compatible daemon
                  reject(
                    new Error(
                      `Local daemon port ${this.port} is in use by another application`
                    )
                  );
                }
              })
              .catch(() => {
                reject(
                  new Error(
                    `Local daemon port ${this.port} is in use but not responding`
                  )
                );
              });
          }
        });
    });
  }

  killProcess() {
    if (this.daemonProcess) {
      this.daemonProcess.kill();
      this.daemonProcess = null;
    }
  }

  handle(data) {
    let params = data.data;

    switch (data.method) {
      case "ban_peer":
        this.banPeer(params.host, params.seconds);
        break;

      case "update_service_nodes":
        this.updateServiceNodes();
        break;

      default:
    }
  }

  banPeer(host, seconds = 3600) {
    if (!seconds) {
      seconds = 3600;
    }

    let params = {
      bans: [
        {
          host,
          seconds,
          ban: true
        }
      ]
    };

    this.sendRPC("set_bans", params).then(data => {
      if (data.hasOwnProperty("error") || !data.hasOwnProperty("result")) {
        this.sendGateway("show_notification", {
          type: "negative",
          i18n: "notification.errors.banningPeer",
          timeout: 2000
        });
        return;
      }

      let end_time = new Date(Date.now() + seconds * 1000).toLocaleString();
      this.sendGateway("show_notification", {
        i18n: ["notification.positive.bannedPeer", { host, time: end_time }],
        timeout: 2000
      });

      // Send updated peer and ban list
      this.heartbeatSlowAction();
    });
  }

  timestampToHeight(timestamp, pivot = null, recursion_limit = null) {
    return new Promise((resolve, reject) => {
      if (timestamp > 999999999999) {
        // We have got a JS ms timestamp, convert
        timestamp = Math.floor(timestamp / 1000);
      }

      pivot = pivot || [this.PIVOT_BLOCK_HEIGHT, this.PIVOT_BLOCK_TIMESTAMP];
      recursion_limit = recursion_limit || 0;

      let diff = Math.floor((timestamp - pivot[1]) / this.PIVOT_BLOCK_TIME);
      let estimated_height = pivot[0] + diff;

      if (estimated_height <= 0) {
        return resolve(0);
      }

      if (recursion_limit > 10) {
        return resolve(pivot[0]);
      }

      this.getRPC("block_header_by_height", {
        height: estimated_height
      }).then(data => {
        if (data.hasOwnProperty("error") || !data.hasOwnProperty("result")) {
          if (data.error.code == -2) {
            // Too big height
            this.getRPC("last_block_header").then(data => {
              if (
                data.hasOwnProperty("error") ||
                !data.hasOwnProperty("result")
              ) {
                return reject();
              }

              let new_pivot = [
                data.result.block_header.height,
                data.result.block_header.timestamp
              ];

              // If we are within an hour that is good enough
              // If for some reason there is a > 1h gap between blocks
              // the recursion limit will take care of infinite loop
              if (Math.abs(timestamp - new_pivot[1]) < 3600) {
                return resolve(new_pivot[0]);
              }

              // Continue recursion with new pivot
              resolve(new_pivot);
            });
            return;
          } else {
            return reject();
          }
        }

        let new_pivot = [
          data.result.block_header.height,
          data.result.block_header.timestamp
        ];

        // If we are within an hour that is good enough
        // If for some reason there is a > 1h gap between blocks
        // the recursion limit will take care of infinite loop
        if (Math.abs(timestamp - new_pivot[1]) < 3600) {
          return resolve(new_pivot[0]);
        }

        // Continue recursion with new pivot
        resolve(new_pivot);
      });
    })
      .then(pivot_or_height => {
        return Array.isArray(pivot_or_height)
          ? this.timestampToHeight(
              timestamp,
              pivot_or_height,
              recursion_limit + 1
            )
          : pivot_or_height;
      })
      .catch(() => {
        // Daemon not connected - fall back to estimated height calculation
        // This allows wallet restore to work even without daemon connection
        let ts = timestamp;
        if (ts > 999999999999) {
          ts = Math.floor(ts / 1000);
        }
        const diff = Math.floor((ts - this.PIVOT_BLOCK_TIMESTAMP) / this.PIVOT_BLOCK_TIME);
        const estimatedHeight = Math.max(0, this.PIVOT_BLOCK_HEIGHT + diff);
        console.log(`[Daemon] timestampToHeight: daemon offline, using estimated height ${estimatedHeight}`);
        return estimatedHeight;
      });
  }

  startHeartbeat() {
    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(
      () => {
        this.heartbeatAction();
      },
      this.local ? 5 * 1000 : 30 * 1000
    ); // 5 seconds for local daemon, 30 seconds for remote
    this.heartbeatAction();

    clearInterval(this.heartbeat_slow);
    this.heartbeat_slow = setInterval(() => {
      this.heartbeatSlowAction();
    }, 30 * 1000); // 30 seconds
    this.heartbeatSlowAction();

    clearInterval(this.serviceNodeHeartbeat);
    this.serviceNodeHeartbeat = setInterval(() => {
      this.updateServiceNodes();
    }, 5 * 60 * 1000); // 5 minutes
    this.updateServiceNodes();
  }

  heartbeatAction() {
    this.daemonHeartbeatCount = (this.daemonHeartbeatCount || 0) + 1;

    let actions = [];

    if (this.local) {
      actions = [this.getRPC("info")];
    } else {
      actions = [this.getRPC("info")];
    }

    Promise.all(actions).then(data => {
      let daemon_info = {};
      let gotInfo = false;
      for (let n of data) {
        if (
          n == undefined ||
          !n.hasOwnProperty("result") ||
          n.result == undefined
        ) {
          if (n && n.error) {
            const msg = n.error.message || JSON.stringify(n.error);
            // Selective logging: spam suppression once we know it's down.
            const fails = (this.consecutiveDaemonFailures || 0) + 1;
            if (fails <= 3 || fails % 10 === 0) {
              this.backend.sendLog(
                "error",
                `Daemon RPC ${n.method || "unknown"} failed: ${msg}`
              );
            }
          }
          continue;
        }
        if (n.method == "get_info") {
          daemon_info.info = n.result;
          gotInfo = true;
        }
      }
      this.sendGateway("set_daemon_data", daemon_info);

      if (gotInfo) {
        const h = daemon_info.info.height || 0;
        const target = daemon_info.info.target_height || h;
        // Share effective chain tip with wallet-rpc so it can detect true sync completion
        this.backend.daemonHeight = Math.max(h, target);
        this.isDaemonSyncing = target > h && (target - h) > 5;
        this.daemonResponsive = true;
        this.consecutiveDaemonFailures = 0;
      } else {
        // Daemon RPC failed. Track health independently so downstream
        // consumers (wallet-rpc watchdog) don't trust a stale isDaemonSyncing.
        this.consecutiveDaemonFailures =
          (this.consecutiveDaemonFailures || 0) + 1;
        if (this.consecutiveDaemonFailures >= 6) {
          // ~30s of failure for local (5s * 6) or ~3min for remote.
          // Clear stale sync state — we no longer know if it's syncing.
          this.daemonResponsive = false;
          this.isDaemonSyncing = false;
        }
        this.maybeRestartDaemon();
      }

      if (gotInfo && this.daemonHeartbeatCount % 6 === 1) {
        const h = daemon_info.info.height || 0;
        const target = daemon_info.info.target_height || h;
        this.backend.sendLog(
          "info",
          `Daemon status — height: ${h}, target: ${target}, connections: ${daemon_info
            .info.outgoing_connections_count || 0} out / ${daemon_info.info
            .incoming_connections_count || 0} in`
        );
      }
    });
  }

  // After ~3 minutes of unresponsive heartbeats for a LOCAL daemon, kill the
  // frozen process and respawn it. Remote daemons aren't ours to restart —
  // we just surface a notification suggesting the user pick a different node.
  maybeRestartDaemon() {
    const FAIL_THRESHOLD_LOCAL = 36;   // 36 * 5s = ~3 min
    const FAIL_THRESHOLD_REMOTE = 10;  // 10 * 30s = ~5 min before nagging
    const fails = this.consecutiveDaemonFailures || 0;

    if (this.daemonRestarting) return;

    if (!this.local) {
      // Remote: nag once per ~5 min sustained failure, don't try to restart.
      if (fails === FAIL_THRESHOLD_REMOTE) {
        this.backend.send("show_notification", {
          type: "warning",
          message:
            "Remote daemon unresponsive. Try a different node in Network Settings.",
          timeout: 10000
        });
      }
      return;
    }

    if (fails < FAIL_THRESHOLD_LOCAL) return;
    if (this._lastStartOptions == null) return;  // never started; nothing to respawn

    this.daemonRestarting = true;
    this.backend.sendLog(
      "warn",
      `Local daemon unresponsive for ${fails} consecutive heartbeats — restarting`
    );
    this.backend.send("show_notification", {
      type: "warning",
      message: "Restarting local daemon...",
      timeout: 0
    });

    const finish = () => {
      this.daemonRestarting = false;
    };

    // Kill the existing (frozen) process — SIGKILL because SIGTERM may not
    // be honored by a hung daemon. The 'close' handler clears daemonProcess.
    const proc = this.daemonProcess;
    if (proc) {
      try { proc.kill("SIGKILL"); } catch (e) {
        this.backend.sendLog("warn", `Daemon kill failed: ${e.message}`);
      }
    }

    // Wait briefly for the port to free, then respawn via the normal start()
    // path. start() handles the port-occupied case too, so this is safe even
    // if the OS hasn't yet released the socket.
    setTimeout(() => {
      this.start(this._lastStartOptions)
        .then(() => {
          this.consecutiveDaemonFailures = 0;
          this.daemonResponsive = true;
          this.backend.sendLog("info", "Local daemon restarted successfully");
          this.backend.send("show_notification", {
            type: "positive",
            message: "Local daemon back online.",
            timeout: 4000
          });
        })
        .catch(err => {
          const msg = err && err.message ? err.message : String(err || "unknown");
          this.backend.sendLog("error", `Local daemon restart failed: ${msg}`);
          this.backend.send("show_notification", {
            type: "negative",
            message: `Local daemon restart failed: ${msg}`,
            timeout: 8000
          });
        })
        .finally(finish);
    }, 2000);
  }

  heartbeatSlowAction() {
    let actions = [];
    if (this.local) {
      actions = [
        this.getRPC("connections"),
        this.getRPC("bans")
        // this.getRPC("txpool_backlog"),
      ];
    } else {
      actions = [
        // this.getRPC("txpool_backlog"),
      ];
    }

    if (actions.length === 0) return;

    Promise.all(actions).then(data => {
      let daemon_info = {};
      for (let n of data) {
        if (
          n == undefined ||
          !n.hasOwnProperty("result") ||
          n.result == undefined
        ) {
          continue;
        }
        if (
          n.method == "get_connections" &&
          n.result.hasOwnProperty("connections")
        ) {
          daemon_info.connections = n.result.connections;
        } else if (n.method == "get_bans" && n.result.hasOwnProperty("bans")) {
          daemon_info.bans = n.result.bans;
        } else if (
          n.method == "get_txpool_backlog" &&
          n.result.hasOwnProperty("backlog")
        ) {
          daemon_info.tx_pool_backlog = n.result.backlog;
        }
      }
      this.sendGateway("set_daemon_data", daemon_info);
    });
  }

  updateServiceNodes() {
    const service_nodes = {
      fetching: true
    };
    this.sendGateway("set_daemon_data", { service_nodes });
    this.getRPC("service_nodes").then(data => {
      if (!data.hasOwnProperty("result")) return;
      const nodes = data.result.service_node_states;

      const service_nodes = {
        nodes,
        fetching: false
      };
      this.sendGateway("set_daemon_data", { service_nodes });
    });
  }

  async getONSRecordsForOwners(owners) {
    if (!Array.isArray(owners) || owners.length === 0) {
      return [];
    }

    // only 256 addresses allowed in this call
    let ownersMax = owners.slice(0, 256);
    const data = await this.sendRPC("ons_owners_to_names", {
      entries: ownersMax
    });
    if (!data.hasOwnProperty("result")) return [];

    // We need to map request_index to owner
    const { entries } = data.result;
    const recordsWithOwners = (entries || []).map(record => {
      const owner = ownersMax[record.request_index];
      return {
        ...record,
        owner
      };
    });

    return this._sanitizeONSRecords(recordsWithOwners);
  }

  async getONSRecord(nameHash) {
    if (!nameHash || nameHash.length === 0) {
      return null;
    }

    const params = {
      entries: [
        {
          name_hash: nameHash,
          // 0 = session
          // 1 = wallet
          // 2 = lokinet
          types: [0, 1, 2]
        }
      ]
    };

    const data = await this.sendRPC("ons_names_to_owners", params);
    if (!data.hasOwnProperty("result")) return null;

    const entries = this._sanitizeONSRecords(data.result.entries);
    if (entries.length === 0) return null;

    return entries[0];
  }

  _sanitizeONSRecords(records) {
    return (records || []).map(record => {
      // Record type is in uint16 format
      // Session = 0
      // Lokinet = 2
      let type = "lokinet";
      if (record.type === 0) {
        type = "session";
      }
      if (record.type === 1) {
        type = "wallet";
      }
      return {
        ...record,
        type
      };
    });
  }

  sendGateway(method, data) {
    this.backend.send(method, data);
  }

  sendRPC(method, params = {}, options = {}) {
    let id = this.id++;

    const protocol = options.protocol || this.protocol;
    const hostname = options.hostname || this.hostname;
    const port = options.port || this.port;

    const url = `${protocol}${hostname}:${port}/json_rpc`;
    const body = {
      jsonrpc: "2.0",
      id: id,
      method: method
    };
    if (Object.keys(params).length !== 0) {
      body.params = params;
    }

    const fetchOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      agent: this.agent
    };
    if (options.timeout) {
      fetchOptions.signal = AbortSignal.timeout(options.timeout);
    }

    return this.queue.add(() => {
      return fetch(url, fetchOptions)
        .then(res => res.json())
        .then(response => {
          if (response.hasOwnProperty("error")) {
            // Rewrite Oxen-era prose in daemon error messages.
            const err = { ...response.error };
            if (typeof err.message === "string") {
              err.message = err.message
                .replace(/\bOxen\b/g, "XEQM")
                .replace(/\bOXEN\b/g, "XEQM")
                .replace(/\boxen\b/g, "XEQM");
            }
            return { method, params, error: err };
          }
          if (response.result && typeof response.result.msg === "string") {
            response.result.msg = response.result.msg
              .replace(/\bOxen\b/g, "XEQM")
              .replace(/\bOXEN\b/g, "XEQM")
              .replace(/\boxen\b/g, "XEQM");
          }
          return { method, params, result: response.result };
        })
        .catch(error => {
          return {
            method: method,
            params: params,
            error: {
              code: -1,
              message: "Cannot connect to daemon-rpc",
              cause: error.cause
            }
          };
        });
    });
  }

  /**
   * Call one of the get_* RPC calls
   */
  getRPC(parameter, args) {
    return this.sendRPC(`get_${parameter}`, args);
  }

  quit() {
    clearInterval(this.heartbeat);
    return new Promise(resolve => {
      if (this.daemonProcess) {
        this.daemonProcess.on("close", () => {
          this.agent.destroy();
          clearTimeout(this.forceKill);
          resolve();
        });

        // Force kill after 20 seconds
        this.forceKill = setTimeout(() => {
          if (this.daemonProcess) {
            this.daemonProcess.kill("SIGKILL");
          }
        }, 20000);

        const signal = this.isDaemonSyncing ? "SIGKILL" : "SIGTERM";
        this.daemonProcess.kill(signal);
      } else {
        resolve();
      }
    });
  }
}
