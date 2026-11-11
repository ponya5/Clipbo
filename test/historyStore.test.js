const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { HistoryStore } = require('../src/historyStore');

function createStore(maxHistorySize = 5) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clipbo-history-'));
  return new HistoryStore(directory, { get: () => maxHistorySize }, () => {});
}

function createFakeImage() {
  return {
    getSize: () => ({ width: 200, height: 100 }),
    toPNG: () => Buffer.from('png-bytes'),
    resize: () => ({ toDataURL: () => 'data:image/png;base64,AAAA' })
  };
}

test('newest item comes first and duplicates move to the top', () => {
  const store = createStore();
  store.addText('one');
  store.addText('two');
  store.addText('one');
  assert.deepStrictEqual(store.list().map((item) => item.text), ['one', 'two']);
});

test('history is trimmed to the size limit', () => {
  const store = createStore(2);
  ['a', 'b', 'c'].forEach((text) => store.addText(text));
  assert.deepStrictEqual(store.list().map((item) => item.text), ['c', 'b']);
});

test('pinned items are listed first and survive clear and the limit', () => {
  const store = createStore(2);
  store.addText('keep');
  store.togglePin(store.list()[0].id);
  ['a', 'b', 'c'].forEach((text) => store.addText(text));
  assert.strictEqual(store.list()[0].text, 'keep');

  store.clear();
  assert.deepStrictEqual(store.list().map((item) => item.text), ['keep']);
});

test('images are saved to disk, deduplicated by hash and deleted with the item', () => {
  const store = createStore();
  store.addImage(createFakeImage(), 'hash-1');
  store.addImage(createFakeImage(), 'hash-1');
  assert.strictEqual(store.list().length, 1);

  const [imageItem] = store.list();
  assert.ok(fs.existsSync(store.imagePathFor(imageItem.id)));
  store.remove(imageItem.id);
  assert.ok(!fs.existsSync(store.imagePathFor(imageItem.id)));
});

test('history persists between sessions', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clipbo-history-'));
  new HistoryStore(directory, { get: () => 5 }, () => {}).addText('persisted');
  const reopenedStore = new HistoryStore(directory, { get: () => 5 }, () => {});
  assert.strictEqual(reopenedStore.list()[0].text, 'persisted');
});
