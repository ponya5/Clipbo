const { dialog } = require('electron');

const BACKUP_FILTERS = [{ name: 'Clipbo vault backup', extensions: ['json'] }];

async function exportVaultBackup(vaultStore) {
  if (!vaultStore.exists()) {
    await dialog.showMessageBox({ type: 'info', message: 'There is no vault to export yet.' });
    return;
  }
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export encrypted vault backup',
    defaultPath: 'clipbo-vault-backup.json',
    filters: BACKUP_FILTERS
  });
  if (canceled || !filePath) return;
  vaultStore.exportTo(filePath);
  await dialog.showMessageBox({
    type: 'info',
    message: 'Backup saved.',
    detail: 'The file is encrypted. You need your master password to open it.'
  });
}

async function importVaultBackup(vaultStore) {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import vault backup',
    filters: BACKUP_FILTERS,
    properties: ['openFile']
  });
  if (canceled || !filePaths.length) return;

  const { response } = await dialog.showMessageBox({
    type: 'warning',
    message: 'Replace the current vault with this backup?',
    detail: 'Your current vault is kept as vault.json.bak in the Clipbo data folder. Unlock the imported vault with the master password it was created with.',
    buttons: ['Cancel', 'Replace vault'],
    defaultId: 0,
    cancelId: 0
  });
  if (response !== 1) return;

  try {
    vaultStore.importFrom(filePaths[0]);
    await dialog.showMessageBox({ type: 'info', message: 'Vault imported. Open Clipbo to unlock it.' });
  } catch (error) {
    await dialog.showMessageBox({ type: 'error', message: 'Import failed', detail: error.message });
  }
}

module.exports = { exportVaultBackup, importVaultBackup };
