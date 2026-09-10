import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { pipeline } from 'stream';
import { promisify } from 'util';
import AdmZip from 'adm-zip';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8888;
const DESKTOP_IN = path.join(os.homedir(), 'Desktop', 'in');

app.use(cors());
app.use(express.json());

// Ensure destination folder exists
if (!fs.existsSync(DESKTOP_IN)) {
  fs.mkdirSync(DESKTOP_IN, { recursive: true });
}

// Store WebSocket clients for progress updates
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.forEach(c => c === ws && clients.delete(ws)));
});

function broadcastProgress(data) {
  clients.forEach(ws => {
    if (ws.readyState === 1) ws.send(JSON.stringify(data));
  });
}

// Configure multer for large files (4GB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 * 1024 } // 4GB
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // File name format:
    // - Root file: "folderName||fileName"
    // - Subfolder file: "folderName||relativePath||fileName"
    const originalName = req.file.originalname;
    console.log('📥 Received file:', originalName);

    const parts = originalName.split('||');
    console.log('📋 Parts:', parts, 'Length:', parts.length);

    let folderName, relativePath, actualFileName;

    if (parts.length === 2) {
      // File in root folder
      [folderName, actualFileName] = parts;
      relativePath = '';
    } else if (parts.length === 3) {
      // File in subfolder
      [folderName, relativePath, actualFileName] = parts;
    } else {
      console.log('❌ Invalid format! Expected 2 or 3 parts, got:', parts.length);
      return res.status(400).json({ error: `Invalid file name format` });
    }

    if (!folderName || !actualFileName) {
      return res.status(400).json({ error: 'Invalid file name format' });
    }

    const folderPath = path.join(DESKTOP_IN, folderName);
    const fileDir = relativePath && relativePath.trim()
      ? path.join(folderPath, relativePath)
      : folderPath;

    // Create directory if doesn't exist
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    // Save file
    const filePath = path.join(fileDir, actualFileName);
    await fs.promises.writeFile(filePath, req.file.buffer);

    broadcastProgress({
      status: 'file_saved',
      file: actualFileName,
      folder: folderName,
      relativePath: relativePath || ''
    });

    res.json({
      success: true,
      message: 'File saved',
      folder: folderName,
      file: actualFileName
    });

  } catch (error) {
    console.error('Upload error:', error);
    broadcastProgress({ status: 'error', message: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ server: 'running', uploadPath: DESKTOP_IN });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📁 Upload destination: ${DESKTOP_IN}`);
});
