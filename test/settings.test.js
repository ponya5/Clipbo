const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Settings } = require('../src/settings');

function createSettings() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clipbo-settings-'));
  return { directory, settings: new Settings(directory) };
}

test('defaults are applied and values persist', () => {
  const { directory, settings } = createSettings();
  assert.strictEqual(settings.get('vaultAutoLockMinutes'), 15);
  settings.set('vaultAutoLockMinutes', 0);
  assert.strictEqual(new Settings(directory).get('vaultAutoLockMinutes'), 0);
});

test('invalid settings are rejected', () => {
  const { settings } = createSettings();
  assert.throws(() => settings.set('vaultAutoLockMinutes', 7));
  assert.throws(() => settings.set('unknownSetting', 1));
});
