const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { JsonFileStore } = require('./jsonFileStore');
const { describeFiles } = require('./fileInfo');

const THUMBNAIL_HEIGHT = 96;

class HistoryStore {
  /** `createFileThumbnail(path)` resolves to a data URL or null. */
  constructor(dataDirectory, settings, onChange, createFileThumbnail = async () => null) {
    this.settings = settings;
    this.createFileThumbnail = createFileThumbnail;
    this.onChange = onChange;
    this.store = new JsonFileStore(dataDirectory, 'history.json', []);
    this.items = this.store.load();
    this.imagesDirectory = path.join(dataDirectory, 'images');
    fs.mkdirSync(this.imagesDirectory, { recursive: true, mode: 0o700 });
  }

  /** Pinned items first, then newest first. */
  list() {
    return [...this.items].sort((first, second) => Number(second.pinned) - Number(first.pinned));
  }

  imagePathFor(itemId) {
    return path.join(this.imagesDirectory, `${itemId}.png`);
  }

  find(itemId) {
    return this.items.find((item) => item.id === itemId);
  }

  addText(text) {
    const existingItem = this.items.find((item) => item.type === 'text' && item.text === text);
    if (existingItem) return this.moveToTop(existingItem);
    this.insert({ id: randomUUID(), type: 'text', text, pinned: false, copiedAt: Date.now() });
  }

  addImage(image, hash) {
    const existingItem = this.items.find((item) => item.type === 'image' && item.hash === hash);
    if (existingItem) return this.moveToTop(existingItem);

    const id = randomUUID();
    const { width, height } = image.getSize();
    fs.writeFileSync(this.imagePathFor(id), image.toPNG(), { mode: 0o600 });
    const thumbnail = image.resize({ height: Math.min(height, THUMBNAIL_HEIGHT) }).toDataURL();
    this.insert({ id, type: 'image', hash, thumbnail, width, height, pinned: false, copiedAt: Date.now() });
  }

  /** Files are referenced, not copied, so large videos cost no extra disk space. */
  addFiles(filePaths) {
    const signature = filePaths.join('|');
    const existingItem = this.items.find((item) => item.type === 'file' && item.paths.join('|') === signature);
    if (existingItem) return this.moveToTop(existingItem);

    const item = {
      id: randomUUID(),
      type: 'file',
      paths: filePaths,
      thumbnail: null,
      ...describeFiles(filePaths),
      pinned: false,
      copiedAt: Date.now()
    };
    this.insert(item);
    this.attachThumbnailWhenReady(item);
  }

  attachThumbnailWhenReady(item) {
    this.createFileThumbnail(item.paths[0]).then((thumbnail) => {
      if (!thumbnail || !this.find(item.id)) return;
      item.thumbnail = thumbnail;
      this.persist();
    });
  }

  togglePin(itemId) {
    const item = this.find(itemId);
    if (!item) return;
    item.pinned = !item.pinned;
    this.persist();
  }

  remove(itemId) {
    const item = this.find(itemId);
    if (!item) return;
    this.deleteImageFile(item);
    this.items = this.items.filter((candidate) => candidate.id !== itemId);
    this.persist();
  }

  /** Clears everything except pinned items. */
  clear() {
    this.items.filter((item) => !item.pinned).forEach((item) => this.deleteImageFile(item));
    this.items = this.items.filter((item) => item.pinned);
    this.persist();
  }

  enforceLimit() {
    const unpinnedItems = this.items.filter((item) => !item.pinned);
    const itemsOverLimit = unpinnedItems.slice(this.settings.get('maxHistorySize'));
    itemsOverLimit.forEach((item) => this.deleteImageFile(item));
    const droppedIds = new Set(itemsOverLimit.map((item) => item.id));
    this.items = this.items.filter((item) => !droppedIds.has(item.id));
    this.persist();
  }

  insert(item) {
    this.items.unshift(item);
    this.enforceLimit();
  }

  moveToTop(item) {
    item.copiedAt = Date.now();
    this.items = [item, ...this.items.filter((candidate) => candidate !== item)];
    this.persist();
  }

  deleteImageFile(item) {
    if (item.type !== 'image') return;
    fs.rmSync(this.imagePathFor(item.id), { force: true });
  }

  persist() {
    this.store.save(this.items);
    this.onChange();
  }
}

module.exports = { HistoryStore };
