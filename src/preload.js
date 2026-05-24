const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ntodo', {
  readStore: () => ipcRenderer.invoke('store:read'),
  writeStore: (data) => ipcRenderer.invoke('store:write', data),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  quit: () => ipcRenderer.invoke('window:quit'),
  setMousePassthrough: (passthrough) => ipcRenderer.invoke('window:mouse-passthrough', passthrough),
  setPinned: (pinned) => ipcRenderer.invoke('window:pin', pinned),
  getLoginItemSettings: () => ipcRenderer.invoke('settings:get-login-item'),
  setOpenAtLogin: (openAtLogin) => ipcRenderer.invoke('settings:set-open-at-login', openAtLogin),
  parseNaturalTask: (payload) => ipcRenderer.invoke('ai:parse-task', payload),
  setClipboardShortcut: (shortcut) => ipcRenderer.invoke('clipboard-ai:set-shortcut', shortcut),
  confirmClipboardTasks: (tasks) => ipcRenderer.invoke('clipboard-ai:confirm', tasks),
  cancelClipboardPreview: () => ipcRenderer.invoke('clipboard-ai:cancel-preview'),
  onStoreChanged: (callback) => {
    const listener = (_event, store) => callback(store);
    ipcRenderer.on('store:changed', listener);
    return () => ipcRenderer.removeListener('store:changed', listener);
  }
});
