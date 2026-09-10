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

// Store chunk metadata
const uploadSessions = new Map();

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const folderName = req.body.folderName;
    const relativePath = req.body.relativePath || '';
    const actualFileName = req.body.fileName;
    const chunkIndex = parseInt(req.body.chunkIndex) || 0;
    const totalChunks = parseInt(req.body.totalChunks) || 1;
    const fileSize = parseInt(req.body.fileSize) || 0;

    console.log(`📥 Chunk ${chunkIndex + 1}/${totalChunks}: ${actualFileName}`);

    if (!folderName || !actualFileName) {
      return res.status(400).json({ error: 'Invalid file name format' });
    }

    const folderPath = path.join(DESKTOP_IN, folderName);
    const fileDir = relativePath && relativePath.trim()
      ? path.join(folderPath, relativePath.replace(/\//g, path.sep))
      : folderPath;

    // Create directory if doesn't exist
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    // Handle chunks
    const sessionId = `${folderName}/${relativePath}/${actualFileName}`;
    if (!uploadSessions.has(sessionId)) {
      uploadSessions.set(sessionId, {
        chunks: new Map(),
        totalChunks,
        fileSize,
        folderPath,
        fileDir,
        folderName,
        relativePath,
        actualFileName
      });
    }

    const session = uploadSessions.get(sessionId);
    session.chunks.set(chunkIndex, req.file.buffer);

    console.log(`   Stored chunk ${chunkIndex + 1}/${totalChunks} (${req.file.buffer.length} bytes)`);

    // Check if all chunks received
    if (session.chunks.size === totalChunks) {
      console.log(`🔄 Assembling ${actualFileName}...`);

      // Combine all chunks
      const buffers = [];
      for (let i = 0; i < totalChunks; i++) {
        buffers.push(session.chunks.get(i));
      }
      const completeBuffer = Buffer.concat(buffers);

      // Save complete file
      const filePath = path.join(fileDir, actualFileName);
      await fs.promises.writeFile(filePath, completeBuffer);

      console.log(`✅ File saved: ${filePath}`);

      uploadSessions.delete(sessionId);

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
        file: actualFileName,
        chunkIndex,
        totalChunks
      });
    } else {
      console.log(`   Waiting for more chunks... (${session.chunks.size}/${totalChunks})`);
      res.json({
        success: true,
        message: 'Chunk received',
        chunkIndex,
        totalChunks
      });
    }

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
