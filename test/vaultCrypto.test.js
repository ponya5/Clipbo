const test = require('node:test');
const assert = require('node:assert');
const { createSalt, deriveKey, encryptJson, decryptJson } = require('../src/vaultCrypto');

test('encrypted data round-trips with the same key', () => {
  const key = deriveKey('correct horse battery', createSalt());
  const payload = encryptJson(key, { secret: 'value' });
  assert.deepStrictEqual(decryptJson(key, payload), { secret: 'value' });
});

test('a different key cannot decrypt', () => {
  const salt = createSalt();
  const payload = encryptJson(deriveKey('right password', salt), { secret: 'value' });
  assert.throws(() => decryptJson(deriveKey('wrong password', salt), payload));
});

test('tampered data is rejected', () => {
  const key = deriveKey('right password', createSalt());
  const payload = encryptJson(key, { secret: 'value' });
  const tamperedData = Buffer.from(payload.data, 'base64');
  tamperedData[0] ^= 0xff;
  assert.throws(() => decryptJson(key, { ...payload, data: tamperedData.toString('base64') }));
});
