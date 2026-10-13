# Quản lý Kho

> Dự án demo tạo từ `_template`. Mô tả nghiệp vụ: [docs/01-TONG-QUAN-NGHIEP-VU.md](docs/01-TONG-QUAN-NGHIEP-VU.md).

| Mục | Giá trị |
| :--- | :--- |
| Mã dự án | `retail-quan-ly-kho` |
| FE | `http://localhost:3108` |
| BE (Swagger) | `https://localhost:7108/swagger` |
| Database | `WebDemo_RetailQuanLyKho` (Postgres; SQLite hoặc SQL Server khi cần) |
| Docker | `deploy/docker-compose.yml` (FE 3108, BE 7108, Postgres nội bộ) |
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

Cần .NET SDK 8 trở lên và **PostgreSQL 16** (hoặc dùng SQLite, không cần cài gì; SQL Server chỉ khi khách yêu cầu).

```bash
cd BE
copy src\API\.env.example src\API\.env     # dự án tạo bằng script đã có sẵn .env
dotnet dev-certs https --trust             # lần đầu trên máy, để chạy https://localhost:7108
dotnet run --project src/API --launch-profile API
```

- Chỉ cần sửa `CONNECTION_STRING` trong `src/API/.env`. Mặc định `DB_PROVIDER=Postgres`, `CONNECTION_STRING=Host=localhost;Port=5432;Database=WebDemo_RetailQuanLyKho;Username=postgres;Password=postgres` (user cần quyền tạo DB; BE tự tạo DB và bật extension `unaccent` qua migration).
- Không có Postgres: `DB_PROVIDER=Sqlite`, `CONNECTION_STRING=Data Source=App_Data/retail-quan-ly-kho.db` (file tạo trong `src/API/App_Data`). SQL Server: `DB_PROVIDER=SqlServer`, `CONNECTION_STRING=Server=localhost\SQLEXPRESS;Database=WebDemo_RetailQuanLyKho;Trusted_Connection=True;TrustServerCertificate=True`.
- Swagger: `https://localhost:7108/swagger`. Đăng nhập `admin` / mật khẩu `DEMO_PASSWORD`, bấm Authorize, dán `accessToken`.
- Lúc khởi động, BE tự tạo DB và bảng (Postgres chạy migration; SQLite và SQL Server tạo bảng bằng EnsureCreated, không có migration riêng), đồng bộ quyền, vai trò, tài khoản demo, cài đặt theo `FE/src/mock/seed/*.json`. Khi `DEMO_MODE=true` thì nạp thêm dữ liệu mẫu nghiệp vụ nếu DB chưa có, bật `/api/demo/*` và tự đặt lại dữ liệu theo `DEMO_RESET_CRON`.
- Tìm kiếm không phân biệt hoa thường trên mọi provider; không phân biệt dấu ("nguyen" khớp "Nguyễn") chỉ trên Postgres.
- Chạy test: `dotnet test` (trong thư mục `BE`). Thêm migration (cần `.env` đang `DB_PROVIDER=Postgres`): `dotnet ef migrations add <Ten> --project src/Infrastructure --startup-project src/API`, xem `ZDOCS/04-QUY-CHUAN-CODE/BE-CAU-TRUC-THU-MUC.md` §5.

Sau đó đổi `NEXT_PUBLIC_DATA_SOURCE=api` trong `FE/.env.local` rồi chạy FE như cách 1.

### Cách 3: Docker (Postgres + BE + FE trên một máy)

Cần Docker Engine có Compose v2.

```bash
cd deploy
copy .env.example .env        # sửa POSTGRES_PASSWORD, JWT_KEY, CORS_ORIGINS, NEXT_PUBLIC_API_URL
docker compose --env-file .env up -d --build
```

- FE: `http://localhost:3108`, Swagger: `http://localhost:7108/swagger`, health: `http://localhost:7108/api/health`. Cổng chỉ bind `127.0.0.1`; HTTPS và tên miền do reverse proxy bên ngoài (Dokploy/Caddy) lo.
- `BE/Dockerfile` build với context là **thư mục gốc dự án** (BE nhúng `FE/src/mock/seed/*.json`); `FE/Dockerfile` build với context `FE/`, biến `NEXT_PUBLIC_*` truyền lúc build (đổi là phải `up -d --build` lại).
- Dữ liệu ở volume `pgdata` và `uploads`. Chi tiết và cách khai trên Dokploy: [deploy/README.md](deploy/README.md) và `ZDOCS/09-TRIEN-KHAI/`.

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
├── deploy/      # docker-compose.yml, .env.example, postgres-init (xem deploy/README.md)
└── docs/        # Tài liệu riêng của dự án
```
