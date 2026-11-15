const { app } = require('electron');

/** Checks GitHub releases at startup and every 6 hours; installs on next quit. */
function startAutoUpdate(log) {
  if (!app.isPackaged) return;
  const { autoUpdater } = require('electron-updater');
  autoUpdater.logger = { info: (m) => log('info', String(m)), warn: (m) => log('warn', String(m)), error: (m) => log('error', String(m)), debug() {} };
  autoUpdater.autoInstallOnAppQuit = true;
  const check = () => autoUpdater.checkForUpdates().catch((error) => log('error', 'Update check failed', error));
  check();
  setInterval(check, 6 * 60 * 60 * 1000);
}

module.exports = { startAutoUpdate };
