document.addEventListener('DOMContentLoaded', () => {
  const folderPathInput = document.getElementById('folder-path');
  const folderDisplay = document.getElementById('folder-display');
  const browseBtn = document.getElementById('browse-btn');
  const uploadBtn = document.getElementById('upload-btn');
  const serverUrlInput = document.getElementById('server-url');
  const progressContainer = document.getElementById('progress');
  const progressFill = document.getElementById('progress-fill');
  const progressPercent = document.getElementById('progress-percent');
  const progressStatus = document.getElementById('progress-status');
  const statusMessage = document.getElementById('status-message');
  const speedDisplay = document.getElementById('speed');
  const timeLeftDisplay = document.getElementById('time-left');

  let selectedFolder = '';
  let startTime = 0;
  let uploadedBytes = 0;

  // Browse button
  browseBtn.addEventListener('click', async () => {
    const folder = await window.api.selectFolder();
    if (folder) {
      selectedFolder = folder;
      folderPathInput.value = folder;
      folderDisplay.textContent = folder;
    }
  });

  // Paste folder path
  folderPathInput.addEventListener('change', () => {
    selectedFolder = folderPathInput.value;
    folderDisplay.textContent = folderPathInput.value || 'Chưa chọn thư mục';
  });

  // Upload button
  uploadBtn.addEventListener('click', async () => {
    if (!selectedFolder) {
      showStatus('Vui lòng chọn thư mục', 'error');
      return;
    }

    const serverUrl = serverUrlInput.value;
    if (!serverUrl) {
      showStatus('Vui lòng nhập Server URL', 'error');
      return;
    }

    uploadBtn.disabled = true;
    browseBtn.disabled = true;
    serverUrlInput.disabled = true;
    progressContainer.classList.add('active');
    statusMessage.textContent = '';
    statusMessage.className = '';
    startTime = Date.now();
    uploadedBytes = 0;

    try {
      const result = await window.api.compressAndUpload(selectedFolder, serverUrl);
      showStatus(`✅ Hoàn thành! Thư mục: ${result.folder}`, 'success');
    } catch (error) {
      showStatus(`❌ Lỗi: ${error.message}`, 'error');
    } finally {
      uploadBtn.disabled = false;
      browseBtn.disabled = false;
      serverUrlInput.disabled = false;
    }
  });

  window.api.onProgress((data) => {
    if (data.type === 'compress') {
      progressStatus.textContent = '🗜️ Đang nén file...';
      updateProgress(data.percent);
    } else if (data.type === 'upload') {
      progressStatus.textContent = '📤 Đang upload...';
      updateProgress(data.percent);
      uploadedBytes = data.bytes || 0;
      updateSpeed();
    } else if (data.type === 'extract') {
      progressStatus.textContent = '📦 Đang giải nén...';
      updateProgress(data.percent);
    } else if (data.type === 'complete') {
      progressStatus.textContent = '✅ Hoàn thành!';
      updateProgress(100);
    }
  });

  function updateProgress(percent) {
    progressFill.style.width = percent + '%';
    progressPercent.textContent = Math.round(percent) + '%';
  }

  function updateSpeed() {
    if (startTime === 0) return;
    const elapsed = (Date.now() - startTime) / 1000;
    const speedMBps = (uploadedBytes / 1024 / 1024) / elapsed;
    speedDisplay.textContent = speedMBps.toFixed(2) + ' MB/s';

    if (speedMBps > 0) {
      const totalBytes = uploadedBytes / (parseInt(progressPercent.textContent) / 100 || 1);
      const remainingBytes = totalBytes - uploadedBytes;
      const remainingSeconds = remainingBytes / (speedMBps * 1024 * 1024);
      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = Math.floor(remainingSeconds % 60);
      timeLeftDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  function showStatus(message, type = '') {
    statusMessage.textContent = message;
    statusMessage.className = type;
  }

  // Format large numbers
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  }
});
