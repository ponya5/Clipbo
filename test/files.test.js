const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { HistoryStore } = require('../src/historyStore');
const { isVideoPath, describeFiles } = require('../src/fileInfo');
const { formatAccelerator } = require('../src/acceleratorLabel');
const { Settings, isValidAccelerator } = require('../src/settings');

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

test('detects video files by extension', () => {
  assert.ok(isVideoPath('/a/b/Clip.MOV'));
  assert.ok(!isVideoPath('/a/b/report.pdf'));
});

test('describes single and multiple files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clipbo-files-'));
  const videoPath = path.join(directory, 'demo.mp4');
  fs.writeFileSync(videoPath, 'x'.repeat(2048));
  assert.deepStrictEqual(describeFiles([videoPath]), { kind: 'video', name: 'demo.mp4', sizeBytes: 2048 });
  assert.strictEqual(describeFiles([videoPath, videoPath]).kind, 'file');
});

test('copied files are stored, get a thumbnail later, and are deduplicated', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clipbo-files-'));
  const store = new HistoryStore(directory, { get: () => 50 }, () => {}, async () => 'data:image/png;base64,AAAA');
  store.addFiles(['/videos/clip.mp4']);
  store.addFiles(['/videos/clip.mp4']);
  assert.strictEqual(store.list().length, 1);
  assert.strictEqual(store.list()[0].kind, 'video');

  await flushPromises();
  assert.strictEqual(store.list()[0].thumbnail, 'data:image/png;base64,AAAA');
});

test('shortcut validation requires a real modifier and a valid key', () => {
  assert.ok(isValidAccelerator('CommandOrControl+Shift+V'));
  assert.ok(isValidAccelerator('Alt+Space'));
  assert.ok(!isValidAccelerator('Shift+V'));
  assert.ok(!isValidAccelerator('V'));
  assert.ok(!isValidAccelerator('Control+Escape'));
  assert.ok(!isValidAccelerator(42));
});

test('shortcut labels differ per platform', () => {
  assert.strictEqual(formatAccelerator('CommandOrControl+Shift+V', 'darwin'), '⌘⇧V');
  assert.strictEqual(formatAccelerator('CommandOrControl+Shift+V', 'win32'), 'Ctrl+Shift+V');
});

test('boolean and select settings are validated by type', () => {
  const settings = new Settings(fs.mkdtempSync(path.join(os.tmpdir(), 'clipbo-settings-')));
  settings.set('autoPaste', false);
  assert.strictEqual(settings.get('autoPaste'), false);
  assert.throws(() => settings.set('autoPaste', 'yes'));
  assert.throws(() => settings.set('popupSize', 'huge'));
  assert.throws(() => settings.set('hotkey', 'Shift+V'));
  settings.set('popupPosition', 'mouse');
  assert.strictEqual(settings.get('popupPosition'), 'mouse');
});
