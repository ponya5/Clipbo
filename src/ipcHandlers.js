const path = require('path');
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
    && (isNonEmptyString(entry.password) || Boolean(entry.attachment))
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
  ipcMain.handle('history:clear', () => historyStore.clear());
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

/** Moves a history image or file(s) into the vault, one entry per file, then drops the history item. */
async function moveHistoryItemToVault({ vaultStore, historyStore, settings }, itemId) {
  if (!vaultStore.isUnlocked()) return { ok: false, reason: 'locked', message: 'Unlock the vault first' };
  const item = historyStore.find(itemId);
  if (!item) return { ok: false, message: 'Item no longer exists' };
  const sources = item.type === 'image'
    ? [{ path: historyStore.imagePathFor(item.id), kind: 'image', title: `Screenshot ${new Date(item.copiedAt).toLocaleString()}` }]
    : item.paths.map((filePath) => ({ path: filePath, kind: isVideoPath(filePath) ? 'video' : 'file', title: path.basename(filePath) }));
  if (!allFilesExist(sources.map((source) => source.path))) {
    return { ok: false, message: 'The file no longer exists at its original location' };
  }
  const addedIds = [];
  try {
    for (const source of sources) addedIds.push(await vaultStore.addAttachment(source.path, source));
  } catch (error) {
    // All or nothing, so a retry never duplicates. The vault may have locked meanwhile, so never throw here.
    addedIds.forEach((id) => { try { vaultStore.remove(id); } catch { /* locked */ } });
    return { ok: false, message: error.message };
  }
  historyStore.remove(item.id);
  // Trash (recoverable), not delete: the plaintext original would otherwise stay on disk.
  if (item.type === 'file' && settings.get('trashOriginalsOnVaultMove')) {
    await Promise.all(item.paths.map((filePath) => shell.trashItem(filePath).catch(() => {})));
  }
  return { ok: true };
}

/** Decrypts an attachment to temp and returns a preview for the overlay. */
async function buildVaultPreview(vaultStore, entryId) {
  const entry = vaultStore.get(entryId);
  if (!entry?.attachment) return null;
  const { kind, name } = entry.attachment;
  try {
    const tempPath = await vaultStore.attachmentToTemp(entryId);
    if (kind === 'image' || kind === 'video') return { kind, url: pathToFileURL(tempPath).href, name };
    const previewImage = await createFilePreview(tempPath);
    return previewImage ? { kind: 'image', url: previewImage } : { kind: 'missing', name };
  } catch {
    return { kind: 'missing', name };
  }
}

async function pasteAttachment({ vaultStore, clipboardActions }, entry, shouldPaste) {
  try {
    const tempPath = await vaultStore.attachmentToTemp(entry.id);
    let result = { ok: true };
    if (entry.attachment.kind === 'image') clipboardActions.pasteImage(tempPath, shouldPaste);
    else result = await clipboardActions.pasteFiles([tempPath], shouldPaste);
    if (result.ok) clipboardActions.scheduleAttachmentClear(() => vaultStore.files.removeTemp(tempPath));
    return result;
  } catch {
    return { ok: false, message: 'Could not decrypt this file. The vault data may be damaged.' };
  }
}

function registerVaultHandlers({ vaultStore, historyStore, clipboardActions, settings }) {
  ipcMain.handle('vault:moveFromHistory', (_event, itemId) =>
    moveHistoryItemToVault({ vaultStore, historyStore, settings }, itemId));
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
  ipcMain.handle('vault:preview', (_event, entryId) => buildVaultPreview(vaultStore, entryId));
  ipcMain.handle('vault:lock', () => vaultStore.lock());
  ipcMain.handle('vault:list', () => vaultStore.list());
  ipcMain.handle('vault:get', (_event, entryId) => {
    const entry = vaultStore.get(entryId);
    if (!entry?.attachment) return entry;
    const { name, kind, sizeBytes } = entry.attachment; // the file key never leaves the main process
    return { ...entry, attachment: { name, kind, sizeBytes } };
  });
  ipcMain.handle('vault:save', (_event, entry) => {
    if (!isValidVaultEntry(entry)) throw new Error('Invalid vault entry');
    vaultStore.save(entry);
  });
  ipcMain.handle('vault:remove', (_event, entryId) => vaultStore.remove(entryId));
  ipcMain.handle('vault:copyField', (_event, text, isSecret) => {
    if (typeof text === 'string' && text) clipboardActions.copyField(text, Boolean(isSecret));
  });
  ipcMain.handle('vault:use', (_event, entryId, action) => {
    const entry = vaultStore.get(entryId);
    if (!entry) return;
    if (entry.attachment) return ['pasteUsername', 'copyUsername'].includes(action) ? { ok: true } : pasteAttachment({ vaultStore, clipboardActions }, entry, action !== 'copyPassword' && settings.get('autoPaste'));
    if (action === 'pastePassword') clipboardActions.pasteSecret(entry.password);
    else if (action === 'copyPassword') clipboardActions.copySecret(entry.password);
    else if (action === 'pasteUsername') clipboardActions.pasteText(entry.username);
    else if (action === 'copyUsername' && entry.username) clipboardActions.copyPlainText(entry.username);
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
    app.isPackaged && app.setLoginItemSettings({ openAtLogin: Boolean(enabled) }));

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
