import { Notify, Dialog, Loading, LocalStorage } from "quasar";
import { i18n, changeLanguage } from "src/boot/i18n";

export class Gateway {
  constructor(app, router, store) {
    this.app = app;
    this._listeners = {};
    this.router = router;
    this.store = store;
    this.token = null;

    let language = LocalStorage.has("language")
      ? LocalStorage.getItem("language")
      : "en-us";
    this.setLanguage(language);

    let theme = LocalStorage.has("theme")
      ? LocalStorage.getItem("theme")
      : "light";
    this.store.commit("gateway/set_app_data", {
      config: {
        appearance: {
          theme
        }
      }
    });
    this.store.watch(
      state => state.gateway.app.config.appearance.theme,
      theme => {
        LocalStorage.set("theme", theme);
      }
    );

    this.closeDialog = false;

    this.store.commit("gateway/set_app_data", {
      status: {
        code: 1
      }
    });

    window.electronAPI.onInitialize(data => {
      this.token = data.token;
      setTimeout(() => {
        this.ws = new WebSocket("ws://127.0.0.1:" + data.port);
        this.ws.addEventListener("open", () => {
          this.open();
        });
        this.ws.addEventListener("message", e => {
          this.receive(e.data);
        });
      }, 1000);
    });

    window.electronAPI.onConfirmClose(() => {
      this.confirmClose(i18n.global.t("dialog.exit.message"));
    });

    window.electronAPI.onShowQuitScreen(() => {
      if (this.router) {
        this.router.replace({ path: "/quit" });
      }
    });

    this.pushLog("info", "GUI session started");

    const origOnError = window.onerror;
    window.onerror = (message, script, line, col, error) => {
      this.pushLog("error", `${message} (${script}:${line}:${col})`);
      if (origOnError) origOnError(message, script, line, col, error);
    };

    const origRejection = window.onunhandledrejection;
    window.addEventListener("unhandledrejection", ev => {
      const info =
        ev.reason && ev.reason.stack ? ev.reason.stack : String(ev.reason);
      this.pushLog("error", `Unhandled promise rejection: ${info}`);
      if (origRejection) origRejection(ev);
    });
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push({ fn, once: false });
    return this;
  }

  once(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push({ fn, once: true });
    return this;
  }

  emit(event, ...args) {
    const list = this._listeners[event];
    if (!list) return;
    this._listeners[event] = list.filter(entry => {
      entry.fn(...args);
      return !entry.once;
    });
  }

  off(event, fn) {
    const list = this._listeners[event];
    if (!list) return;
    this._listeners[event] = list.filter(entry => entry.fn !== fn);
  }

  open() {
    this.store.commit("gateway/set_app_data", {
      status: {
        code: 2
      }
    });
    this.send("core", "init");
  }

  confirmClose(msg, restart = false) {
    if (this.closeDialog) {
      return;
    }
    this.closeDialog = true;

    const key = restart ? "restart" : "exit";

    Dialog.create({
      title: i18n.global.t(`dialog.${key}.title`),
      message: msg,
      ok: {
        label: i18n.global.t(`dialog.${key}.ok`),
        color: "primary"
      },
      cancel: {
        flat: true,
        label: i18n.global.t("dialog.buttons.cancel"),
        color: "grey"
      }
    })
      .onOk(() => {
        this.closeDialog = false;
        Loading.hide();
        this.router.replace({ path: "/quit" });
        window.electronAPI.confirmClose(restart);
      })
      .onCancel(() => {
        this.closeDialog = false;
      });
  }

  send(module, method, data = {}) {
    let message = {
      module,
      method,
      data
    };
    let encrypted_data = window.electronAPI.sceeEncrypt(
      JSON.stringify(message),
      this.token
    );
    this.ws.send(encrypted_data);
  }

  pushLog(level, message, source = "GUI") {
    try {
      this.store.commit("gateway/push_session_log", {
        level,
        message,
        source
      });
    } catch (e) {
      // Store may not be ready yet
    }
  }

  geti18n(key) {
    return Array.isArray(key) ? i18n.global.t(...key) : i18n.global.t(key);
  }

