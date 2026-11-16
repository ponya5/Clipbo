const { nativeImage } = require('electron');
const { pasteIntoFocusedApp } = require('./pasteService');
const { writeFilesToClipboard } = require('./fileClipboard');
const { allFilesExist } = require('./fileInfo');

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

  pasteImage(imagePath, shouldPaste = this.settings.get('autoPaste')) {
    this.clipboardMonitor.writeImage(nativeImage.createFromPath(imagePath));
    this.closePanelAndPaste(shouldPaste);
  }

  /** Returns { ok: false, message } when a file was moved or deleted since it was copied. */
  async pasteFiles(filePaths, shouldPaste = this.settings.get('autoPaste')) {
    if (!allFilesExist(filePaths)) return { ok: false, message: 'The file no longer exists at its original location' };
    await writeFilesToClipboard(filePaths);
    this.clipboardMonitor.syncSignature();
    this.closePanelAndPaste(shouldPaste);
    return { ok: true };
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

  /** Copies a form field without closing the panel; secrets get the clear-after timer. */
  copyField(text, isSecret) {
    this.clipboardMonitor.writeText(text);
    if (isSecret) this.scheduleSecretClear(text);
  }

  /** Decrypted vault files get the same clear-after timer as secrets; `cleanup` also removes the temp copy. */
  scheduleAttachmentClear(cleanup) {
    const clearAfterSeconds = this.settings.get('secretClearSeconds');
    if (clearAfterSeconds <= 0) return;
    const { lastSignature: signature } = this.clipboardMonitor; // set when the attachment was just written
    setTimeout(() => {
      this.clipboardMonitor.clearIfSignatureEquals(signature);
      cleanup();
    }, clearAfterSeconds * 1000);
  }

  /** The user can choose "never" (0) in the tray menu. */
  scheduleSecretClear(secret) {
    const clearAfterSeconds = this.settings.get('secretClearSeconds');
    if (clearAfterSeconds <= 0) return;
    setTimeout(() => this.clipboardMonitor.clearIfTextEquals(secret), clearAfterSeconds * 1000);
  }

  /** With "paste automatically" off, the item is only placed on the clipboard. */
  closePanelAndPaste(shouldPaste = this.settings.get('autoPaste')) {
    this.panelWindow.hide();
    if (!shouldPaste) return;
    setTimeout(pasteIntoFocusedApp, PASTE_DELAY_MS);
  }
}

module.exports = { ClipboardActions };
