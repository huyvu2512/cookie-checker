# Hướng Dẫn Đóng Góp (Contributing Guide)

Cảm ơn bạn đã quan tâm và muốn đóng góp vào sự phát triển của dự án. Dưới đây là quy trình và các tiêu chuẩn để đóng góp mã nguồn.

## Quy trình Đóng góp

1. **Fork dự án** về tài khoản GitHub cá nhân của bạn.
2. **Tạo nhánh (branch) mới** cho tính năng hoặc bản sửa lỗi:
   ```bash
   git checkout -b feature/ten-tinh-nang
   ```
3. **Cài đặt và kiểm thử** trên môi trường cục bộ:
   ```bash
   npm install
   npm run dev
   ```
4. **Cam kết mã nguồn (commit)** với thông điệp rõ ràng theo quy chuẩn:
   ```bash
   git commit -m "feat: mô tả chi tiết thay đổi"
   ```
5. **Đẩy mã nguồn lên GitHub** và tạo Pull Request (PR) về nhánh `main` của kho lưu trữ gốc.

## Tiêu chuẩn Mã nguồn

- Giữ đúng kiến trúc phân chia: Toàn bộ Frontend tĩnh nằm trong thư mục `public/`, Backend nằm tại `server.js` và `api.py`.
- Không tự ý thêm các thư viện không cần thiết nhằm duy trì dung lượng dự án nhẹ và tối ưu nhất.
- Đảm bảo tính nhất quán của các thông tin meta, chú thích và thiết lập SEO trên toàn bộ hệ thống.
- Không chèn thêm các ký tự biểu tượng cảm xúc (icon/emoji) vào tài liệu của dự án.
