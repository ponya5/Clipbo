const { clipboard } = require('electron');
const crypto = require('crypto');

const POLL_INTERVAL_MS = 500;
const MAC_CONCEALED_FORMATS = ['org.nspasteboard.ConcealedType', 'org.nspasteboard.TransientType'];

/** Polls the system clipboard and reports newly copied text or images. */
class ClipboardMonitor {
  constructor({ onTextCopied, onImageCopied }) {
    this.onTextCopied = onTextCopied;
    this.onImageCopied = onImageCopied;
    this.lastSignature = this.readSnapshot()?.signature ?? null;
    this.timer = null;
  }

  start() {
    this.timer = setInterval(() => this.checkClipboardSafely(), POLL_INTERVAL_MS);
  }

  /** Writes text without recording it again as a new copy. */
  writeText(text) {
    clipboard.writeText(text);
    this.lastSignature = this.readSnapshot()?.signature ?? null;
  }

  /** Writes an image without recording it again as a new copy. */
  writeImage(image) {
    clipboard.writeImage(image);
    this.lastSignature = this.readSnapshot()?.signature ?? null;
  }

  /** Clears the clipboard only if it still holds the given text. */
  clearIfTextEquals(text) {
    if (clipboard.readText() !== text) return;
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
    if (!snapshot) return;

    if (snapshot.kind === 'text') this.onTextCopied(snapshot.text);
    else this.onImageCopied(snapshot.image, snapshot.hash);
  }

  /** Text wins over image, because apps like Excel put both on the clipboard. */
  readSnapshot() {
    const text = clipboard.readText();
    if (text.trim()) return { kind: 'text', signature: `text:${text}`, text };

    const hasImageFormat = clipboard.availableFormats().some((format) => format.startsWith('image/'));
    if (!hasImageFormat) return null;

    const image = clipboard.readImage();
    if (image.isEmpty()) return null;
    const hash = crypto.createHash('md5').update(image.toBitmap()).digest('hex');
    return { kind: 'image', signature: `image:${hash}`, image, hash };
  }

  /** Password managers mark secrets with these macOS pasteboard types. */
  isSensitiveContent() {
    const availableFormats = clipboard.availableFormats();
    return MAC_CONCEALED_FORMATS.some((format) => availableFormats.includes(format));
  }
}

module.exports = { ClipboardMonitor };
