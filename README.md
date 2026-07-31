# 📁 File Sync - Đồng bộ thư mục qua Internet

Ứng dụng desktop để đồng bộ thư mục giữa 2 máy tính qua internet. Hỗ trợ file lên đến **4GB** với tốc độ tối ưu.

## 🎯 Tính năng

- ✅ **GUI đơn giản** - Chọn thư mục bằng chuột hoặc paste đường dẫn
- ✅ **Nén tự động** - Tự động nén file để tiết kiệm băng thông
- ✅ **Upload nhanh** - Chunked upload với stream processing
- ✅ **Báo cáo tiến độ** - Real-time progress, tốc độ, và thời gian còn lại
- ✅ **Cross-platform** - Client Windows, Server Linux/Windows
- ✅ **Không cần xác thực** - Kết nối đơn giản

## 📋 Yêu cầu

### Server (Linux/Windows)
- Node.js v16+ 
- npm

### Client (Windows)
- Node.js v16+
- npm

## 🚀 Cài đặt & Chạy

### 1️⃣ Server Setup

```bash
cd server
npm install
npm start
```

Server sẽ chạy trên `http://localhost:3000` (hoặc port khác nếu cấu hình)

Các file được tải về sẽ lưu trong: `~/Desktop/in/`

### 2️⃣ Client Setup

```bash
cd client
npm install
npm start
```

Giao diện sẽ mở lên, nhập server URL và chọn thư mục để bắt đầu.

## 📖 Hướng dẫn sử dụng

### Trên Client (Windows)

1. **Chọn thư mục**
   - Click nút "Chọn" để chọn thư mục bằng file dialog
   - Hoặc paste đường dẫn trực tiếp vào ô input

2. **Nhập Server URL**
   - Format: `http://{IP_SERVER}:3000`
   - Ví dụ: `http://192.168.1.100:3000`

3. **Bắt đầu đồng bộ**
   - Click nút "🚀 Bắt đầu đồng bộ"
   - Theo dõi tiến độ: nén file → upload → giải nén

### Trên Server (Linux)

File được tải về sẽ ở:
```
~/Desktop/in/{tên_thư_mục}/
```

Ví dụ:
```
~/Desktop/in/my_project/  ← Thư mục được tạo tự động
  ├── file1.txt
  ├── file2.doc
  └── subfolder/
```

## ⚙️ Cấu hình

### Server

Chỉnh sửa `server/index.js`:
```javascript
const PORT = process.env.PORT || 3000;  // Thay đổi port
const DESKTOP_IN = path.join(os.homedir(), 'Desktop', 'in');  // Thay đổi thư mục đích
```

### Client

Chỉnh sửa `client/src/compressor.js`:
```javascript
const CHUNK_SIZE = 5 * 1024 * 1024;  // Kích thước chunk (hiện tại 5MB)
```

## 📊 Hiệu suất

### Tối ưu hóa cho file lớn:

- **Compression**: Level 1 (nhanh) thay vì level 9
- **Chunked Upload**: Chia thành chunk 5MB để tránh timeout
- **Streaming**: Không load toàn bộ file vào memory
- **Progress Tracking**: Real-time báo cáo qua WebSocket

### Tốc độ dự kiến:

- **LAN**: 100+ MB/s
- **Internet 50 Mbps**: ~5 MB/s
- **Internet 10 Mbps**: ~1 MB/s

## 🔒 Bảo mật

⚠️ **Lưu ý**: Hiện tại không có xác thực. Để sử dụng an toàn:

- Chạy trên mạng riêng (VPN)
- Không expose port lên internet công khai
- Thêm firewall rules nếu cần

Nếu cần xác thực, thêm vào `server/index.js`:
```javascript
app.use((req, res, next) => {
  const token = req.headers['authorization'];
  if (token !== 'Bearer YOUR_SECRET_TOKEN') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

## 🐛 Troubleshooting

### Lỗi "ECONNREFUSED"
- Server chưa chạy hoặc port sai
- Kiểm tra IP address của server
- Tắt firewall (tạm thời) để test

### Upload chậm
- Kiểm tra tốc độ internet: `speedtest.net`
- Giảm kích thước file (nén trước)
- Kiểm tra load CPU trên server

### File không xuất hiện sau upload
- Kiểm tra thư mục: `~/Desktop/in/`
- Xem logs server console
- Kiểm tra quyền truy cập thư mục

## 📝 Cấu trúc dự án

```
dongBoDesign/
├── server/
│   ├── index.js          # Main server (Express + WebSocket)
│   └── package.json
│
└── client/
    ├── main.js           # Electron main process
    ├── preload.js        # IPC bridge
    ├── src/
    │   ├── index.html    # GUI HTML
    │   ├── renderer.js   # Frontend logic
    │   └── compressor.js # Compression & upload logic
    └── package.json
```

## 🔄 Quy trình dữ liệu

```
Client                          Server
  │                               │
  ├─ Chọn thư mục                 │
  │                               │
  ├─ Nén (Level 1)                │
  │                               │
  ├─ Chia chunk (5MB)      ──────→│
  │                               │
  ├─ Upload chunk 1        ──────→├─ Nhận chunk
  │                               │
  ├─ Upload chunk 2        ──────→├─ Ghi file
  │                               │
  ├─ Upload chunk N        ──────→├─ Giải nén
  │                               │
  ├─ Hoàn thành            ──────→├─ Tạo thư mục
  │                               │
  │                               └─ Lưu vào ~/Desktop/in/
```

## 📞 Hỗ trợ

Nếu có lỗi, hãy:
1. Kiểm tra console (DevTools: Ctrl+Shift+I)
2. Xem server logs
3. Kiểm tra kết nối internet
4. Thử với file nhỏ trước

## 📜 License

MIT
