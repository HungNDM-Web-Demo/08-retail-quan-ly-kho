# Thiết kế CSDL — Quản lý Kho

> Database: `WebDemo_RetailQuanLyKho`.
> Quy ước chung và nhóm bảng nền `System_*` (tài khoản, vai trò, quyền, cài đặt, nhật ký): xem `ZDOCS/03-KIEN-TRUC/THIET-KE-CSDL-NEN.md`.
> File này chỉ mô tả **bảng nghiệp vụ riêng của dự án**. Điền khi làm từng chức năng.

---

## 1. Sơ đồ

```mermaid
erDiagram
    %% Ví dụ: Pos_Categories ||--o{ Pos_MenuItems : "gồm"
```

---

## 2. Danh sách bảng

| Bảng | Area | Mô tả | Dữ liệu mẫu |
| :--- | :--- | :--- | :---: |
| | | | |

---

## 3. Mô tả bảng

> Mỗi bảng một mục, theo mẫu dưới.

### `{Area}_{TenBang}`: {mô tả ngắn}

| Cột | Kiểu | Ràng buộc | Ghi chú |
| :--- | :--- | :--- | :--- |
| `Code` | `nvarchar(50)` | unique | |
| … | | | |

Enum:

| Giá trị | Tên | Ý nghĩa |
| :---: | :--- | :--- |
| 0 | … | |

Dữ liệu mẫu: {số dòng, đặc điểm, khoảng thời gian}
