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

      console.log(`📤 [${i + 1}/${files.length}] File: ${filePath}`);
      console.log(`   relativePath: "${relativePath}"`);
      console.log(`   fileName: "${fileName}"`);

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

    return {
      success: true,
      folder: folderName,
      fileCount: files.length,
      totalSize
    };

  } catch (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}

function getAllFiles(dir) {
  let files = [];
  const items = fs.readdirSync(dir);

  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files = files.concat(getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  });

  console.log('📁 Scanned files:', files);
  return files;
}

async function uploadFile(filePath, serverUrl, folderName, relativePath, onProgress) {
  try {
    const fileName = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

    console.log(`📤 Uploading: ${fileName} (${fileSize} bytes, ${totalChunks} chunks)`);

    const fileBuffer = fs.readFileSync(filePath);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileSize);
      const chunkBuffer = fileBuffer.slice(start, end);

      console.log(`   Chunk ${chunkIndex + 1}/${totalChunks} (${end - start} bytes)`);

      const form = new FormData();
      form.append('file', chunkBuffer, `${fileName}.chunk${chunkIndex}`);
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

    console.log(`✅ ${fileName} uploaded (${totalChunks} chunks)`);

  } catch (error) {
    throw new Error(`Failed to upload ${path.basename(filePath)}: ${error.message}`);
  }
}

module.exports = { compressAndUploadHandler };
