const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  cursors: {
    list:         ()     => ipcRenderer.invoke('cursors:list'),
    download:     (name) => ipcRenderer.invoke('cursors:download', name),
    install:      (name) => ipcRenderer.invoke('cursors:install', name),
    activate:     (name) => ipcRenderer.invoke('cursors:activate', name),
    uninstall:    (name) => ipcRenderer.invoke('cursors:uninstall', name),
    uninstallAll: ()     => ipcRenderer.invoke('cursors:uninstallAll'),
    openFolder:   ()     => ipcRenderer.invoke('cursors:openFolder')
  },
  net: {
    check: () => ipcRenderer.invoke('net:check'),
    retry: () => ipcRenderer.invoke('net:retry')
  }
});