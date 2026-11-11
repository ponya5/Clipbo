const { nativeImage } = require('electron');
const { pasteIntoFocusedApp } = require('./pasteService');

const PASTE_DELAY_MS = 150;

/** Puts content on the clipboard, closes the panel and (optionally) pastes into the previous app. */
class ClipboardActions {
  constructor(clipboardMonitor, panelWindow, settings) {
    this.clipboardMonitor = clipboardMonitor;
    this.panelWindow = panelWindow;
    this.settings = settings;
  }

  pasteText(text) {
    this.clipboardMonitor.writeText(text);
    this.closePanelAndPaste();
  }

  pasteImage(imagePath) {
    this.clipboardMonitor.writeImage(nativeImage.createFromPath(imagePath));
    this.closePanelAndPaste();
  }

  pasteSecret(secret) {
    this.pasteText(secret);
    this.scheduleSecretClear(secret);
  }

  /** Copies without pasting, e.g. for terminals or password fields that block automation. */
  copySecret(secret) {
    this.clipboardMonitor.writeText(secret);
    this.panelWindow.hide();
    this.scheduleSecretClear(secret);
  }

  /** The user can choose "never" (0) in the tray menu. */
  scheduleSecretClear(secret) {
    const clearAfterSeconds = this.settings.get('secretClearSeconds');
    if (clearAfterSeconds <= 0) return;
    setTimeout(() => this.clipboardMonitor.clearIfTextEquals(secret), clearAfterSeconds * 1000);
  }

  closePanelAndPaste() {
    this.panelWindow.hide();
    setTimeout(pasteIntoFocusedApp, PASTE_DELAY_MS);
  }
}

module.exports = { ClipboardActions };
