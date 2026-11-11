const { app, Tray, nativeImage, globalShortcut, powerMonitor } = require('electron');
const path = require('path');
const { Settings } = require('./settings');
const { HistoryStore } = require('./historyStore');
const { VaultStore } = require('./vaultStore');
const { ClipboardMonitor } = require('./clipboardMonitor');
const { ClipboardActions } = require('./clipboardActions');
const { PanelWindow } = require('./panelWindow');
const { registerIpcHandlers } = require('./ipcHandlers');
const { buildTrayMenu } = require('./trayMenu');

const APP_ID = 'com.clipbo.app';
const HOTKEY = 'CommandOrControl+Shift+V';
const HOTKEY_LABEL = process.platform === 'darwin' ? '⌘⇧V' : 'Ctrl+Shift+V';
const TRAY_ICON_SIZE = 18;

function createTray({ panelWindow, settings, historyStore, vaultStore }) {
  const iconPath = path.join(__dirname, '..', 'build', 'tray.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE });
  const tray = new Tray(icon);
  tray.setToolTip(`Clipbo (${HOTKEY_LABEL})`);

  const trayActions = {
    openPanel: () => panelWindow.show(),
    clearHistory: () => historyStore.clear(),
    openSettings: () => panelWindow.show('settings'),
    changeSetting: (name, value) => {
      settings.set(name, value);
      if (name === 'maxHistorySize') historyStore.enforceLimit();
    },
    setLaunchAtLogin: (enabled) => app.setLoginItemSettings({ openAtLogin: enabled }),
    quit: () => app.quit()
  };

  tray.on('click', () => panelWindow.toggle());
  tray.on('right-click', () => {
    const menu = buildTrayMenu({
      settings,
      launchAtLogin: app.getLoginItemSettings().openAtLogin,
      hotkeyLabel: HOTKEY_LABEL,
      actions: trayActions
    });
    tray.popUpContextMenu(menu);
  });
}

function startApp() {
  app.setAppUserModelId(APP_ID);
  const dataDirectory = app.getPath('userData');
  const panelWindow = new PanelWindow();
  const settings = new Settings(dataDirectory);
  const historyStore = new HistoryStore(dataDirectory, settings, () => panelWindow.send('history:changed'));
  const vaultStore = new VaultStore(
    dataDirectory,
    () => panelWindow.send('vault:locked'),
    () => settings.get('vaultAutoLockMinutes') * 60 * 1000
  );

  const clipboardMonitor = new ClipboardMonitor({
    onTextCopied: (text) => historyStore.addText(text),
    onImageCopied: (image, hash) => historyStore.addImage(image, hash)
  });
  const clipboardActions = new ClipboardActions(clipboardMonitor, panelWindow, settings);

  panelWindow.create();
  registerIpcHandlers({ historyStore, vaultStore, settings, clipboardActions, panelWindow });
  clipboardMonitor.start();
  createTray({ panelWindow, settings, historyStore, vaultStore });

  const isHotkeyRegistered = globalShortcut.register(HOTKEY, () => panelWindow.toggle());
  if (!isHotkeyRegistered) panelWindow.show();
  app.on('second-instance', () => panelWindow.show());

  powerMonitor.on('suspend', () => vaultStore.lock());
  powerMonitor.on('lock-screen', () => vaultStore.lock());
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.dock?.hide();
  app.whenReady().then(startApp);
  app.on('window-all-closed', () => {});
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
