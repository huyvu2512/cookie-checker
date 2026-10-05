# Chính Sách Bảo Mật (Security Policy)

## Phạm vi và Mục đích

Dự án này được xây dựng hoàn toàn với mục đích học tập, nghiên cứu về cơ chế quản lý phiên đăng nhập web và kiến trúc giao tiếp API. Mọi hành vi sử dụng công cụ này để truy cập trái phép vào tài khoản không thuộc quyền sở hữu của bạn đều vi phạm điều khoản dịch vụ của Netflix và các quy định pháp luật hiện hành.

## Xử lý Dữ liệu Người dùng

1. **Không lưu trữ cookie trên server:** Server Node.js và Python không lưu trữ bất kỳ dữ liệu cookie, thông tin phiên hay mật khẩu người dùng vào cơ sở dữ liệu nào. Dữ liệu chỉ được xử lý tạm thời trong bộ nhớ RAM để phản hồi yêu cầu và được giải phóng tự động ngay sau đó.
2. **Lưu trữ cục bộ:** Trên trình duyệt, cookie và kết quả phiên được lưu tạm thời trong localStorage của máy khách nhằm duy trì trạng thái làm việc và sẽ bị xóa sạch hoàn toàn khi người dùng nhấn nút Xóa dữ liệu.
3. **Bảo mật Bot Telegram:** Bot Token và Chat ID được lưu trữ ngay trên trình duyệt của bạn và đồng bộ trực tiếp qua API Telegram bằng kết nối HTTPS mã hóa an toàn.

## Báo cáo Lỗ hổng Bảo mật

Nếu bạn phát hiện bất kỳ vấn đề bảo mật tiềm ẩn nào liên quan đến mã nguồn của dự án này, vui lòng thực hiện theo các bước sau:

1. Tuyệt đối không công khai lỗ hổng qua hệ thống Issue công khai của GitHub.
2. Gửi thông tin chi tiết về lỗ hổng kèm các bước tái hiện tới kênh liên hệ cá nhân của tác giả:
   - Trang thông tin: https://huyvu2512.io.vn
   - Hồ sơ GitHub: https://github.com/huyvu2512
3. Tác giả sẽ tiếp nhận, đánh giá mức độ nghiêm trọng và phát hành bản cập nhật vá lỗi trong thời gian sớm nhất.
