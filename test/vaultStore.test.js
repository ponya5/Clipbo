const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { VaultStore } = require('../src/vaultStore');

const MASTER_PASSWORD = 'a-long-master-password';

function createVault(onLocked = () => {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clipbo-vault-'));
  return { directory, vault: new VaultStore(directory, onLocked) };
}

test('rejects master passwords that are too short', () => {
  const { vault } = createVault();
  assert.throws(() => vault.create('short'));
});

test('stores entries encrypted and never writes plaintext to disk', () => {
  const { directory, vault } = createVault();
  vault.create(MASTER_PASSWORD);
  vault.save({ title: 'Mail', username: 'me@example.com', password: 'hunter2-secret' });

  const fileContents = fs.readFileSync(path.join(directory, 'vault.json'), 'utf8');
  assert.ok(!fileContents.includes('hunter2-secret'));
  assert.ok(!fileContents.includes('me@example.com'));
});

test('unlocking with the right password restores entries, wrong password fails', () => {
  const { directory, vault } = createVault();
  vault.create(MASTER_PASSWORD);
  vault.save({ title: 'Mail', username: 'me', password: 'pw' });
  vault.lock();

  const reopenedVault = new VaultStore(directory, () => {});
  assert.strictEqual(reopenedVault.unlock('wrong-password-here').ok, false);
  assert.strictEqual(reopenedVault.unlock(MASTER_PASSWORD).ok, true);
  assert.strictEqual(reopenedVault.list()[0].title, 'Mail');
});

test('list never exposes passwords', () => {
  const { vault } = createVault();
  vault.create(MASTER_PASSWORD);
  vault.save({ title: 'Mail', username: 'me', password: 'pw' });
  assert.ok(!('password' in vault.list()[0]));
});

test('locked vault refuses access and notifies', () => {
  let lockNotifications = 0;
  const { vault } = createVault(() => lockNotifications++);
  vault.create(MASTER_PASSWORD);
  vault.lock();
  assert.throws(() => vault.list());
  assert.strictEqual(lockNotifications, 1);
});

test('entries can be edited and removed', () => {
  const { vault } = createVault();
  vault.create(MASTER_PASSWORD);
  vault.save({ title: 'Mail', username: 'me', password: 'pw' });
  const { id } = vault.list()[0];

  vault.save({ id, title: 'Work mail', username: 'me', password: 'new-pw' });
  assert.strictEqual(vault.get(id).password, 'new-pw');
  assert.strictEqual(vault.list().length, 1);

  vault.remove(id);
  assert.strictEqual(vault.list().length, 0);
});

test('vault locks itself after the idle timeout', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clipbo-vault-'));
  const vault = new VaultStore(directory, () => {}, () => 20);
  vault.create(MASTER_PASSWORD);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.strictEqual(vault.isUnlocked(), false);
});

test('auto-lock can be disabled with 0', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'clipbo-vault-'));
  const vault = new VaultStore(directory, () => {}, () => 0);
  vault.create(MASTER_PASSWORD);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.strictEqual(vault.isUnlocked(), true);
});

test('entries never expire: they survive lock, unlock and restart', () => {
  const { directory, vault } = createVault();
  vault.create(MASTER_PASSWORD);
  vault.save({ title: 'Long lived key', username: '', password: 'sk-123' });
  vault.lock();

  const restartedVault = new VaultStore(directory, () => {});
  restartedVault.unlock(MASTER_PASSWORD);
  assert.strictEqual(restartedVault.get(restartedVault.list()[0].id).password, 'sk-123');
});

test('entries are sorted by title and keep notes', () => {
  const { vault } = createVault();
  vault.create(MASTER_PASSWORD);
  vault.save({ title: 'Zeta', username: '', password: 'a' });
  vault.save({ title: 'Alpha', username: '', password: 'b', notes: 'prod only' });
  const titles = vault.list().map((entry) => entry.title);
  assert.deepStrictEqual(titles, ['Alpha', 'Zeta']);
  assert.strictEqual(vault.get(vault.list()[0].id).notes, 'prod only');
});

test('too many wrong attempts triggers a lockout, even for the right password', () => {
  const { directory, vault } = createVault();
  vault.create(MASTER_PASSWORD);
  vault.lock();
  const attackedVault = new VaultStore(directory, () => {});
  for (let attempt = 0; attempt < 5; attempt++) attackedVault.unlock('wrong-password');

  const result = attackedVault.unlock(MASTER_PASSWORD);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'lockout');
  assert.ok(result.retryAfterMs > 0);
});

test('master password can be changed and the old one stops working', () => {
  const { directory, vault } = createVault();
  vault.create(MASTER_PASSWORD);
  vault.save({ title: 'Mail', username: '', password: 'pw' });
  assert.throws(() => vault.changeMasterPassword('not-the-password', 'another-long-password'));
  vault.changeMasterPassword(MASTER_PASSWORD, 'another-long-password');
  vault.lock();

  const reopenedVault = new VaultStore(directory, () => {});
  assert.strictEqual(reopenedVault.unlock(MASTER_PASSWORD).ok, false);
  assert.strictEqual(reopenedVault.unlock('another-long-password').ok, true);
  assert.strictEqual(reopenedVault.list().length, 1);
});

test('backup export and import restores the vault and keeps the previous one', () => {
  const { directory, vault } = createVault();
  vault.create(MASTER_PASSWORD);
  vault.save({ title: 'Original', username: '', password: 'pw' });
  const backupPath = path.join(directory, 'backup.json');
  vault.exportTo(backupPath);

  vault.save({ title: 'Added later', username: '', password: 'pw2' });
  vault.importFrom(backupPath);
  assert.ok(fs.existsSync(path.join(directory, 'vault.json.bak')));

  assert.strictEqual(vault.unlock(MASTER_PASSWORD).ok, true);
  assert.deepStrictEqual(vault.list().map((entry) => entry.title), ['Original']);
});

test('importing a file that is not a backup is rejected', () => {
  const { directory, vault } = createVault();
  vault.create(MASTER_PASSWORD);
  const bogusPath = path.join(directory, 'bogus.json');
  fs.writeFileSync(bogusPath, '{"hello":"world"}');
  assert.throws(() => vault.importFrom(bogusPath));
});
