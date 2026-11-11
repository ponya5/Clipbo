const crypto = require('crypto');

const KEY_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function createSalt() {
  return crypto.randomBytes(SALT_LENGTH_BYTES);
}

function deriveKey(masterPassword, salt) {
  return crypto.scryptSync(masterPassword, salt, KEY_LENGTH_BYTES, SCRYPT_OPTIONS);
}

/** AES-256-GCM: confidentiality plus tamper detection. */
function encryptJson(key, value) {
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64')
  };
}

/** Throws if the key is wrong or the data was modified. */
function decryptJson(key, payload) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

module.exports = { createSalt, deriveKey, encryptJson, decryptJson };
