import { el } from './dom.js';
import { ListController } from './listController.js';
import { hasCommandKey, isBackspaceOrDelete } from './keyboard.js';

const QUICK_PICK_COUNT = 9;

function formatSize(bytes) {
  if (!bytes) return 'unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unitIndex).toFixed(unitIndex ? 1 : 0)} ${units[unitIndex]}`;
}

function formatAge(timestamp) {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}

export class HistoryView {
  constructor({ listElement, api, saveTextToVault, showPreview, notify }) {
    this.api = api;
    this.saveTextToVault = saveTextToVault;
    this.showPreview = showPreview;
    this.notify = notify;
    this.query = '';
    this.allItems = [];
    this.list = new ListController(
      listElement,
      (item, index) => this.buildRow(item, index),
      (item) => this.paste(item)
    );
  }

  searchPlaceholder = 'Search clipboard history…';

  hints = [
    ['↑ ↓', 'navigate'],
    ['Enter', 'paste'],
    ['Mod+1-9', 'quick paste'],
    ['Mod+P', 'pin'],
    ['Mod+Y', 'preview'],
    ['Mod+S', 'save to vault'],
    ['Mod+⌫', 'delete'],
    ['Tab', 'vault']
  ];

  isListMode() {
    return true;
  }

  async activate() {
    this.allItems = await this.api.history.list();
    this.applyFilter();
  }

  onSearch(query) {
    this.query = query.toLowerCase();
    this.list.resetSelection();
    this.applyFilter();
  }

  /** Files can be moved after copying, so pasting may fail with a message. */
  async paste(item) {
    const result = await this.api.history.paste(item.id);
    if (!result.ok) this.notify(result.message);
  }

  onEnter() {
    const item = this.list.selectedItem;
    if (item) this.paste(item);
  }

  onQuickPick(index) {
    const item = this.list.itemAt(index);
    if (item) this.paste(item);
  }

  onEscape() {
    return false;
  }

  /** Returns true when the shortcut was handled. */
  onShortcut(event) {
    const item = this.list.selectedItem;
    if (!item || !hasCommandKey(event)) return false;

    if (isBackspaceOrDelete(event)) {
      this.api.history.remove(item.id);
      return true;
    }
    if (event.key.toLowerCase() === 'y' && item.type !== 'text') {
      this.openPreview(item);
      return true;
    }
    if (event.key.toLowerCase() === 'p') {
      this.api.history.togglePin(item.id);
      return true;
    }
    if (event.key.toLowerCase() === 's' && item.type === 'text') {
      this.saveTextToVault(item.text);
      return true;
    }
    return false;
  }

  async openPreview(item) {
    const preview = await this.api.history.preview(item.id);
    if (preview) this.showPreview(preview);
  }

  applyFilter() {
    const matchingItems = this.allItems.filter((item) => this.matchesQuery(item));
    const emptyMessage = this.query
      ? 'No matches'
      : 'Copy some text or an image and it will show up here';
    this.list.setItems(matchingItems, emptyMessage);
  }

  matchesQuery(item) {
    if (!this.query) return true;
    if (item.type === 'image') return 'image screenshot picture'.includes(this.query);
    if (item.type === 'file') return `${item.name} ${item.kind}`.toLowerCase().includes(this.query);
    return item.text.toLowerCase().includes(this.query);
  }

  buildRow(item, index) {
    const content = this.buildContent(item);
    const meta = el('div', { className: 'meta' });
    if (item.pinned) meta.append(el('span', { className: 'pin', text: '📌' }));
    meta.append(el('span', { text: formatAge(item.copiedAt) }));

    const badge = index < QUICK_PICK_COUNT ? el('span', { className: 'badge', text: String(index + 1) }) : '';
    return el('li', { className: 'row' }, badge, content, meta);
  }

  buildContent(item) {
    if (item.type === 'image') return this.buildImageContent(item);
    if (item.type === 'file') return this.buildFileContent(item);
    return this.buildTextContent(item);
  }

  buildFileContent(item) {
    const isVideo = item.kind === 'video';
    const thumbnail = item.thumbnail
      ? el('img', { className: 'thumbnail', attributes: { src: item.thumbnail, alt: item.name } })
      : el('div', { className: 'thumbnail placeholder', text: isVideo ? '🎬' : '📄' });
    const frame = el('div', { className: 'thumbnail-frame' }, thumbnail);
    if (isVideo) frame.append(el('span', { className: 'play-badge', text: '▶' }));
    const details = el('div', {},
      el('div', { className: 'file-name', text: item.name }),
      el('div', { className: 'image-label', text: `${isVideo ? 'Video' : 'File'} · ${formatSize(item.sizeBytes)}` }));
    return el('div', { className: 'content image-content' }, frame, details);
  }

  buildTextContent(item) {
    return el('div', { className: 'content' }, el('div', { className: 'text-preview', text: item.text.trim() }));
  }

  buildImageContent(item) {
    const thumbnail = el('div', { className: 'thumbnail-frame' },
      el('img', { className: 'thumbnail', attributes: { src: item.thumbnail, alt: 'Copied image' } }));
    const label = el('div', { className: 'image-label', text: `Image · ${item.width}×${item.height}` });
    return el('div', { className: 'content image-content' }, thumbnail, label);
  }
}
