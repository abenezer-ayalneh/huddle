const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('controlAgent', {
  initialLink: () => ipcRenderer.invoke('agent:initial-link'),
  onLink: (listener) => {
    const callback = (_event, link) => listener(link);
    ipcRenderer.on('agent:link', callback);
    return () => ipcRenderer.removeListener('agent:link', callback);
  },
  configureDpiAwareness: () => ipcRenderer.invoke('native:configure-dpi'),
  isElevated: () => ipcRenderer.invoke('native:is-elevated'),
  nativeArchitecture: () => ipcRenderer.invoke('native:architecture'),
  windowsVersion: () => ipcRenderer.invoke('native:windows-version'),
  setCaptureSource: (sourceId) => ipcRenderer.invoke('capture:select', sourceId),
  listDisplays: () => ipcRenderer.invoke('capture:list'),
  applyInput: (event) => ipcRenderer.invoke('native:apply-input', event),
  releaseAll: () => ipcRenderer.invoke('native:release-all'),
  clipboardChangeCount: () => ipcRenderer.invoke('native:clipboard-count'),
  readClipboardText: () => ipcRenderer.invoke('native:clipboard-read'),
  writeClipboardText: (text) => ipcRenderer.invoke('native:clipboard-write', text),
  sendClipboardShortcut: (action) => ipcRenderer.invoke('native:clipboard-shortcut', action),
  sessionState: () => ipcRenderer.invoke('native:session-state'),
  acknowledgeDisplayChange: () => ipcRenderer.invoke('native:acknowledge-display-change'),
  restartElevated: (link) => ipcRenderer.invoke('native:restart-elevated', link),
  verifyReleaseManifest: (bytes, signature, publicKey) => ipcRenderer.invoke('release:verify', bytes, signature, publicKey),
});
