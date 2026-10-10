const { contextBridge, ipcRenderer, webUtils } = require("electron");
const { SCEE } = require("./main-process/modules/SCEE-Node");

const scee = new SCEE();

// Buffer the "initialize" event eagerly in the preload.
// Quasar/Vite dynamically imports boot files after did-finish-load fires, so
// the main process can send "initialize" before the renderer has called
// window.electronAPI.onInitialize(). Capturing it here guarantees the data
// is never lost, regardless of timing.
let _initData = null;
let _initCallbacks = [];
ipcRenderer.once("initialize", (_e, data) => {
  _initData = data;
  _initCallbacks.forEach(fn => fn(data));
  _initCallbacks = [];
});

contextBridge.exposeInMainWorld("electronAPI", {
  onInitialize: callback => {
    if (_initData !== null) {
      // Data already arrived — deliver synchronously so the gateway can
      // set up the WebSocket without waiting for another event cycle.
      callback(_initData);
    } else {
      _initCallbacks.push(callback);
    }
  },
  onConfirmClose: callback =>
    ipcRenderer.on("confirmClose", () => callback()),
  onShowQuitScreen: callback =>
    ipcRenderer.on("showQuitScreen", () => callback()),
  confirmClose: restart => ipcRenderer.send("confirmClose", restart),
  copyToClipboard: text => ipcRenderer.invoke("copy-to-clipboard", text),
  copyImageToClipboard: dataUrl =>
    ipcRenderer.invoke("copy-image-to-clipboard", dataUrl),
  openExternal: url => ipcRenderer.invoke("open-external", url),
  getPlatform: () => process.platform,
  // Electron 32 removed File.path; this is the supported way to get a chosen file's path.
  getPathForFile: file => webUtils.getPathForFile(file),
  sceeEncrypt: (plaintext, password) => scee.encryptString(plaintext, password),
  sceeDecrypt: (ciphertext, password) =>
    scee.decryptString(ciphertext, password)
});
