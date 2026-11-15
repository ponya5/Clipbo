const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { VaultStore } = require('../src/vaultStore');

function unlockedVault() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clipbo-vf-'));
  const vault = new VaultStore(directory, () => {});
  vault.create('a-long-master-password');
  return { directory, vault };
}

function sourceFile(contents) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'clipbo-src-')), 'clip.mp4');
  fs.writeFileSync(file, contents);
  return file;
}

test('attachments are stored encrypted and round-trip through temp decryption', async () => {
  const { directory, vault } = unlockedVault();
  const secretBytes = Buffer.from('very secret video bytes '.repeat(1000));
  await vault.addAttachment(sourceFile(secretBytes), { title: 'Clip', kind: 'video' });

  const [entry] = vault.list();
  assert.strictEqual(entry.attachment.kind, 'video');
  const blobs = fs.readdirSync(path.join(directory, 'vault-files'));
  assert.strictEqual(blobs.length, 1);
  assert.ok(!fs.readFileSync(path.join(directory, 'vault-files', blobs[0])).includes('very secret'));

  const tempPath = await vault.attachmentToTemp(entry.id);
  assert.deepStrictEqual(fs.readFileSync(tempPath), secretBytes);
  vault.lock();
  assert.ok(!fs.existsSync(tempPath));
});

test('tampered blobs fail to decrypt and leave no output; removing the entry deletes the blob', async () => {
  const { directory, vault } = unlockedVault();
  await vault.addAttachment(sourceFile('hello world'), { title: 'Clip', kind: 'file' });
  const [entry] = vault.list();
  const blobPath = path.join(directory, 'vault-files', fs.readdirSync(path.join(directory, 'vault-files'))[0]);
  const tampered = fs.readFileSync(blobPath);
  tampered[14] ^= 0xff;
  fs.writeFileSync(blobPath, tampered);
  await assert.rejects(vault.attachmentToTemp(entry.id));

  vault.remove(entry.id);
  assert.strictEqual(fs.readdirSync(path.join(directory, 'vault-files')).length, 0);
});

test('backup export and import carry attachments', async () => {
  const { directory, vault } = unlockedVault();
  const bytes = Buffer.from('backup me');
  await vault.addAttachment(sourceFile(bytes), { title: 'Clip', kind: 'file' });
  const backupPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'clipbo-bk-')), 'backup.json');
  vault.exportTo(backupPath);

  const restoredDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'clipbo-restore-'));
  const restored = new VaultStore(restoredDirectory, () => {});
  restored.importFrom(backupPath);
  assert.ok(restored.unlock('a-long-master-password').ok);
  const [entry] = restored.list();
  assert.deepStrictEqual(fs.readFileSync(await restored.attachmentToTemp(entry.id)), bytes);
  assert.ok(directory);
});
