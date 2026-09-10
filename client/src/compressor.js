import axios from 'axios';
import fs from 'fs';
import path from 'path';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

export async function compressAndUploadHandler(mainWindow, folderPath, serverUrl) {
  try {
    const folderName = path.basename(folderPath);

    // Get all files recursively
    const files = getAllFiles(folderPath);

    if (files.length === 0) {
      throw new Error('Thư mục trống, không có file để đồng bộ');
    }

    let totalUploaded = 0;
    let totalSize = 0;

    // Calculate total size
    files.forEach(file => {
      totalSize += fs.statSync(file).size;
    });

    // Upload each file
    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      const relativePath = path.relative(folderPath, path.dirname(filePath));
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

  return files;
}

async function uploadFile(filePath, serverUrl, folderName, relativePath) {
  try {
    const fileName = path.basename(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    // Format: "folderName||relativePath||fileName"
    const uploadFileName = `${folderName}||${relativePath}||${fileName}`;

    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer]), uploadFileName);

    await axios.post(`${serverUrl}/api/upload`, formData, {
      timeout: 60000
    });

  } catch (error) {
    throw new Error(`Failed to upload ${path.basename(filePath)}: ${error.message}`);
  }
}
