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

const PORT = process.env.PORT || 3000;
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

    const fileName = req.file.originalname;
    const folderName = path.parse(fileName).name;
    const extractPath = path.join(DESKTOP_IN, folderName);

    // Create folder if doesn't exist
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    // Save file temporarily
    const tempFilePath = path.join(DESKTOP_IN, fileName);
    await fs.promises.writeFile(tempFilePath, req.file.buffer);

    broadcastProgress({ status: 'extracting', file: fileName });

    // Extract zip
    const zip = new AdmZip(tempFilePath);
    zip.extractAllTo(extractPath, true);

    // Remove temp zip file
    await fs.promises.unlink(tempFilePath);

    broadcastProgress({ status: 'completed', file: fileName, folder: folderName });

    res.json({
      success: true,
      message: 'File uploaded and extracted',
      folder: folderName,
      path: extractPath
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
