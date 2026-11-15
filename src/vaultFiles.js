const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Encrypted attachments (screenshots, videos, files) live in <dataDir>/vault-files/<blobId>.bin
 * as iv | ciphertext | tag (AES-256-GCM, streamed so large videos never load into memory).
 * Each blob has its own random key, stored in the encrypted vault entry, so changing the
 * master password never requires re-encrypting the files.
 */
class VaultFiles {
  constructor(dataDirectory) {
    this.directory = path.join(dataDirectory, 'vault-files');
    this.tempDirectories = [];
  }

  blobPath(blobId) {
    return path.join(this.directory, `${blobId}.bin`);
  }

  /** Returns { blobId, key } for the new encrypted copy of sourcePath. */
  async encrypt(sourcePath) {
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const blobId = crypto.randomUUID();
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const target = this.blobPath(blobId);
    try {
      const output = fs.createWriteStream(target, { mode: 0o600 });
      output.write(iv);
      await pipeline(fs.createReadStream(sourcePath), cipher, output, { end: false });
      await new Promise((resolve, reject) => output.end(cipher.getAuthTag(), (error) => (error ? reject(error) : resolve())));
    } catch (error) {
      fs.rmSync(target, { force: true });
      throw error;
    }
    return { blobId, key: key.toString('base64') };
  }

  /** Throws (and leaves no output file) if the key is wrong or the blob was modified. */
  async decryptTo({ blobId, key }, destinationPath) {
    const source = this.blobPath(blobId);
    const size = fs.statSync(source).size;
    if (size < IV_BYTES + TAG_BYTES) throw new Error('Encrypted file is damaged (too small)');
    const handle = fs.openSync(source, 'r');
    const iv = Buffer.alloc(IV_BYTES);
    const tag = Buffer.alloc(TAG_BYTES);
    try {
      fs.readSync(handle, iv, 0, IV_BYTES, 0);
      fs.readSync(handle, tag, 0, TAG_BYTES, size - TAG_BYTES);
    } finally {
      fs.closeSync(handle);
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), iv);
    decipher.setAuthTag(tag);
    try {
      if (size === IV_BYTES + TAG_BYTES) {
        decipher.final(); // empty file: nothing to stream, but still verify the tag
        fs.writeFileSync(destinationPath, '', { mode: 0o600 });
      } else {
        await pipeline(
          fs.createReadStream(source, { start: IV_BYTES, end: size - TAG_BYTES - 1 }),
          decipher,
          fs.createWriteStream(destinationPath, { mode: 0o600 })
        );
      }
    } catch (error) {
      fs.rmSync(destinationPath, { force: true });
      throw error;
    }
  }

  /** Decrypts into a private temp folder (original file name kept); removed by clearTemp(). */
  async decryptToTemp(attachment) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clipbo-vault-'));
    this.tempDirectories.push(directory);
    const destination = path.join(directory, path.basename(attachment.name));
    await this.decryptTo(attachment, destination);
    return destination;
  }

  remove(blobId) {
    fs.rmSync(this.blobPath(blobId), { force: true });
  }

  /** Removes the temp folder that holds one decrypted file. */
  removeTemp(filePath) {
    const directory = path.dirname(filePath);
    fs.rmSync(directory, { recursive: true, force: true });
    this.tempDirectories = this.tempDirectories.filter((candidate) => candidate !== directory);
  }

  clearTemp() {
    this.tempDirectories.forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }));
    this.tempDirectories = [];
  }
}

module.exports = { VaultFiles };
