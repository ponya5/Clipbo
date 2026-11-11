const { pathToFileURL } = require('url');
const { app, ipcMain, shell } = require('electron');
const appInfo = require('./appInfo');
const { exportVaultBackup, importVaultBackup } = require('./vaultBackup');
const { formatAccelerator } = require('./acceleratorLabel');
const { createFilePreview } = require('./thumbnailService');
const { allFilesExist, isVideoPath } = require('./fileInfo');

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

/** Large preview for the Quick Look-style overlay. */
async function buildPreview(historyStore, item) {
  if (item.type === 'image') return { kind: 'image', url: pathToFileURL(historyStore.imagePathFor(item.id)).href };
  if (item.type !== 'file') return null;
  if (!allFilesExist(item.paths)) return { kind: 'missing', name: item.name };
  if (isVideoPath(item.paths[0])) return { kind: 'video', url: pathToFileURL(item.paths[0]).href, name: item.name };
  const previewImage = await createFilePreview(item.paths[0]);
  return previewImage ? { kind: 'image', url: previewImage } : { kind: 'missing', name: item.name };
}

function registerHistoryHandlers({ historyStore, clipboardActions }) {
  ipcMain.handle('history:list', () => historyStore.list());
  ipcMain.handle('history:remove', (_event, itemId) => historyStore.remove(itemId));
  ipcMain.handle('history:togglePin', (_event, itemId) => historyStore.togglePin(itemId));
  ipcMain.handle('history:preview', (_event, itemId) => {
    const item = historyStore.find(itemId);
    return item ? buildPreview(historyStore, item) : null;
  });
  ipcMain.handle('history:paste', async (_event, itemId) => {
    const item = historyStore.find(itemId);
    if (!item) return { ok: false, message: 'Item not found' };
    if (item.type === 'file') return clipboardActions.pasteFiles(item.paths);
    if (item.type === 'image') clipboardActions.pasteImage(historyStore.imagePathFor(item.id));
    else clipboardActions.pasteText(item.text);
    return { ok: true };
  });
}

function registerVaultHandlers({ vaultStore, clipboardActions }) {
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
}

function registerSettingsHandlers({ settings, settingsController, vaultStore, panelWindow }) {
  ipcMain.handle('settings:getAll', () => ({
    sections: settings.describeSections(),
    launchAtLogin: app.getLoginItemSettings().openAtLogin,
    hotkeyLabel: formatAccelerator(settings.get('hotkey'))
  }));
  ipcMain.handle('settings:getValues', () => ({ ...settings.values }));
  ipcMain.handle('settings:set', (_event, name, value) => settingsController.change(name, value));
  ipcMain.handle('settings:setLaunchAtLogin', (_event, enabled) =>
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled) }));

  ipcMain.handle('backup:export', () => panelWindow.runWithoutAutoHide(() => exportVaultBackup(vaultStore)));
  ipcMain.handle('backup:import', async () => {
    await panelWindow.runWithoutAutoHide(() => importVaultBackup(vaultStore));
    panelWindow.send('vault:locked');
  });
}

function registerAppHandlers({ panelWindow }) {
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

/** Exposes history, vault, settings and panel operations to the renderer. */
function registerIpcHandlers(dependencies) {
  registerHistoryHandlers(dependencies);
  registerVaultHandlers(dependencies);
  registerSettingsHandlers(dependencies);
  registerAppHandlers(dependencies);
}

module.exports = { registerIpcHandlers };
