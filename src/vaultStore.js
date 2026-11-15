const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JsonFileStore } = require('./jsonFileStore');
const { VaultFiles } = require('./vaultFiles');
const { createSalt, deriveKey, encryptJson, decryptJson } = require('./vaultCrypto');

const MIN_MASTER_PASSWORD_LENGTH = 8;
const DEFAULT_AUTO_LOCK_MS = 15 * 60 * 1000;
const FREE_UNLOCK_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 30 * 1000;
const MAX_LOCKOUT_MS = 15 * 60 * 1000;

/**
 * Encrypted vault for long-lived secrets (API keys, passwords).
 * Entries never expire: they are only removed when the user deletes them.
 */
class VaultStore {
  /** `getAutoLockMs` returns the idle timeout; 0 disables auto-lock. */
  constructor(dataDirectory, onLocked, getAutoLockMs = () => DEFAULT_AUTO_LOCK_MS) {
    this.onLocked = onLocked;
    this.getAutoLockMs = getAutoLockMs;
    this.fileStore = new JsonFileStore(dataDirectory, 'vault.json', null);
    this.files = new VaultFiles(dataDirectory);
    this.key = null;
    this.entries = null;
    this.autoLockTimer = null;
    this.failedUnlockAttempts = 0;
    this.lockedOutUntil = 0;
  }

  exists() {
    return this.fileStore.load() !== null;
  }

  isUnlocked() {
    return this.key !== null;
  }

  create(masterPassword) {
    if (this.exists()) throw new Error('Vault already exists');
    this.assertValidMasterPassword(masterPassword);
    this.salt = createSalt();
    this.key = deriveKey(masterPassword, this.salt);
    this.entries = [];
    this.persist();
    this.restartAutoLockTimer();
  }

  /**
   * Returns { ok: true }, { ok: false, reason: 'wrong' }
   * or { ok: false, reason: 'lockout', retryAfterMs } after too many failures.
   */
  unlock(masterPassword) {
    const retryAfterMs = this.lockedOutUntil - Date.now();
    if (retryAfterMs > 0) return { ok: false, reason: 'lockout', retryAfterMs };

    const stored = this.fileStore.load();
    if (!stored) return { ok: false, reason: 'wrong' };
    const salt = Buffer.from(stored.salt, 'base64');
    const candidateKey = deriveKey(masterPassword, salt);
    try {
      this.entries = decryptJson(candidateKey, stored);
    } catch {
      this.registerFailedAttempt();
      return { ok: false, reason: 'wrong' };
    }
    this.failedUnlockAttempts = 0;
    this.salt = salt;
    this.key = candidateKey;
    this.restartAutoLockTimer();
    return { ok: true };
  }

  lock() {
    const wasUnlocked = this.isUnlocked();
    this.key = null;
    this.entries = null;
    clearTimeout(this.autoLockTimer);
    this.files.clearTemp();
    if (wasUnlocked) this.onLocked();
  }

  /** Listing never includes secrets or notes. Sorted by title. */
  list() {
    this.requireUnlocked();
    return this.entries
      .map(({ id, title, username, attachment }) => ({
        id,
        title,
        username,
        attachment: attachment && { name: attachment.name, kind: attachment.kind, sizeBytes: attachment.sizeBytes }
      }))
      .sort((first, second) => first.title.localeCompare(second.title));
  }

  get(entryId) {
    this.requireUnlocked();
    return this.entries.find((entry) => entry.id === entryId);
  }

  save({ id, title, username, password, notes = '' }) {
    this.requireUnlocked();
    const updatedAt = Date.now();
    const existingEntry = id ? this.get(id) : null;
    if (existingEntry) {
      Object.assign(existingEntry, { title, username, password, notes, updatedAt });
    } else {
      this.entries.push({ id: crypto.randomUUID(), title, username, password, notes, updatedAt });
    }
    this.persist();
  }

  /** Encrypts a file into the vault as its own entry. `kind` is 'image', 'video' or 'file'. */
  async addAttachment(sourcePath, { title, kind }) {
    this.requireUnlocked();
    const { blobId, key } = await this.files.encrypt(sourcePath);
    const attachment = { blobId, key, kind, name: path.basename(sourcePath), sizeBytes: fs.statSync(sourcePath).size };
    this.entries.push({
      id: crypto.randomUUID(), title, username: '', password: '', notes: '', attachment, updatedAt: Date.now()
    });
    this.persist();
  }

