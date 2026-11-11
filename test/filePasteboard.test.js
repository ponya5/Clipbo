const test = require('node:test');
const assert = require('node:assert');
const { parseMacFileList, parseFileUrl, parseWindowsFileName } = require('../src/filePasteboard');

test('parses a macOS multi-file property list, including XML entities', () => {
  const plist = Buffer.from(`<?xml version="1.0"?><plist version="1.0"><array>
    <string>/Users/me/clip.mov</string><string>/Users/me/a &amp; b.mp4</string></array></plist>`);
  assert.deepStrictEqual(parseMacFileList(plist), ['/Users/me/clip.mov', '/Users/me/a & b.mp4']);
});

test('returns nothing for an empty or unrelated pasteboard buffer', () => {
  assert.deepStrictEqual(parseMacFileList(Buffer.alloc(0)), []);
  assert.deepStrictEqual(parseFileUrl(Buffer.from('https://example.com')), []);
});

// parseFileUrl only reads the macOS pasteboard; Windows rejects drive-less file URLs.
test('parses a file URL with encoded characters', { skip: process.platform === 'win32' }, () => {
  const [filePath] = parseFileUrl(Buffer.from('file:///Users/me/My%20Video.mp4'));
  assert.ok(filePath.endsWith('My Video.mp4'));
  assert.ok(!filePath.includes('%20'));
});

test('parses a null-terminated UTF-16 Windows file name', () => {
  const buffer = Buffer.from('C:\\Videos\\clip.mp4\0\0', 'utf16le');
  assert.deepStrictEqual(parseWindowsFileName(buffer), ['C:\\Videos\\clip.mp4']);
  assert.deepStrictEqual(parseWindowsFileName(Buffer.alloc(0)), []);
});
