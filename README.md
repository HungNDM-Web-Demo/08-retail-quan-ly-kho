# Quản lý Kho

> Dự án demo tạo từ `_template`. Mô tả nghiệp vụ: [docs/01-TONG-QUAN-NGHIEP-VU.md](docs/01-TONG-QUAN-NGHIEP-VU.md).

| Mục | Giá trị |
| :--- | :--- |
| Mã dự án | `retail-quan-ly-kho` |
| FE | `http://localhost:3108` |
| BE (Swagger) | `https://localhost:7108/swagger` |
| Database | `WebDemo_RetailQuanLyKho` |
| Tài khoản demo | Theo vai trò của dự án, xem bảng tài khoản trong [docs/04-KICH-BAN-DEMO.md](docs/04-KICH-BAN-DEMO.md); mật khẩu theo `DEMO_PASSWORD` |

---

## Chạy demo

### Cách 1: chỉ FE, dữ liệu mẫu (không cần BE, DB)

```bash
cd FE
pnpm install
copy .env.example .env.local
pnpm dev
```

Giữ `NEXT_PUBLIC_DATA_SOURCE=mock` trong `.env.local`.

### Cách 2: đầy đủ FE + BE + DB

```bash
cd BE
copy src\API\.env.example src\API\.env
dotnet run --project src/API
```

Khi `DEMO_MODE=true`, BE tự tạo DB, chạy migration và nạp dữ liệu mẫu lần đầu. Sau đó đổi `NEXT_PUBLIC_DATA_SOURCE=api` trong `FE/.env.local` rồi chạy FE như cách 1.

---

## Tài liệu riêng của dự án

| File | Nội dung |
| :--- | :--- |
| [docs/01-TONG-QUAN-NGHIEP-VU.md](docs/01-TONG-QUAN-NGHIEP-VU.md) | Khách hàng, vai trò, chức năng, phạm vi của demo này |
| [docs/02-SRS.md](docs/02-SRS.md) | Đặc tả yêu cầu: chức năng, quy tắc nghiệp vụ, dữ liệu, báo cáo, phân quyền, màn hình |
| [docs/03-USE-CASE.md](docs/03-USE-CASE.md) | Sơ đồ, danh sách và đặc tả use case |
| [docs/04-KICH-BAN-DEMO.md](docs/04-KICH-BAN-DEMO.md) | Kịch bản trình bày cho khách |
| [docs/05-KICH-BAN-KIEM-THU.md](docs/05-KICH-BAN-KIEM-THU.md) | Test case nghiệm thu |
| [docs/06-THIET-KE-CSDL.md](docs/06-THIET-KE-CSDL.md) | Bảng nghiệp vụ của dự án |
| [docs/07-DANH-SACH-API.md](docs/07-DANH-SACH-API.md) | Mã quyền và API nghiệp vụ của dự án |

## Tài liệu chung (thư mục `ZDOCS` của kho Web demo)

| File | Nội dung |
| :--- | :--- |
| `ZDOCS/03-KIEN-TRUC/KIEN-TRUC-HE-THONG.md` | Kiến trúc tổng, công nghệ, phân quyền, chế độ dữ liệu mẫu, triển khai |
| `ZDOCS/03-KIEN-TRUC/USE-CASE-NEN.md` | Đặc tả nghiệp vụ phần nền: đăng nhập, tài khoản, vai trò, cài đặt, đặt lại dữ liệu |
| `ZDOCS/03-KIEN-TRUC/THIET-KE-CSDL-NEN.md` | Quy ước DB, nhóm bảng nền `System_*` |
| `ZDOCS/03-KIEN-TRUC/QUY-UOC-API.md` | Quy ước API, API nền |
| `ZDOCS/04-QUY-CHUAN-CODE/BE-CAU-TRUC-THU-MUC.md` | Thư mục và quy tắc code BE |
| `ZDOCS/04-QUY-CHUAN-CODE/FE-CAU-TRUC-THU-MUC.md` | Thư mục và quy tắc code FE |

## Cấu trúc

```
├── BE/          # .NET 8 Web API, Clean Architecture
├── FE/          # Next.js 16 + shadcn/ui, chạy được bằng dữ liệu mẫu
├── deploy/      # docker-compose, cấu hình triển khai
└── docs/        # Tài liệu riêng của dự án
```
