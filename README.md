# 🍪 Netflix Cookie Checker & Token Generator

> ⚠️ **Chỉ dành cho mục đích học tập và nghiên cứu. Không sử dụng cho mục đích thương mại.**

---

## 📌 Tổng quan

Công cụ kiểm tra cookie Netflix và tạo token đăng nhập trực tiếp. Hỗ trợ:

- ✅ Kiểm tra cookie đơn lẻ hoặc hàng loạt (`.txt`, `.json`, `.zip`)
- 🔑 Tạo token đăng nhập (URL điện thoại & máy tính)
- 📊 Xem thông tin tài khoản (gói, email, hồ sơ, thanh toán...)
- ⏱️ Đồng hồ đếm ngược thời hạn token real-time
- 📱 Widget kích hoạt Netflix TV (nhập mã 8 số)
- 💾 Tự động lưu cookie & kết quả vào localStorage
- 📬 Tích hợp gửi kết quả qua Telegram Bot

---

## 🚀 Khởi chạy localhost

### Yêu cầu
- Python 3.8+
- pip

### Cài đặt & chạy

```bash
# 1. Cài thư viện
pip install -r requirements.txt

# 2. Chạy server
python api.py
```

Mở trình duyệt tại: **http://localhost:3000**

---

## 🗂️ Cấu trúc file

| File | Mô tả |
|------|-------|
| `api.py` | Backend Flask — xử lý cookie, tạo token, gửi Telegram |
| `index.html` | Giao diện người dùng |
| `style.css` | Stylesheet — Dark theme + animations |
| `script.js` | Logic frontend — gọi API, hiển thị kết quả, countdown |
| `requirements.txt` | Thư viện Python cần thiết |
| `vercel.json` | Cấu hình deploy Vercel (tùy chọn) |

---

## 📋 Tính năng nổi bật

### Tab Nhập Đơn
- Dán cookie Netflix (JSON / Netscape / text thuần)
- Chọn chế độ: **Đầy Đủ Thông Tin** hoặc **Chỉ Lấy Token**
- Tạo token và xem URL đăng nhập điện thoại / máy tính ngay lập tức

### Tab Hàng Loạt
- Kéo thả file hoặc chọn file (`.txt`, `.json`, `.zip`)
- Xử lý nhiều cookie cùng lúc
- Xuất kết quả ra file `.txt`

### Widget Kích Hoạt TV
- Nhập mã 8 số hiển thị trên TV Netflix
- Tự động copy mã vào clipboard rồi mở trang `netflix.com/tv2`

### Telegram Integration
- Cấu hình Bot Token & Chat ID
- Tự động gửi kết quả hit (cookie hợp lệ) qua Telegram

---

## ⚠️ Lưu ý quan trọng

- **Chỉ dành cho học tập** — Không sử dụng để đăng nhập tài khoản người khác trái phép.
- **Không thương mại hóa** — Không được bán, phân phối có thu phí, hoặc sử dụng vào dịch vụ kiếm tiền.
- Cookie Netflix là thông tin nhạy cảm, không chia sẻ cho bên thứ ba.
- Tác giả không chịu trách nhiệm về bất kỳ hành vi vi phạm pháp luật nào phát sinh từ việc sử dụng công cụ này.

---

## 👤 Tác giả

**Huy Vũ** — [beacons.ai/huyvu2512](https://beacons.ai/huyvu2512)
