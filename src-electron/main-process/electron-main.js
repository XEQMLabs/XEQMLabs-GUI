import {
  app,
  ipcMain,
  BrowserWindow,
  Menu,
  dialog,
  clipboard,
  nativeImage,
  shell,
  session
} from "electron";
import { version, productName } from "../../package.json";
import { Backend } from "./modules/backend";
import { checkForUpdate } from "./auto-updater";
import menuTemplate from "./menu";
const portscanner = require("portscanner");
const windowStateKeeper = require("electron-window-state");
const path = require("upath");
const fs = require("fs");
const { pathToFileURL } = require("url");

if (
  process.env.NODE_OPTIONS &&
  process.env.NODE_OPTIONS.includes("--openssl-legacy-provider")
) {
  delete process.env.NODE_OPTIONS;
}

if (process.env.PROD) {
  global.__statics = path.join(__dirname, "").replace(/\\/g, "\\\\");
  global.__ryo_bin = path.join(__dirname, "..", "bin").replace(/\\/g, "\\\\");
  global.__ryo_bin_legacy = path.join(__dirname, "..", "bin-legacy").replace(/\\/g, "\\\\");
} else {
  global.__ryo_bin = path.join(process.cwd(), "bin").replace(/\\/g, "\\\\");
  global.__ryo_bin_legacy = path.join(process.cwd(), "bin-legacy").replace(/\\/g, "\\\\");
}

let mainWindow, backend;
let showConfirmClose = true;
let forceQuit = false;
let installUpdate = false;

const title = `${productName} v${version}`;
const isDev = !app.isPackaged;

process.on("uncaughtException", error => {
  console.error("Uncaught Exception in main process:", error);
  console.error("Stack:", error.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

const selectionMenu = Menu.buildFromTemplate([
  { role: "copy" },
  { type: "separator" },
  { role: "selectAll" }
]);

const inputMenu = Menu.buildFromTemplate([
  { role: "cut" },
  { role: "copy" },
  { role: "paste" },
  { type: "separator" },
  { role: "selectAll" }
]);

function createWindow() {
  let mainWindowState = windowStateKeeper({
    defaultWidth: 900,
    defaultHeight: 700
  });

  let iconPath;
  try {
    if (process.env.PROD && __statics) {
      iconPath = require("path").join(__statics, "icon.png");
    } else {
      const iconDevPath = path.join(
        process.cwd(),
        "src-electron",
        "icons",
        "icon.png"
      );
      if (fs.existsSync(iconDevPath)) {
        iconPath = iconDevPath;
      }
    }
  } catch (e) {
    iconPath = null;
  }

  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 640,
    minHeight: 480,
    ...(iconPath ? { icon: iconPath } : {}),
    title,
    backgroundColor: "#000000",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.resolve(__dirname, "electron-preload.js")
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("close", e => {
    if (installUpdate) {
      return;
    }

    if (process.platform === "darwin") {
      if (forceQuit) {
        forceQuit = false;
        if (showConfirmClose) {
          e.preventDefault();
          mainWindow.show();
          mainWindow.webContents.send("confirmClose");
        } else {
          e.defaultPrevented = false;
        }
      } else {
        e.preventDefault();
        mainWindow.hide();
      }
    } else {
      if (showConfirmClose) {
        e.preventDefault();
        mainWindow.webContents.send("confirmClose");
      } else {
        e.defaultPrevented = false;
      }
    }
  });

  ipcMain.on("confirmClose", (e, restart) => {
    showConfirmClose = false;
    if (restart && !isDev) app.relaunch();

    const promise = backend ? backend.quit() : Promise.resolve();
    promise.then(() => {
      backend = null;
      app.quit();
    });
  });

  ipcMain.handle("get-backend-port", () => {
    return backend ? backend.wss_port : null;
  });

  ipcMain.handle("copy-to-clipboard", (_e, text) => {
    if (typeof text !== "string") return;
    clipboard.writeText(text);
  });

  ipcMain.handle("copy-image-to-clipboard", (_e, dataUrl) => {
    const img = nativeImage.createFromDataURL(dataUrl);
    clipboard.writeImage(img);
  });

  ipcMain.handle("open-external", (_e, url) => {
    if (typeof url === "string" && url.startsWith("https://")) {
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.setTitle(title);

    require("crypto").randomBytes(64, (err, buffer) => {
      if (err) throw err;

      let config = {
        port: 12313,
        token: buffer.toString("hex")
      };

      portscanner.checkPortStatus(config.port, "127.0.0.1", (error, status) => {
        if (error) {
          console.error(error);
        }

        if (status === "closed") {
          backend = new Backend(mainWindow);
          backend.init(config);
          mainWindow.webContents.send("initialize", config);
        } else {
          dialog
            .showMessageBox(mainWindow, {
              title: "Startup error",
              message: `XEQ GUI is already open, or port ${config.port} is in use`,
              type: "error",
              buttons: ["ok"]
            })
            .then(() => {
              showConfirmClose = false;
              app.quit();
            });
        }
      });
    });
  });

  mainWindow.webContents.on("context-menu", (e, props) => {
    const { selectionText, isEditable } = props;
    if (isEditable) {
      inputMenu.popup(mainWindow);
    } else if (selectionText && selectionText.trim() !== "") {
      selectionMenu.popup(mainWindow);
    }
  });

  // In production packaged build, APP_URL may be unset; build file URL from __dirname
  let appUrl = process.env.APP_URL;
  if (!appUrl && process.env.PROD) {
    const indexHere = path.join(__dirname, "index.html");
    const indexParent = path.join(__dirname, "..", "index.html");
    const indexPath = fs.existsSync(indexHere)
      ? indexHere
      : fs.existsSync(indexParent)
        ? indexParent
        : indexHere;
    appUrl = pathToFileURL(indexPath).href;
  }
  appUrl = appUrl || "";
  mainWindow.loadURL(appUrl);
  mainWindowState.manage(mainWindow);

  // Prevent the renderer from navigating away from the app.
  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (url !== appUrl && !url.startsWith(appUrl)) {
      e.preventDefault();
    }
  });

  // Deny all popup / new-window requests from the renderer.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" && isDev) {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on("ready", () => {
    // Deny all permission requests from the renderer (camera, mic, notifications, etc.).
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
      callback(false);
    });

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; " +
              "script-src 'self'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "font-src 'self' data:; " +
              "connect-src 'self' ws://127.0.0.1:*; " +
              "img-src 'self' data:"
          ]
        }
      });
    });

    checkForUpdate(
      () => mainWindow,
      autoUpdater => {
        if (mainWindow) {
          mainWindow.webContents.send("showQuitScreen");
        }

        const promise = backend ? backend.quit() : Promise.resolve();
        promise.then(() => {
          installUpdate = true;
          backend = null;
          autoUpdater.quitAndInstall();
        });
      }
    );
    if (process.platform === "darwin") {
      const menu = Menu.buildFromTemplate(menuTemplate);
      Menu.setApplicationMenu(menu);
    }
    createWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (mainWindow === null) {
      createWindow();
    } else if (process.platform === "darwin") {
      mainWindow.show();
    }
  });

  app.on("before-quit", () => {
    if (installUpdate) {
      return;
    }

    if (process.platform === "darwin") {
      forceQuit = true;
    } else {
      if (backend) {
        backend.quit().then(() => {
          mainWindow.close();
        });
      }
    }
  });

  app.on("quit", () => {});
}
