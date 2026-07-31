import archiver from 'archiver';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks for faster upload

export async function compressAndUploadHandler(mainWindow, folderPath, serverUrl) {
  try {
    // Create temp directory for zip file
    const tempDir = path.join(os.tmpdir(), `sync-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const folderName = path.basename(folderPath);
    const zipPath = path.join(tempDir, `${folderName}.zip`);

    // Step 1: Compress with progress
    await compressFolder(folderPath, zipPath, (progress) => {
      mainWindow.webContents.send('progress', {
        type: 'compress',
        percent: progress,
        status: 'Đang nén file...'
      });
    });

    // Step 2: Upload with chunking
    const fileSize = fs.statSync(zipPath).size;
    await uploadFileChunked(zipPath, serverUrl, fileSize, (progress, bytes) => {
      mainWindow.webContents.send('progress', {
        type: 'upload',
        percent: progress,
        bytes: bytes,
        status: 'Đang upload...'
      });
    });

    // Cleanup
    fs.unlinkSync(zipPath);
    fs.rmdirSync(tempDir);

    mainWindow.webContents.send('progress', {
      type: 'complete',
      percent: 100,
      status: 'Hoàn thành!'
    });

    return {
      success: true,
      folder: folderName,
      size: fileSize
    };

  } catch (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}

function compressFolder(folderPath, zipPath, onProgress) {
  return new Promise((resolve, reject) => {
    try {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 1 } // Low compression for speed
      });

      let totalSize = 0;
      let processedSize = 0;

      // Calculate total size first
      const calculateSize = (dir) => {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            calculateSize(filePath);
          } else {
            totalSize += stat.size;
          }
        });
      };

      calculateSize(folderPath);

      output.on('close', () => resolve());
      output.on('error', reject);
      archive.on('error', reject);

      // Track progress by data events
      archive.on('data', (data) => {
        processedSize += data.length;
        const progress = (processedSize / (totalSize || 1)) * 100;
        onProgress(Math.min(progress, 99)); // Cap at 99% until complete
      });

      archive.pipe(output);
      archive.directory(folderPath, false);
      archive.finalize();

    } catch (error) {
      reject(error);
    }
  });
}

async function uploadFileChunked(filePath, serverUrl, fileSize, onProgress) {
  try {
    const fileName = path.basename(filePath);
    const fileStream = fs.createReadStream(filePath, { highWaterMark: CHUNK_SIZE });

    let uploadedBytes = 0;
    const chunks = [];

    return new Promise((resolve, reject) => {
      fileStream.on('data', async (chunk) => {
        uploadedBytes += chunk.length;
        chunks.push(chunk);

        const progress = (uploadedBytes / fileSize) * 100;
        onProgress(progress, uploadedBytes);

        // Upload when we have enough chunks
        if (chunks.length >= 1 || uploadedBytes === fileSize) {
          fileStream.pause();

          try {
            const formData = new FormData();
            formData.append('file', new Blob(chunks), fileName);

            await axios.post(`${serverUrl}/api/upload`, formData, {
              headers: {
                'Content-Type': 'multipart/form-data'
              },
              timeout: 60000
            });

            chunks.length = 0;
            fileStream.resume();
          } catch (error) {
            fileStream.destroy();
            reject(new Error(`Chunk upload failed: ${error.message}`));
          }
        }
      });

      fileStream.on('end', async () => {
        if (chunks.length > 0) {
          try {
            const formData = new FormData();
            formData.append('file', new Blob(chunks), fileName);

            await axios.post(`${serverUrl}/api/upload`, formData, {
              headers: {
                'Content-Type': 'multipart/form-data'
              },
              timeout: 60000
            });

            resolve();
          } catch (error) {
            reject(new Error(`Final chunk upload failed: ${error.message}`));
          }
        } else {
          resolve();
        }
      });

      fileStream.on('error', reject);
    });

  } catch (error) {
    throw new Error(`Upload error: ${error.message}`);
  }
}

export { compressFolder };
