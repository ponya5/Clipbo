const { app, Tray, nativeImage, powerMonitor } = require('electron');
const path = require('path');
const { Settings } = require('./settings');
const { SettingsController } = require('./settingsController');
const { HistoryStore } = require('./historyStore');
const { VaultStore } = require('./vaultStore');
const { ClipboardMonitor } = require('./clipboardMonitor');
const { ClipboardActions } = require('./clipboardActions');
const { PanelWindow } = require('./panelWindow');
const { HotkeyManager } = require('./hotkeyManager');
const { registerIpcHandlers } = require('./ipcHandlers');
const { buildTrayMenu } = require('./trayMenu');
const { formatAccelerator } = require('./acceleratorLabel');
const { createFileThumbnail } = require('./thumbnailService');
const { createLogger } = require('./logger');
const { startAutoUpdate } = require('./updater');

const APP_ID = 'com.clipbo.app';
const TRAY_ICON_SIZE = 18;

function createTray({ panelWindow, settings, settingsController, historyStore }) {
  const iconPath = path.join(__dirname, '..', 'build', 'tray.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE });
  const tray = new Tray(icon);
  const hotkeyLabel = () => formatAccelerator(settings.get('hotkey'));
  const updateTooltip = () => tray.setToolTip(`Clipbo (${hotkeyLabel()})`);
  updateTooltip();

  const trayActions = {
    openPanel: () => panelWindow.show(),
    openSettings: () => panelWindow.show('settings'),
    setRecordingPaused: (isPaused) => settingsController.change('recordingPaused', isPaused),
    clearHistory: () => historyStore.clear(),
    // Unpackaged dev runs would register the bare Electron.app as a login item.
    setLaunchAtLogin: (enabled) => app.isPackaged && app.setLoginItemSettings({ openAtLogin: enabled }),
    quit: () => app.quit()
  };

  tray.on('click', () => panelWindow.toggle());
  tray.on('right-click', () => {
    const menu = buildTrayMenu({
      isRecordingPaused: settings.get('recordingPaused'),
      launchAtLogin: app.getLoginItemSettings().openAtLogin,
      hotkeyLabel: hotkeyLabel(),
      actions: trayActions
    });
    tray.popUpContextMenu(menu);
  });
  return updateTooltip;
}

function createClipboardMonitor({ settings, historyStore }) {
  const isCaptureEnabled = (kind) => {
    if (settings.get('recordingPaused')) return false;
    if (kind === 'image') return settings.get('captureImages');
    if (kind === 'files') return settings.get('captureFiles');
    return true;
  };
  return new ClipboardMonitor({
    onTextCopied: (text) => historyStore.addText(text),
    onImageCopied: (image, hash) => historyStore.addImage(image, hash),
    onFilesCopied: (filePaths) => historyStore.addFiles(filePaths),
    shouldCapture: isCaptureEnabled
  });
}

function startApp() {
  app.setAppUserModelId(APP_ID);
  const dataDirectory = app.getPath('userData');
  const log = createLogger(dataDirectory);
  process.on('uncaughtException', (error) => log('error', 'Uncaught exception', error));
  process.on('unhandledRejection', (reason) => log('error', 'Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason))));
  app.on('render-process-gone', (_event, _contents, details) => log('error', `Renderer gone: ${details.reason}`));
  app.on('child-process-gone', (_event, details) => log('error', `${details.type} process gone: ${details.reason}`));
  const settings = new Settings(dataDirectory);
  const panelWindow = new PanelWindow(settings);
  const historyStore = new HistoryStore(
    dataDirectory,
    settings,
    () => panelWindow.send('history:changed'),
    createFileThumbnail
  );
  const vaultStore = new VaultStore(
    dataDirectory,
    () => panelWindow.send('vault:locked'),
    () => settings.get('vaultAutoLockMinutes') * 60 * 1000
  );

  const clipboardMonitor = createClipboardMonitor({ settings, historyStore });
  const clipboardActions = new ClipboardActions(clipboardMonitor, panelWindow, settings);
  const hotkeyManager = new HotkeyManager(() => panelWindow.toggle());
  let updateTrayTooltip = () => {};
  const settingsController = new SettingsController({
    settings,
    historyStore,
    hotkeyManager,
    onChanged: () => updateTrayTooltip()
  });

  panelWindow.create();
  registerIpcHandlers({ historyStore, vaultStore, settings, settingsController, clipboardActions, panelWindow });
  clipboardMonitor.start();
  startAutoUpdate(log);
  updateTrayTooltip = createTray({ panelWindow, settings, settingsController, historyStore });

  const isHotkeyRegistered = hotkeyManager.register(settings.get('hotkey'));
  if (!isHotkeyRegistered) panelWindow.show('settings');
  app.on('second-instance', () => panelWindow.show());
  app.on('will-quit', () => {
    hotkeyManager.unregisterAll();
    vaultStore.files.clearTemp();
  });

  const lockVaultIfConfigured = () => {
    if (settings.get('lockVaultOnSleep')) vaultStore.lock();
  };
  powerMonitor.on('suspend', lockVaultIfConfigured);
  powerMonitor.on('lock-screen', lockVaultIfConfigured);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.dock?.hide();
  app.whenReady().then(startApp);
  app.on('window-all-closed', () => {});
}
