const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("StillDesktop", {
  engineURL: () => ipcRenderer.invoke("torrent-engine-url"),
});
