const { clipboard } = require('electron');
const crypto = require('crypto');
const { readCopiedFilePaths } = require('./filePasteboard');

const POLL_INTERVAL_MS = 500;
const WINDOWS_EXCLUDE_FORMAT = 'ExcludeClipboardContentFromMonitorProcessing';
const MAC_CONCEALED_FORMATS = ['org.nspasteboard.ConcealedType', 'org.nspasteboard.TransientType'];

/**
 * Polls the system clipboard and reports newly copied files, text or images.
 * `shouldCapture(kind)` lets settings pause recording or disable a kind.
 */
class ClipboardMonitor {
  constructor({ onTextCopied, onImageCopied, onFilesCopied, shouldCapture }) {
    this.onTextCopied = onTextCopied;
    this.onImageCopied = onImageCopied;
    this.onFilesCopied = onFilesCopied;
    this.shouldCapture = shouldCapture;
    this.lastSignature = this.readSnapshot()?.signature ?? null;
    this.timer = null;
  }

  start() {
    this.timer = setInterval(() => this.checkClipboardSafely(), POLL_INTERVAL_MS);
  }

  /** Writes text without recording it again as a new copy. */
  writeText(text) {
    clipboard.writeText(text);
    this.syncSignature();
  }

  /** Writes an image without recording it again as a new copy. */
  writeImage(image) {
    clipboard.writeImage(image);
    this.syncSignature();
  }

  /** Call after the clipboard was changed by Clipbo itself. */
  syncSignature() {
    this.lastSignature = this.readSnapshot()?.signature ?? null;
  }

  /** Clears the clipboard only if it still holds the given text. */
  clearIfTextEquals(text) {
    if (clipboard.readText() !== text) return;
    clipboard.clear();
    this.lastSignature = null;
  }

  /** Clears the clipboard only if it still holds the content with this signature (image or files). */
  clearIfSignatureEquals(signature) {
    if (!signature || this.readSnapshot()?.signature !== signature) return;
    clipboard.clear();
    this.lastSignature = null;
  }

  /** A clipboard read can fail when another app holds it; just try again on the next tick. */
  checkClipboardSafely() {
    try {
      this.checkClipboard();
    } catch (error) {
      console.error('Clipboard check failed:', error.message);
    }
  }

  checkClipboard() {
    if (this.isSensitiveContent()) return;

    const snapshot = this.readSnapshot();
    const signature = snapshot?.signature ?? null;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    if (!snapshot || !this.shouldCapture(snapshot.kind)) return;

    if (snapshot.kind === 'text') this.onTextCopied(snapshot.text);
    else if (snapshot.kind === 'image') this.onImageCopied(snapshot.image, snapshot.hash);
    else this.onFilesCopied(snapshot.filePaths);
  }

  /** Files win over text (Finder also adds the file name as text), and text wins over image. */
  readSnapshot() {
    const filePaths = readCopiedFilePaths(clipboard);
    if (filePaths.length) return { kind: 'files', signature: `files:${filePaths.join('|')}`, filePaths };

    const text = clipboard.readText();
    if (text.trim()) return { kind: 'text', signature: `text:${text}`, text };

    const hasImageFormat = clipboard.availableFormats().some((format) => format.startsWith('image/'));
    if (!hasImageFormat) return null;

    const image = clipboard.readImage();
    if (image.isEmpty()) return null;
    const hash = crypto.createHash('md5').update(image.toBitmap()).digest('hex');
    return { kind: 'image', signature: `image:${hash}`, image, hash };
  }

  /** Password managers mark secrets with these macOS pasteboard types or the Windows clipboard format. */
  isSensitiveContent() {
    const availableFormats = clipboard.availableFormats();
    if (MAC_CONCEALED_FORMATS.some((format) => availableFormats.includes(format))) return true;
    if (process.platform !== 'win32') return false;
    try {
      return clipboard.readBuffer(WINDOWS_EXCLUDE_FORMAT).length > 0;
    } catch {
      return false;
    }
  }
}

module.exports = { ClipboardMonitor };