  /** Decrypted copy in a temp folder for pasting; cleaned on lock and quit. */
  async attachmentToTemp(entryId) {
    const entry = this.get(entryId);
    return this.files.decryptToTemp(entry.attachment);
  }

  remove(entryId) {
    this.requireUnlocked();
    const removed = this.get(entryId);
    if (removed?.attachment) this.files.remove(removed.attachment.blobId);
    this.entries = this.entries.filter((entry) => entry.id !== entryId);
    this.persist();
  }

  /** Re-encrypts the vault under a new master password and a fresh salt. */
  changeMasterPassword(currentPassword, newPassword) {
    this.requireUnlocked();
    const currentKey = deriveKey(currentPassword, this.salt);
    if (!crypto.timingSafeEqual(currentKey, this.key)) throw new Error('Current master password is wrong');
    this.assertValidMasterPassword(newPassword);
    this.salt = createSalt();
    this.key = deriveKey(newPassword, this.salt);
    this.persist();
  }

  /** Folder next to a backup file that holds its encrypted attachments. */
  static attachmentsFolderFor(backupPath) {
    return `${backupPath.replace(/\.json$/i, '')}-files`;
  }

  /** Copies the encrypted vault file and its encrypted attachments; useless without the master password. */
  exportTo(destinationPath) {
    if (!this.exists()) throw new Error('There is no vault to export');
    fs.copyFileSync(this.fileStore.filePath, destinationPath);
    if (fs.existsSync(this.files.directory)) {
      fs.cpSync(this.files.directory, VaultStore.attachmentsFolderFor(destinationPath), { recursive: true });
    }
  }

  /** Replaces the vault with a backup. The previous vault is kept as vault.json.bak. */
  importFrom(sourcePath) {
    const backup = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const isValidBackup = ['salt', 'iv', 'tag', 'data'].every((field) => typeof backup[field] === 'string');
    if (!isValidBackup) throw new Error('This file is not a Clipbo vault backup');
    this.lock();
    this.backupCurrentFile();
    const attachmentsFolder = VaultStore.attachmentsFolderFor(sourcePath);
    if (fs.existsSync(attachmentsFolder)) {
      fs.cpSync(attachmentsFolder, this.files.directory, { recursive: true, force: true });
    }
    this.fileStore.save(backup);
  }

  requireUnlocked() {
    if (!this.isUnlocked()) throw new Error('Vault is locked');
    this.restartAutoLockTimer();
  }

  assertValidMasterPassword(masterPassword) {
    if (typeof masterPassword !== 'string' || masterPassword.length < MIN_MASTER_PASSWORD_LENGTH) {
      throw new Error(`Master password must be at least ${MIN_MASTER_PASSWORD_LENGTH} characters`);
    }
  }

  registerFailedAttempt() {
    this.failedUnlockAttempts += 1;
    if (this.failedUnlockAttempts < FREE_UNLOCK_ATTEMPTS) return;
    const lockoutMs = BASE_LOCKOUT_MS * 2 ** (this.failedUnlockAttempts - FREE_UNLOCK_ATTEMPTS);
    this.lockedOutUntil = Date.now() + Math.min(lockoutMs, MAX_LOCKOUT_MS);
  }

  persist() {
    this.backupCurrentFile();
    this.fileStore.save({
      version: 1,
      salt: this.salt.toString('base64'),
      ...encryptJson(this.key, this.entries)
    });
  }

  /** Keeps the previous version so a failed write or bad edit is recoverable. */
  backupCurrentFile() {
    if (!this.exists()) return;
    fs.copyFileSync(this.fileStore.filePath, `${this.fileStore.filePath}.bak`);
  }

  restartAutoLockTimer() {
    clearTimeout(this.autoLockTimer);
    const autoLockMs = this.getAutoLockMs();
    if (autoLockMs <= 0) return;
    this.autoLockTimer = setTimeout(() => this.lock(), autoLockMs);
    this.autoLockTimer.unref();
  }
}

module.exports = { VaultStore };
