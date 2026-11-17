const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// singleInstance requires electron only for runtime helpers; stub it so the pure logic is testable.
require.cache[require.resolve('electron')] = { exports: { app: {} }, loaded: true, id: 'electron', filename: 'electron' };
const { isNewerVersion, shouldHandOverTo } = require('../src/singleInstance');

test('compares versions numerically, not alphabetically', () => {
  assert.ok(isNewerVersion('1.10.0', '1.9.9'));
  assert.ok(isNewerVersion('2.0.0', '1.99.99'));
  assert.ok(isNewerVersion('1.5.4', '1.5.3'));
  assert.ok(!isNewerVersion('1.5.3', '1.5.3'));
  assert.ok(!isNewerVersion('1.5.2', '1.5.3'));
  assert.ok(isNewerVersion('1.6', '1.5.9'));
});

test('hands over only to a newer build with the same executable name', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clipbo-instance-'));
  const newExecutable = path.join(directory, 'Clipbo');
  fs.writeFileSync(newExecutable, '');
  const currentExecutable = '/Applications/Clipbo.app/Contents/MacOS/Clipbo';

  assert.ok(shouldHandOverTo({ version: '1.6.0', executablePath: newExecutable }, '1.5.3', currentExecutable));
  assert.ok(!shouldHandOverTo({ version: '1.5.3', executablePath: newExecutable }, '1.5.3', currentExecutable));
  assert.ok(!shouldHandOverTo({ version: '1.4.0', executablePath: newExecutable }, '1.5.3', currentExecutable));
});

test('refuses to start anything that is not a Clipbo executable or does not exist', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clipbo-instance-'));
  const otherProgram = path.join(directory, 'something-else');
  fs.writeFileSync(otherProgram, '');
  const currentExecutable = '/Applications/Clipbo.app/Contents/MacOS/Clipbo';

  assert.ok(!shouldHandOverTo({ version: '9.0.0', executablePath: otherProgram }, '1.5.3', currentExecutable));
  assert.ok(!shouldHandOverTo({ version: '9.0.0', executablePath: path.join(directory, 'Clipbo') }, '1.5.3', currentExecutable));
  assert.ok(!shouldHandOverTo(undefined, '1.5.3', currentExecutable));
  assert.ok(!shouldHandOverTo({ version: 9, executablePath: 5 }, '1.5.3', currentExecutable));
});
