import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  selectFolder: async () => {
    return ipcRenderer.invoke('select-folder');
  },
  compressAndUpload: async (folderPath, serverUrl) => {
    return ipcRenderer.invoke('compress-upload', { folderPath, serverUrl });
  },
  onProgress: (callback) => {
    ipcRenderer.on('progress', (event, data) => callback(data));
  }
});
