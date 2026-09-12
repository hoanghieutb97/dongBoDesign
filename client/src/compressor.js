const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks

async function compressAndUploadHandler(mainWindow, folderPath, serverUrl) {
  try {
    const folderName = path.basename(folderPath);

    const files = getAllFiles(folderPath);

    if (files.length === 0) {
      throw new Error('Thư mục trống, không có file để đồng bộ');
    }

    let totalUploaded = 0;
    let totalSize = 0;

    files.forEach(file => {
      totalSize += fs.statSync(file).size;
    });

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      let relativePath = path.relative(folderPath, path.dirname(filePath));
      // If file is in root, relativePath will be '.', convert to empty string
      if (relativePath === '.') {
        relativePath = '';
      }
      // Normalize path separator to forward slash for consistency
      relativePath = relativePath.replace(/\\/g, '/');
      const fileName = path.basename(filePath);
      const fileSize = fs.statSync(filePath).size;


      mainWindow.webContents.send('progress', {
        type: 'upload',
        percent: (totalUploaded / totalSize) * 100,
        currentFile: fileName,
        fileIndex: i + 1,
        totalFiles: files.length,
        bytes: totalUploaded
      });

      await uploadFile(filePath, serverUrl, folderName, relativePath, (fileProgress) => {
        // Update progress for current file chunks
        const totalUploadedWithFileProgress = totalUploaded + (fileSize * fileProgress);
        mainWindow.webContents.send('progress', {
          type: 'upload',
          percent: (totalUploadedWithFileProgress / totalSize) * 100,
          currentFile: fileName,
          fileIndex: i + 1,
          totalFiles: files.length,
          bytes: totalUploadedWithFileProgress,
          fileProgress: Math.round(fileProgress * 100)
        });
      });
      totalUploaded += fileSize;
    }

    mainWindow.webContents.send('progress', {
      type: 'complete',
      percent: 100,
      currentFile: 'Hoàn thành!',
      totalFiles: files.length
    });

    // Notify server upload is complete (scan imageThumb + sync)
    try {
      await axios.post(`${serverUrl}/api/upload-complete`, {}, {
        timeout: 120000
      });
    } catch (error) {
      console.error('Upload complete notification error:', error.message);
    }

    return {
      success: true,
      folder: folderName,
      fileCount: files.length,
      totalSize
    };

  } catch (error) {
    const errorMsg = error.message || 'Unknown error';

    // Determine error type
    let errorType = 'upload_error';
    if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ENOTFOUND')) {
      errorType = 'connection_error';
    } else if (errorMsg.includes('ENOENT') || errorMsg.includes('EACCES')) {
      errorType = 'file_error';
    }

    throw new Error(`Upload failed: ${errorMsg}`);
  }
}

function getAllFiles(dir, rootDir = dir) {
  let files = [];
  const items = fs.readdirSync(dir);

  // Folders to ignore
  const ignoreFolders = ['file tool', 'Thumbs.db'];

  items.forEach(item => {
    // Skip ignored folders
    if (ignoreFolders.includes(item)) {
      return;
    }

    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, rootDir));
    } else {
      files.push(fullPath);
    }
  });

  return files;
}

async function uploadFile(filePath, serverUrl, folderName, relativePath, onProgress) {
  try {
    const fileName = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileSize);
      const chunkSize = end - start;

      // Read chunk from file stream (not entire file)
      const fileStream = fs.createReadStream(filePath, { start, end: end - 1 });

      const form = new FormData();
      form.append('file', fileStream, `${fileName}.chunk${chunkIndex}`);
      form.append('folderName', folderName);
      form.append('relativePath', relativePath || '');
      form.append('fileName', fileName);
      form.append('chunkIndex', chunkIndex);
      form.append('totalChunks', totalChunks);
      form.append('fileSize', fileSize);

      await axios.post(`${serverUrl}/api/upload`, form, {
        headers: form.getHeaders(),
        timeout: 120000  // 2 minutes per chunk
      });

      // Report progress for this file
      const fileProgress = (chunkIndex + 1) / totalChunks;
      if (onProgress) {
        onProgress(fileProgress);
      }
    }


  } catch (error) {
    throw new Error(`Failed to upload ${path.basename(filePath)}: ${error.message}`);
  }
}

module.exports = { compressAndUploadHandler };
