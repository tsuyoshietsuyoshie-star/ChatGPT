const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("themeAPI", {
    toggle: () => ipcRenderer.send("toggle-theme"),
    toggleMini: () => ipcRenderer.send("toggle-mini")
});