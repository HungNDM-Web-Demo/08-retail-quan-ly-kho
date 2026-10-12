# Kịch bản demo — Quản lý Kho

> Dùng khi trình bày cho khách. Mục tiêu: 10–15 phút, đi theo câu chuyện công việc hằng ngày của khách, không đi theo danh sách menu.

---

## 1. Chuẩn bị trước buổi demo

- [ ] Mở sẵn link demo, kiểm tra đăng nhập được với cả 3 tài khoản
- [ ] Đặt lại dữ liệu demo (`DemoToolbar` → Đặt lại dữ liệu)
- [ ] Đổi tên, logo, màu theo thương hiệu khách (`Cài đặt` → `Thương hiệu`) nếu đã có
- [ ] Mở sẵn các tab cần chiếu song song (vd: màn hình bán hàng + màn hình bếp)
- [ ] Chuẩn bị điện thoại / tablet nếu demo có giao diện cho khách hàng cuối hoặc nhân viên

| Link | Ghi chú |
| :--- | :--- |
| FE | `http://localhost:3108` hoặc link online |
| Swagger | `https://localhost:7108/swagger` (khi khách hỏi về tích hợp) |

| Tài khoản | Vai trò | Dùng để cho xem |
| :--- | :--- | :--- |
| `admin` | Quản trị viên | Cài đặt, phân quyền |
| `quanly` | Quản lý | Báo cáo, duyệt |
| `nhanvien` | Nhân viên | Thao tác hằng ngày |

Mật khẩu: giá trị `DEMO_PASSWORD` trong `.env` (hoặc bấm "Đăng nhập nhanh").

## 2. Câu chuyện demo

_Viết theo thứ tự trình bày. Mỗi bước: đăng nhập vai trò nào, bấm gì, khách thấy được lợi ích gì._

| # | Vai trò | Thao tác | Điểm cần nhấn mạnh |
| :---: | :--- | :--- | :--- |
| 1 | Quản lý | Mở Tổng quan | Nhìn một màn hình biết ngay tình hình hôm nay |
| 2 | Nhân viên | | |
| 3 | | | |
| 4 | Quản trị viên | Đổi quyền của vai trò Nhân viên, chuyển vai trò để thấy menu thay đổi | Phân quyền chi tiết đến từng nút |
| 5 | Quản lý | Xem lại báo cáo sau các thao tác ở trên | Số liệu cập nhật ngay |

## 3. Câu hỏi khách hay hỏi

| Câu hỏi | Trả lời gợi ý |
| :--- | :--- |
| Có chạy trên điện thoại không? | Có, giao diện tự co giãn; phần cho khách hàng cuối thiết kế ưu tiên điện thoại. |
| Mất mạng thì sao? | _Tùy dự án_ |
| Có kết nối được phần mềm kế toán / hóa đơn điện tử không? | Có thể tích hợp qua API, demo hiện giả lập. |
| Dữ liệu lưu ở đâu? | Server riêng của khách hoặc cloud, có sao lưu định kỳ. |
| Tùy chỉnh theo quy trình riêng được không? | Được, demo là bản chuẩn; bản triển khai sẽ khảo sát và điều chỉnh. |

## 4. Sau buổi demo

- [ ] Ghi lại yêu cầu khách nêu thêm vào `01-TONG-QUAN-NGHIEP-VU.md`
- [ ] Gửi link demo + tài khoản cho khách tự trải nghiệm (nếu đồng ý)
