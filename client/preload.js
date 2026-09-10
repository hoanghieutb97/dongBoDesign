const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: async () => {
    return ipcRenderer.invoke('select-folder');
  },
  compressAndUpload: async (folderPath, serverUrl) => {
    return ipcRenderer.invoke('compress-upload', { folderPath, serverUrl });
  },
  onProgress: (callback) => {
    ipcRenderer.on('progress', (event, data) => callback(data));
  },
  onError: (callback) => {
    ipcRenderer.on('upload-error', (event, data) => callback(data));
  }
});
