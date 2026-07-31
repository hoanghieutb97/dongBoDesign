# ⚡ Quick Start Guide

Hướng dẫn nhanh để bắt đầu sử dụng File Sync.

## 🎯 Giả sử

- 2 máy tính kết nối qua internet
- **Máy 1**: Server (Linux hoặc Windows)
- **Máy 2**: Client (Windows)

## 📝 Bước 1: Setup Server (5 phút)

### Trên máy Server (Linux)

```bash
# 1. Clone hoặc tải project
cd ~/dongBoDesign/server

# 2. Cài đặt dependencies
npm install

# 3. Chạy server
npm start
```

**Output mong đợi:**
```
✅ Server running on http://localhost:3000
📁 Upload destination: /home/user/Desktop/in
```

**Tìm IP address của server:**
```bash
# Linux
hostname -I

# Windows
ipconfig
```

Ghi lại IP này, ví dụ: `192.168.1.100`

---

## 📝 Bước 2: Setup Client (5 phút)

### Trên máy Client (Windows)

```powershell
# 1. Mở PowerShell/CMD tại thư mục project
cd D:\dongBoDesign\client

# 2. Cài đặt dependencies
npm install

# 3. Chạy client
npm start
```

GUI sẽ mở lên.

---

## 🚀 Bước 3: Sử dụng (2 phút)

### Trong giao diện Client:

1. **Nhập Server URL**
   - Ô input trên cùng: nhập `http://192.168.1.100:3000`
   - (Thay `192.168.1.100` bằng IP thực của server bạn)

2. **Chọn thư mục**
   - Click nút "Chọn" để chọn thư mục trên máy
   - Hoặc paste đường dẫn trực tiếp, ví dụ: `D:\MyFolder`

3. **Bắt đầu**
   - Click "🚀 Bắt đầu đồng bộ"
   - Theo dõi tiến độ trên màn hình

### Trên Server:

File đã được tải về sẽ ở:
```
~/Desktop/in/MyFolder/
```

---

## 🔗 Kết nối giữa 2 máy

### Tùy chọn 1: Cùng mạng WiFi (Dễ nhất)

```bash
# Trên server: tìm IP
hostname -I
# Output: 192.168.1.100

# Trên client: nhập URL
http://192.168.1.100:3000
```

### Tùy chọn 2: Qua internet public (Nâng cao)

```bash
# Trên server: mở port 3000
# 1. Note IP public: https://whatismyipaddress.com
# 2. Cấu hình port forwarding trên router
# 3. Kiểm tra: curl http://YOUR_PUBLIC_IP:3000/api/status

# Trên client:
http://YOUR_PUBLIC_IP:3000
```

### Tùy chọn 3: VPN (Bảo mật nhất)

```bash
# Dùng VPN như Tailscale, WireGuard...
# 1. Setup VPN trên cả 2 máy
# 2. Dùng IP VPN thay vì IP local
```

---

## ✅ Kiểm tra kết nối

```bash
# Trên client (PowerShell):
curl http://192.168.1.100:3000/api/status

# Hoặc mở trình duyệt:
http://192.168.1.100:3000/api/status
```

**Nếu thành công:** Thấy JSON response
```json
{
  "server": "running",
  "uploadPath": "/home/user/Desktop/in"
}
```

**Nếu thất bại:** 
- Kiểm tra server đã chạy chưa
- Kiểm tra firewall
- Kiểm tra IP address

---

## 🚀 Gợi ý cho lần đầu

### Upload file nhỏ trước
```
✅ Upload thư mục 100MB trước (kiểm tra kết nối)
❌ Không upload 4GB ngay lần đầu
```

### Kiểm tra kết nối máy tính
```bash
# Trên client: ping server
ping 192.168.1.100

# Nếu ping được: kết nối OK
# Nếu timeout: kiểm tra firewall/IP
```

---

## 📊 Dự kiến tốc độ

| Kết nối | Tốc độ |
|---------|--------|
| LAN gigabit | 50-100 MB/s |
| WiFi 5GHz | 10-30 MB/s |
| Internet 50 Mbps | 5-6 MB/s |
| Internet 10 Mbps | 1-2 MB/s |

**Ví dụ:** Upload 1GB qua internet 50 Mbps ≈ 2-3 phút

---

## 🆘 Troubleshooting nhanh

### Lỗi 1: "ECONNREFUSED"
```bash
# Vấn đề: Server không chạy
# Giải pháp:
# 1. Kiểm tra terminal server: đã start chưa?
# 2. Kiểm tra port: npm start (default 3000)
# 3. Kiểm tra firewall: allow port 3000
```

### Lỗi 2: "Timeout"
```bash
# Vấn đề: Không kết nối được
# Giải pháp:
# 1. Ping server: ping 192.168.1.100
# 2. Kiểm tra IP: hostname -I (Linux) / ipconfig (Windows)
# 3. Tắt VPN/Proxy tạm thời
```

### Lỗi 3: Upload thất bại giữa chừng
```bash
# Vấn đề: Mất kết nối
# Giải pháp:
# 1. Thử upload file nhỏ hơn
# 2. Kiểm tra kết nối internet
# 3. Tăng timeout: chỉnh compressor.js (timeout: 120000)
```

---

## 💡 Tips

- **SSH Tunnel** nếu cần bảo mật:
  ```bash
  ssh -L 3000:localhost:3000 user@server-ip
  ```

- **Keep-alive**: Server sẽ tự động tạo thư mục nếu chưa có

- **File logs**: Kiểm tra console của server để debug

---

## 🎓 Bước tiếp theo

Sau khi quen với app:

1. ✅ Đọc [README.md](README.md) để hiểu rõ hơn
2. ✅ Cấu hình tường lửa cho bảo mật
3. ✅ Setup VPN nếu dùng qua internet public
4. ✅ Thêm xác thực nếu cần (xem README)

---

## 📞 Cần giúp?

1. Kiểm tra console của server/client
2. Xem logs: DevTools (Ctrl+Shift+I trên client)
3. Test ping: `ping server-ip`
4. Đọc README.md phần Troubleshooting

---

**Chúc bạn sử dụng vui! 🎉**
