const path = require('path');
const { app, BrowserWindow, screen } = require('electron');

const PANEL_SIZES = {
  compact: { width: 420, height: 520 },
  normal: { width: 480, height: 620 },
  large: { width: 560, height: 740 }
};
const IGNORE_SHOW_AFTER_HIDE_MS = 250;

/** The popup that shows clipboard history and the vault. */
class PanelWindow {
  constructor(settings) {
    this.settings = settings;
    this.window = null;
    this.lastHiddenAt = 0;
    this.isAutoHideSuspended = false;
  }

  create() {
    this.window = new BrowserWindow({
      ...this.currentSize(),
      show: false,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      fullscreenable: false,
      backgroundColor: '#0d1b45',
      type: process.platform === 'darwin' ? 'panel' : undefined,
      webPreferences: {
        preload: path.join(__dirname, 'renderer', 'preload.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false
      }
    });
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.window.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    this.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.window.webContents.on('will-navigate', (event) => event.preventDefault());
    this.window.on('blur', () => {
      if (!this.isAutoHideSuspended && this.settings.get('hideOnBlur')) this.hide();
    });
  }

  /** Keeps the panel open while a native dialog (file picker, confirmation) is showing. */
  async runWithoutAutoHide(action) {
    this.isAutoHideSuspended = true;
    try {
      return await action();
    } finally {
      this.isAutoHideSuspended = false;
    }
  }

  isVisible() {
    return this.window.isVisible();
  }

  toggle() {
    if (this.isVisible()) return this.hide();
    this.show();
  }

  show(tabName) {
    if (Date.now() - this.lastHiddenAt < IGNORE_SHOW_AFTER_HIDE_MS) return;
    this.window.setSize(...Object.values(this.currentSize()));
    this.positionWindow();
    this.window.show();
    this.window.focus();
    this.send('panel:shown', tabName);
  }

  hide() {
    if (!this.isVisible()) return;
    this.lastHiddenAt = Date.now();
    this.window.hide();
    if (process.platform === 'darwin') app.hide();
  }

  send(channel, ...args) {
    if (!this.window || this.window.isDestroyed()) return;
    this.window.webContents.send(channel, ...args);
  }

  currentSize() {
    return PANEL_SIZES[this.settings.get('popupSize')] ?? PANEL_SIZES.normal;
  }

  /** Centers on the screen with the cursor, or places the panel next to the cursor, kept fully on screen. */
  positionWindow() {
    const cursorPoint = screen.getCursorScreenPoint();
    const { x, y, width, height } = screen.getDisplayNearestPoint(cursorPoint).workArea;
    const { width: panelWidth, height: panelHeight } = this.currentSize();

    if (this.settings.get('popupPosition') === 'mouse') {
      const left = Math.min(Math.max(cursorPoint.x - panelWidth / 2, x), x + width - panelWidth);
      const top = Math.min(Math.max(cursorPoint.y + 12, y), y + height - panelHeight);
      this.window.setPosition(Math.round(left), Math.round(top));
      return;
    }
    this.window.setPosition(
      Math.round(x + (width - panelWidth) / 2),
      Math.round(y + (height - panelHeight) / 3)
    );
  }
}

module.exports = { PanelWindow };
