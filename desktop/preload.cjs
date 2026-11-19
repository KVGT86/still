const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("StillDesktop", {
  platform: process.platform,
  updatePlatform:
    process.platform === "darwin" && process.arch === "arm64"
      ? "mac-arm64"
      : process.platform === "linux" && process.arch === "x64"
        ? "linux"
        : null,
  ...(process.platform === "linux" && process.arch === "x64" && {
    engineURL: () => ipcRenderer.invoke("torrent-engine-url"),
  }),
  installUpdate: (update) => ipcRenderer.invoke("install-update", update),
});
