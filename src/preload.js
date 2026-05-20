const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ntodo', {
  readStore: () => ipcRenderer.invoke('store:read'),
  writeStore: (data) => ipcRenderer.invoke('store:write', data),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  setPinned: (pinned) => ipcRenderer.invoke('window:pin', pinned),
  pickScreenshot: () => ipcRenderer.invoke('screenshot:pick'),
  getScreenshotSources: () => ipcRenderer.invoke('screenshot:sources')
});
