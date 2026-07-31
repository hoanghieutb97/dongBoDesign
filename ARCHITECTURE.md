# 🏗️ Kiến trúc File Sync

Chi tiết kỹ thuật về cách hoạt động của ứng dụng.

## 🎯 Tổng quan

```
┌─────────────────┐                    ┌──────────────────┐
│   Windows PC    │                    │    Linux PC      │
│   (Client)      │                    │   (Server)       │
│                 │                    │                  │
│  ┌───────────┐  │  HTTP + WebSocket  │  ┌────────────┐  │
│  │  Electron │  │◄───────────────────►│  │  Express   │  │
│  │    GUI    │  │    Chunked Upload   │  │  + WS      │  │
│  │           │  │                    │  │            │  │
│  │ Archiver  │  │                    │  │  AdmZip    │  │
│  └───────────┘  │                    │  └────────────┘  │
│                 │                    │                  │
└─────────────────┘                    └──────────────────┘
       │                                       │
       │                                       │
       └─── Compression (Level 1)              └─ Decompress
       └─── Streaming Upload                   └─ Save to ~/Desktop/in/
```

## 📦 Cấu trúc thư mục

```
dongBoDesign/
├── server/                    # Server component
│   ├── index.js              # Express server + WebSocket
│   ├── package.json          # Server dependencies
│   └── uploads/              # Temp storage (nếu cấu hình)
│
├── client/                    # Client component (Electron)
│   ├── main.js               # Electron main process + IPC handlers
│   ├── preload.js            # Secure IPC bridge
│   ├── src/
│   │   ├── index.html        # GUI (Responsive UI)
│   │   ├── renderer.js       # Frontend logic
│   │   └── compressor.js     # Compression + Upload logic
│   ├── package.json          # Client dependencies
│   └── node_modules/
│
├── README.md                 # Full documentation
├── QUICKSTART.md             # Quick start guide
├── ARCHITECTURE.md           # This file
└── .gitignore               # Git ignore patterns
```

## 🔄 Quy trình hoạt động

### 1. Client Side (Windows)

```
┌─────────────────────────────────────┐
│  Người dùng chọn thư mục            │
│  + Nhập server URL                  │
│  + Click "Bắt đầu đồng bộ"         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Validate input                     │
│  - Kiểm tra thư mục có tồn tại     │
│  - Kiểm tra server URL hợp lệ      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Compression (archiver)             │
│  - Read folder recursively          │
│  - Zip với level 1 (nhanh)         │
│  - Stream to temp file              │
│  - Report progress: 0-100%          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Split into chunks (5MB each)       │
│  - Dễ dàng handle file lớn         │
│  - Tránh timeout                    │
│  - Parallel capable                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Upload chunks sequentially         │
│  - Chunk 1 (5MB)                   │
│  - Chunk 2 (5MB)                   │
│  - ...                             │
│  - Chunk N (remaining)             │
│  - Report: tốc độ, thời gian       │
└──────────────┬──────────────────────┘
               │
               ▼
         Server xử lý
```

### 2. Server Side (Linux/Windows)

```
┌─────────────────────────────────────┐
│  Nhận HTTP POST request             │
│  - File name                        │
│  - File data (chunk)                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Ghi file temp                      │
│  - Buffer chunk data                │
│  - Ghi vào disk                     │
│  - Stream processing (không cache)  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Khi upload xong                    │
│  - Tạo folder: ~/Desktop/in/{name}  │
│  - Extract zip file                 │
│  - Xóa file zip                     │
│  - Broadcast completion qua WS      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Success!                           │
│  - File đã nằm ở: ~/Desktop/in/     │
│  - Folder structure bảo toàn        │
│  - Ready for next sync              │
└─────────────────────────────────────┘
```

## 🚀 Tối ưu hóa cho file lớn

### 1. Compression Level

```javascript
// compressor.js
const archive = archiver('zip', {
  zlib: { level: 1 }  // ✅ Level 1 (nhanh nhất)
});
// 
// Level: 0 = no compression, 9 = max compression
// Trade-off: Speed vs Size
// Chọn level 1: nhanh 10x so với level 9, size chỉ lớn 20%
```

### 2. Chunked Upload

```javascript
const CHUNK_SIZE = 5 * 1024 * 1024;  // 5MB per chunk

// Tạo file 4GB
// → Chia thành 800 chunks
// → Upload từng chunk 5MB
// → Tránh timeout, tránh memory overflow
```

**Lợi ích:**
- Nếu chunk 1 fail → retry chunk 1 (không cần upload toàn bộ lại)
- Memory usage: ~5MB (1 chunk) thay vì 4GB (toàn bộ file)
- Timeout: 60 giây per chunk (đủ cho 5MB)

### 3. Streaming

