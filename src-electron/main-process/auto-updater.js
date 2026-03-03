import * as path from "path";
import * as fs from "fs-extra";
import { dialog, app } from "electron";
import { autoUpdater } from "electron-updater";

let isUpdating = false;

async function canAutoUpdate() {
  const { isPackaged } = app;

  if (isPackaged && !process.resourcesPath) {
    return false;
  }

  const updateFile = isPackaged ? "app-update.yml" : "dev-app-update.yml";
  const basePath =
    isPackaged && process.resourcesPath
      ? process.resourcesPath
      : app.getAppPath();
  const appUpdateConfigPath = path.join(basePath, updateFile);

  try {
    return fs.existsSync(appUpdateConfigPath);
  } catch (e) {
    return false;
  }
}

async function checkForUpdate(getMainWindow, onQuitAndInstall) {
  const isDev = !app.isPackaged;
  if (isDev) {
    return;
  }

  if (isUpdating) {
    return;
  }

  const canUpdate = await canAutoUpdate();
  if (!canUpdate) {
    return;
  }

  autoUpdater.logger = console;

  try {
    const info = await autoUpdater.checkForUpdates();
    if (!info || !info.downloadPromise) {
      console.info("auto-update: no update to download");
      return;
    }

    try {
      await info.downloadPromise;
    } catch (error) {
      await showCannotUpdateDialog(getMainWindow());
      throw error;
    }

    console.info("auto-update: showing update dialog...");
    const shouldUpdate = await showUpdateDialog(getMainWindow());
    if (!shouldUpdate) {
      return;
    }

    console.info("auto-update: calling quitAndInstall...");
    if (onQuitAndInstall) {
      onQuitAndInstall(autoUpdater);
    }
  } catch (error) {
    console.error("auto-update error:", getPrintableError(error));
  } finally {
    isUpdating = false;
  }
}

function getPrintableError(error) {
  return error && error.stack ? error.stack : error;
}

async function showUpdateDialog(mainWindow) {
  const RESTART_BUTTON = 0;
  const options = {
    type: "info",
    buttons: ["Restart Wallet", "Later"],
    title: "XEQ GUI update available",
    message: "There is a new version of XEQ GUI available.",
    detail: "Press Restart Wallet to apply the update",
    defaultId: 1,
    cancelId: RESTART_BUTTON
  };
  const { response } = await dialog.showMessageBox(mainWindow, options);
  return response === RESTART_BUTTON;
}

async function showCannotUpdateDialog(mainWindow) {
  const options = {
    type: "error",
    buttons: ["Ok"],
    title: "Cannot update",
    message:
      "XEQ GUI failed to update but there is a new version available. Please download the new version manually."
  };
  await dialog.showMessageBox(mainWindow, options);
}

export { checkForUpdate };
