const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("StillDesktop", {
  engineURL: () => ipcRenderer.invoke("torrent-engine-url"),
  installUpdate: (update) => ipcRenderer.invoke("install-update", update),
});