  receive(message) {
    let decrypted_data = JSON.parse(
      window.electronAPI.sceeDecrypt(message, this.token)
    );

    if (
      typeof decrypted_data !== "object" ||
      !decrypted_data.hasOwnProperty("event") ||
      !decrypted_data.hasOwnProperty("data")
    ) {
      return;
    }

    switch (decrypted_data.event) {
      case "set_language": {
        const { lang } = decrypted_data.data;
        this.setLanguage(lang);
        break;
      }
      case "set_has_password":
        this.emit("has_password", decrypted_data.data);
        break;
      case "set_valid_address":
        this.emit("validate_address", decrypted_data.data);
        break;
      case "set_decrypt_record_result":
        this.emit("decrypt_record_result", decrypted_data.data);
        break;
      case "set_app_data":
        this.store.commit("gateway/set_app_data", decrypted_data.data);
        break;

      case "set_daemon_data":
        this.store.commit("gateway/set_daemon_data", decrypted_data.data);
        break;

      case "set_wallet_data":
      case "set_wallet_error":
        this.store.commit("gateway/set_wallet_data", decrypted_data.data);
        break;

      case "reset_wallet_error":
        this.store.dispatch("gateway/resetWalletStatus");
        break;

      case "set_tx_status": {
        const data = { ...decrypted_data.data };
        if (data.i18n) {
          data.message = this.geti18n(data.i18n);
        }
        this.store.commit("gateway/set_tx_status", data);
        break;
      }

      case "set_sweep_all_status": {
        const data = { ...decrypted_data.data };
        if (data.i18n) {
          data.message = this.geti18n(data.i18n);
        }
        this.store.commit("gateway/set_sweep_all_status", data);
        break;
      }

      case "set_ons_status": {
        const data = { ...decrypted_data.data };
        if (data.i18n) {
          data.message = this.geti18n(data.i18n);
        }

        this.store.commit("gateway/set_ons_status", data);
        break;
      }

      case "set_snode_status": {
        const data = { ...decrypted_data.data };

        for (const key in data) {
          if (data[key].i18n) {
            data[key].message = this.geti18n(data[key].i18n);
          }
        }

        this.store.commit("gateway/set_snode_status", data);
        break;
      }
      case "set_tx_confirmation_status": {
        this.store.commit("gateway/set_tx_confirmation_status", decrypted_data.data);
        break;
      }
      case "set_prove_transaction_status": {
        const data = { ...decrypted_data.data };

        if (data.i18n) {
          data.message = this.geti18n(data.i18n);
        }

        this.store.commit("gateway/set_prove_transaction_status", data);
        break;
      }
      case "set_check_transaction_status": {
        const data = { ...decrypted_data.data };

        if (data.i18n) {
          data.message = this.geti18n(data.i18n);
        }

        this.store.commit("gateway/set_check_transaction_status", data);
        break;
      }
      case "set_sign_status": {
        this.store.commit("gateway/set_sign_status", decrypted_data.data);
        break;
      }
      case "set_verify_status": {
        this.store.commit("gateway/set_verify_status", decrypted_data.data);
        break;
      }
      case "set_old_gui_import_status":
        this.store.commit(
          "gateway/set_old_gui_import_status",
          decrypted_data.data
        );
        break;

      case "wallet_list":
        this.store.commit("gateway/set_wallet_list", decrypted_data.data);
        break;

      case "settings_changed_reboot":
        this.confirmClose(i18n.global.t("dialog.restart.message"), true);
        break;

      case "session_log": {
        const { level, message } = decrypted_data.data;
        this.pushLog(level || "info", message, "Backend");
        break;
      }

      case "show_notification": {
        let notification = {
          type: "positive",
          timeout: 1000,
          message: ""
        };
        const { data } = decrypted_data;
        if (data.i18n) {
          notification.message = this.geti18n(data.i18n);
        }
        const merged = Object.assign(notification, data);
        Notify.create(merged);

        const logLevel =
          merged.type === "negative"
            ? "error"
            : merged.type === "warning"
            ? "warn"
            : "info";
        this.pushLog(
          logLevel,
          merged.message || "(no message)",
          "Notification"
        );
        break;
      }

      case "show_loading":
        Loading.show({ ...(decrypted_data.data || {}) });
        break;

      case "hide_loading":
        Loading.hide();
        break;

      case "return_to_wallet_select":
        this.router.replace({ path: "/wallet-select" });
        setTimeout(() => {
          this.store.dispatch("gateway/resetWalletData");
        }, 250);
        break;

      case "set_update_required":
        this.store.commit(
          "gateway/set_update_required",
          decrypted_data.data
        );
        break;
    }
  }

  setLanguage(lang) {
    changeLanguage(lang)
      .then(() => {
        LocalStorage.set("language", lang);
      })
      .catch(() => {
        Notify.create({
          type: "negative",
          timeout: 2000,
          message: i18n.global.t("notification.errors.failedToSetLanguage", {
            lang
          })
        });
      });
  }
}
