const { app, ipcMain, shell } = require('electron');
const appInfo = require('./appInfo');
const { exportVaultBackup, importVaultBackup } = require('./vaultBackup');

const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;

function isValidVaultEntry(entry) {
  return Boolean(entry)
    && isNonEmptyString(entry.title)
    && isNonEmptyString(entry.password)
    && typeof entry.username === 'string'
    && (entry.notes === undefined || typeof entry.notes === 'string')
    && (entry.id === null || entry.id === undefined || isNonEmptyString(entry.id));
}

/** Runs an action that may throw and converts the outcome to { ok, message }. */
function toResult(action) {
  try {
    action();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

/** Exposes history, vault and panel operations to the renderer. */
function registerIpcHandlers({ historyStore, vaultStore, settings, clipboardActions, panelWindow }) {
  ipcMain.handle('history:list', () => historyStore.list());
  ipcMain.handle('history:remove', (_event, itemId) => historyStore.remove(itemId));
  ipcMain.handle('history:togglePin', (_event, itemId) => historyStore.togglePin(itemId));
  ipcMain.handle('history:paste', (_event, itemId) => {
    const item = historyStore.find(itemId);
    if (!item) return;
    if (item.type === 'image') clipboardActions.pasteImage(historyStore.imagePathFor(item.id));
    else clipboardActions.pasteText(item.text);
  });

  ipcMain.handle('vault:status', () => ({
    exists: vaultStore.exists(),
    unlocked: vaultStore.isUnlocked()
  }));
  ipcMain.handle('vault:create', (_event, masterPassword) =>
    toResult(() => vaultStore.create(masterPassword)));
  ipcMain.handle('vault:unlock', (_event, masterPassword) =>
    isNonEmptyString(masterPassword) ? vaultStore.unlock(masterPassword) : { ok: false, reason: 'wrong' });
  ipcMain.handle('vault:changeMasterPassword', (_event, currentPassword, newPassword) =>
    toResult(() => vaultStore.changeMasterPassword(currentPassword, newPassword)));
  ipcMain.handle('vault:lock', () => vaultStore.lock());
  ipcMain.handle('vault:list', () => vaultStore.list());
  ipcMain.handle('vault:get', (_event, entryId) => vaultStore.get(entryId));
  ipcMain.handle('vault:save', (_event, entry) => {
    if (!isValidVaultEntry(entry)) throw new Error('Invalid vault entry');
    vaultStore.save(entry);
  });
  ipcMain.handle('vault:remove', (_event, entryId) => vaultStore.remove(entryId));
  ipcMain.handle('vault:use', (_event, entryId, action) => {
    const entry = vaultStore.get(entryId);
    if (!entry) return;
    if (action === 'pastePassword') clipboardActions.pasteSecret(entry.password);
    else if (action === 'copyPassword') clipboardActions.copySecret(entry.password);
    else if (action === 'pasteUsername') clipboardActions.pasteText(entry.username);
  });

  ipcMain.handle('settings:getAll', () => ({
    fields: settings.describeFields(),
    launchAtLogin: app.getLoginItemSettings().openAtLogin
  }));
  ipcMain.handle('settings:set', (_event, name, value) => {
    settings.set(name, value);
    if (name === 'maxHistorySize') historyStore.enforceLimit();
  });
  ipcMain.handle('settings:setLaunchAtLogin', (_event, enabled) =>
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled) }));

  ipcMain.handle('backup:export', () => panelWindow.runWithoutAutoHide(() => exportVaultBackup(vaultStore)));
  ipcMain.handle('backup:import', async () => {
    await panelWindow.runWithoutAutoHide(() => importVaultBackup(vaultStore));
    panelWindow.send('vault:locked');
  });

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    authorName: appInfo.AUTHOR_NAME,
    githubUrl: appInfo.GITHUB_PROFILE_URL,
    projectUrl: appInfo.PROJECT_URL
  }));
  ipcMain.handle('app:openExternal', (_event, url) => {
    if (appInfo.ALLOWED_EXTERNAL_URLS.includes(url)) shell.openExternal(url);
  });

  ipcMain.handle('panel:hide', () => panelWindow.hide());
}

module.exports = { registerIpcHandlers };
