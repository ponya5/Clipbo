const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);
const subscribe = (channel) => (callback) =>
  ipcRenderer.on(channel, (_event, ...args) => callback(...args));

contextBridge.exposeInMainWorld('clipbo', {
  platform: process.platform,
  history: {
    list: invoke('history:list'),
    paste: invoke('history:paste'),
    remove: invoke('history:remove'),
    togglePin: invoke('history:togglePin')
  },
  vault: {
    status: invoke('vault:status'),
    create: invoke('vault:create'),
    unlock: invoke('vault:unlock'),
    lock: invoke('vault:lock'),
    list: invoke('vault:list'),
    get: invoke('vault:get'),
    save: invoke('vault:save'),
    remove: invoke('vault:remove'),
    use: invoke('vault:use'),
    changeMasterPassword: invoke('vault:changeMasterPassword')
  },
  settings: {
    getAll: invoke('settings:getAll'),
    set: invoke('settings:set'),
    setLaunchAtLogin: invoke('settings:setLaunchAtLogin')
  },
  backup: {
    exportVault: invoke('backup:export'),
    importVault: invoke('backup:import')
  },
  app: {
    info: invoke('app:info'),
    openExternal: invoke('app:openExternal')
  },
  hidePanel: invoke('panel:hide'),
  onPanelShown: subscribe('panel:shown'),
  onHistoryChanged: subscribe('history:changed'),
  onVaultLocked: subscribe('vault:locked')
});
