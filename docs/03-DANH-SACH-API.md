# Danh sách API — Quản lý Kho

> Base URL dev: `https://localhost:7108` · Swagger: `https://localhost:7108/swagger`
> Quy ước chung (đường dẫn, phân trang, lỗi) và API nền (auth, users, roles, settings, audit-logs, demo): xem `ZDOCS/03-KIEN-TRUC/QUY-UOC-API.md`.
> File này chỉ liệt kê **API nghiệp vụ riêng của dự án**. Điền khi làm từng chức năng.

---

## 1. Mã quyền nghiệp vụ

| Nhóm | Mã quyền | Vai trò mặc định |
| :--- | :--- | :--- |
| | | |

---

## 2. API nghiệp vụ

> Mỗi chức năng một mục, theo mẫu dưới.

### 2.x. {Tên chức năng} — `/api/{resource}`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/{resource}` | `{resource}.view` | |
| GET | `/api/{resource}/{id}` | `{resource}.view` | |
| POST | `/api/{resource}` | `{resource}.create` | |
| PUT | `/api/{resource}/{id}` | `{resource}.update` | |
| DELETE | `/api/{resource}/{id}` | `{resource}.delete` | |
