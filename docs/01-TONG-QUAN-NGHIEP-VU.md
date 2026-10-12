# Tổng quan nghiệp vụ — Quản lý Kho

> Mô tả demo này cho ai, giải quyết vấn đề gì. Cập nhật khi phạm vi thay đổi.

---

## 1. Thông tin chung

| Mục | Nội dung |
| :--- | :--- |
| Tên demo | Quản lý Kho |
| Mã dự án | `retail-quan-ly-kho` |
| Ngành / loại khách hàng | Doanh nghiệp thương mại, phân phối có 1–3 kho |
| Loại sản phẩm | Web quản lý |
| Ý tưởng gốc | 2.4 · Quản lý kho: xuất nhập tồn (`ZDOCS/02-KE-HOACH/DANH-SACH-Y-TUONG.md`) |
| Người phụ trách | |
| Trạng thái | Có tài liệu nghiệp vụ (SRS, use case, kịch bản demo, kịch bản kiểm thử), chưa code |

## 2. Vấn đề của khách hàng

- Tồn kho trên sổ khác thực tế
- Nhập xuất ghi Excel, khó truy vết
- Không biết hàng nào tồn lâu, hàng nào sắp hết
- Kiểm kê mất nhiều ngày

## 3. Giải pháp demo thể hiện

- Danh mục hàng hóa, nhà cung cấp, kho
- Phiếu nhập, xuất, chuyển kho có duyệt
- Tồn kho theo thời gian thực từng kho, thẻ kho
- Kiểm kê, điều chỉnh chênh lệch
- Cảnh báo tồn tối thiểu, báo cáo xuất nhập tồn

## 4. Vai trò người dùng

| Vai trò | Mã | Dùng trên | Làm được gì |
| :--- | :--- | :--- | :--- |
| Quản trị viên | ADMIN | Desktop | Toàn quyền |
| Quản lý kho | MANAGER | Desktop | Duyệt phiếu, báo cáo |
| Thủ kho | STAFF | Desktop, tablet | Lập phiếu, kiểm kê |

## 5. Phân hệ và chức năng

| Area | Chức năng | Màn hình (route FE dự kiến) | Ưu tiên |
| :--- | :--- | :--- | :---: |
| `System` | Đăng nhập, tài khoản, vai trò, cài đặt | Có sẵn | — |
| `Inventory` | Tổng quan kho, việc cần làm của thủ kho | `/dashboard` | P1 |
| `Inventory` | Hàng hóa, nhà cung cấp, kho | `/products`, `/suppliers`, `/warehouses` | P1 |
| `Inventory` | Phiếu nhập | `/goods-receipts` | P1 |
| `Inventory` | Lập, xem, in phiếu nhập | `/goods-receipts/[id]` | P1 |
| `Inventory` | Phiếu xuất | `/goods-issues` | P1 |
| `Inventory` | Lập, xem, in phiếu xuất | `/goods-issues/[id]` | P1 |
| `Inventory` | Phiếu chờ duyệt | `/approvals` | P1 |
| `Inventory` | Chuyển kho | `/transfers` | P2 |
| `Inventory` | Lập, duyệt, nhận phiếu chuyển kho | `/transfers/[id]` | P2 |
| `Inventory` | Tồn kho theo kho | `/stock` | P1 |
| `Inventory` | Kiểm kê | `/stocktakes` | P1 |
| `Inventory` | Đếm, duyệt, in phiếu kiểm kê | `/stocktakes/[id]` | P1 |
| `Inventory` | Thẻ kho | `/stock/[productId]` | P1 |
| `Inventory` | Cảnh báo tồn tối thiểu | `/stock` | P2 |
| `Inventory` | Báo cáo xuất nhập tồn | `/reports` | P1 |

P1 = bắt buộc có để demo · P2 = nên có · P3 = làm thêm nếu còn thời gian.

## 6. Luồng nghiệp vụ chính

```mermaid
flowchart LR
    S0["Lập phiếu nhập"] --> S1["Quản lý duyệt, tăng tồn"] --> S2["Lập phiếu xuất"] --> S3["Quản lý duyệt, giảm tồn"] --> S4["Kiểm kê định kỳ"] --> S5["Điều chỉnh chênh lệch"]
```

## 7. Phạm vi

**Có trong demo:**

- Nhập, xuất, chuyển kho, kiểm kê, báo cáo

**Không làm (nói rõ với khách nếu được hỏi):**

- Thiết bị quét mã vạch thật
- Kết nối phần mềm kế toán
- Các kết nối bên ngoài khác chỉ giả lập

## 8. Dữ liệu mẫu cần chuẩn bị

| Dữ liệu | Số lượng | Ghi chú |
| :--- | :---: | :--- |
| Kho | 3 |  |
| Nhà cung cấp | 15 |  |
| Hàng hóa | 200 |  |
| Phiếu nhập, xuất | ~600 | 90 ngày |
| Phiếu kiểm kê | 3 |  |
