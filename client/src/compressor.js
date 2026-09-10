const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const CHUNK_SIZE = 5 * 1024 * 1024;

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

      await uploadFile(filePath, serverUrl, folderName, relativePath);
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

async function uploadFile(filePath, serverUrl, folderName, relativePath) {
  try {
    const fileName = path.basename(filePath);
    // Always use 3 parts format
    const uploadFileName = relativePath
      ? `${folderName}||${relativePath}||${fileName}`
      : `${folderName}||${fileName}`;

    console.log('📤 Uploading:', uploadFileName);

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), uploadFileName);

    await axios.post(`${serverUrl}/api/upload`, form, {
      headers: form.getHeaders(),
      timeout: 60000
    });

  } catch (error) {
    throw new Error(`Failed to upload ${path.basename(filePath)}: ${error.message}`);
  }
}

module.exports = { compressAndUploadHandler };