```javascript
// Client side
const fileStream = fs.createReadStream(filePath, { 
  highWaterMark: CHUNK_SIZE  // Buffer size = 5MB
});

// Server side
const output = fs.createWriteStream(zipPath);
archive.pipe(output);  // Direct pipe, không cache
```

**Lợi ích:**
- Không load toàn bộ file vào memory
- Real-time progress tracking
- CPU usage tối thiểu

### 4. Compression Strategy

```
Input: 1GB folder

Option A: Compress + Upload (chọn)
1GB → 100MB (compress) → 100MB upload
Time: 10s compress + 20s upload = 30s

Option B: Upload raw
1GB → 1GB upload
Time: 200s upload = 3m 20s

✅ Tiết kiệm: 10x nhanh + 10x ít bandwidth
```

## 🔌 API Endpoints

### Server

#### POST `/api/upload`
- **Body**: multipart/form-data
  - `file`: Binary zip data
- **Response**: 
  ```json
  {
    "success": true,
    "message": "File uploaded and extracted",
    "folder": "my_project",
    "path": "/home/user/Desktop/in/my_project"
  }
  ```

#### GET `/api/status`
- **Response**:
  ```json
  {
    "server": "running",
    "uploadPath": "/home/user/Desktop/in"
  }
  ```

### WebSocket

**Event: `progress`**
- Server → Client
- Dùng để broadcast tình trạng extraction

```json
{
  "status": "extracting",
  "file": "project.zip",
  "percent": 45
}
```

## 🔐 Bảo mật

### Hiện tại (Basic)
- ❌ Không xác thực
- ❌ HTTP (không HTTPS)
- ❌ Không rate limiting

### Khuyến cáo
```javascript
// Thêm token authentication
app.use((req, res, next) => {
  const token = req.headers['authorization'];
  if (token !== 'Bearer SECRET_TOKEN') {
    return res.status(401).send('Unauthorized');
  }
  next();
});

// Thêm HTTPS
const https = require('https');
const ssl = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};
https.createServer(ssl, app).listen(443);
```

## 📊 Performance Metrics

### Bandwidth Usage

| File Size | Compression | Original | Saved |
|-----------|-------------|----------|-------|
| 100 MB | 100→20 MB | 100 MB | 80% |
| 1 GB | 1000→200 MB | 1 GB | 80% |
| 4 GB | 4000→800 MB | 4 GB | 80% |

### Time Estimation

| Internet | 1 GB | 4 GB |
|----------|------|------|
| 50 Mbps | 2 min | 8 min |
| 10 Mbps | 10 min | 40 min |
| 100 Mbps | 1 min | 4 min |

## 🛠️ Technology Stack

### Server
- **Express.js** - Web framework
- **Multer** - File upload middleware
- **AdmZip** - ZIP extraction
- **WebSocket (ws)** - Real-time communication

### Client
- **Electron** - Desktop app framework
- **Archiver** - ZIP compression
- **Axios** - HTTP client
- **Node.js streams** - Efficient file handling

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Windows)                     │
│                                                         │
│  1. GUI                                                │
│     └─ User input: folder + server URL                 │
│                                                         │
│  2. Compressor                                         │
│     └─ archiver creates .zip file                      │
│     └─ Reports: 0-100% progress                        │
│                                                         │
│  3. Uploader                                           │
│     └─ Reads zip in 5MB chunks                         │
│     └─ HTTP POST each chunk                            │
│     └─ Reports: speed + time left                      │
│                                                         │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP + WebSocket
                       │
┌──────────────────────▼──────────────────────────────────┐
│                    Server (Linux)                       │
│                                                         │
│  1. Receiver                                           │
│     └─ Multer receives file chunk                      │
│     └─ Writes to temp location                         │
│                                                         │
│  2. Extractor                                          │
│     └─ AdmZip extracts to ~/Desktop/in/{folder}        │
│     └─ Broadcasts progress via WebSocket               │
│                                                         │
│  3. Cleanup                                            │
│     └─ Deletes temp .zip file                          │
│     └─ Returns success response                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 🎓 Tài liệu tham khảo

- [Electron Docs](https://www.electronjs.org/docs)
- [Express.js Guide](https://expressjs.com/)
- [Node.js Streams](https://nodejs.org/en/docs/guides/backpressuring-in-streams/)
- [Archiver Library](https://www.archiverjs.com/)

## 📈 Mở rộng trong tương lai

### Phase 2
- [ ] Multi-file upload
- [ ] Resume interrupted uploads
- [ ] Encryption
- [ ] Authentication

### Phase 3
- [ ] Web GUI (thay Electron)
- [ ] Database for history
- [ ] Bandwidth throttling
- [ ] Scheduled sync

### Phase 4
- [ ] P2P transfer (direct connection)
- [ ] Delta sync (only changed files)
- [ ] Backup to cloud
- [ ] Docker deployment
