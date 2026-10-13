# Triển khai Quản lý Kho bằng Docker

Hướng dẫn chung (nền tảng, gói Free, Dokploy): `ZDOCS/09-TRIEN-KHAI/`. File này chỉ nói phần riêng của dự án.

| File | Dùng để |
| :--- | :--- |
| `BE/Dockerfile` | Image BE (.NET 8). **Build context là thư mục gốc dự án**, không phải `BE/` (BE nhúng `FE/src/mock/seed/*.json`) |
| `FE/Dockerfile` | Image FE (Next.js standalone). Build context là `FE/`; biến `NEXT_PUBLIC_*` truyền lúc build |
| `deploy/docker-compose.yml` | Chạy trọn bộ Postgres + BE + FE trên một máy (máy dev, VPS tự quản) |
| `deploy/.env.example` | Mẫu biến môi trường cho compose; sao chép thành `deploy/.env` |
| `deploy/postgres-init/` | SQL chạy một lần khi Postgres khởi tạo (extension `unaccent`) |

## 1. Chạy bằng docker compose (máy dev hoặc VPS tự quản)

```bash
cd deploy
cp .env.example .env            # Windows: copy .env.example .env
# sửa .env: POSTGRES_PASSWORD, JWT_KEY, CORS_ORIGINS, NEXT_PUBLIC_API_URL
docker compose --env-file .env up -d --build
docker compose logs -f be       # chờ dòng "Now listening on"
```

- FE: `http://localhost:3108`, BE: `http://localhost:7108/swagger`, health: `http://localhost:7108/api/health`.
- Cổng chỉ bind `127.0.0.1`. Muốn mở ra Internet thì đặt reverse proxy (Caddy, Nginx, Dokploy/Traefik) trỏ vào hai cổng này và lo HTTPS; compose **không** kèm reverse proxy và không mở Postgres ra ngoài.
- Dữ liệu nằm ở volume `pgdata` (Postgres) và `uploads` (file tải lên, mount vào `/app/wwwroot/uploads`). `docker compose down` giữ volume; `down -v` xóa hết.
- Đổi `NEXT_PUBLIC_*` trong `.env` thì phải `up -d --build` lại vì Next nhúng các biến này lúc build. Biến BE đổi xong chỉ cần `up -d`.
- Build image FE lần đầu mất vài phút (cài dependency + `next build`). Lúc build, layout gốc gọi BE lấy cài đặt công khai; chưa có BE thì dùng dữ liệu mẫu, sau khi chạy tự làm mới sau 60 giây.
- Server Next gọi BE qua mạng nội bộ (`API_INTERNAL_URL=http://be:8080`), trình duyệt gọi `NEXT_PUBLIC_API_URL`; vì vậy `CORS_ORIGINS` phải là origin FE mà trình duyệt mở.
- Chỉ muốn FE chạy dữ liệu mẫu: `NEXT_PUBLIC_DATA_SOURCE=mock` rồi `docker compose up -d --build fe` (không cần `be`, `postgres`).

## 2. Dokploy

Dokploy tạo từng service riêng, không dùng compose này (chi tiết: `ZDOCS/09-TRIEN-KHAI/02-HUONG-DAN-GOI-FREE.md` mục 3–5):

| Service | Cấu hình |
| :--- | :--- |
| Postgres | **Database → PostgreSQL** dùng chung, mỗi dự án một database + user riêng, chạy thêm `CREATE EXTENSION IF NOT EXISTS unaccent;` trong DB đó |
| BE | **Application**, Build type Dockerfile, Dockerfile path `BE/Dockerfile`, **Build context `.`** (gốc repo), port `8080`, volume `/app/wwwroot/uploads`, Environment = các biến BE trong `.env.example` với `DB_PROVIDER=Postgres`, `CONNECTION_STRING=Host=postgres;Port=5432;Database=…;Username=…;Password=…`, `BEHIND_PROXY=true` |
| FE | **Application**, Build type Dockerfile, Dockerfile path `FE/Dockerfile`, Build context `FE`, port `3000`; `NEXT_PUBLIC_*` đặt ở **Build-time env** (Build args); Environment lúc chạy: `API_INTERNAL_URL=http://<tên-service-be>:8080`. Hoặc đưa FE lên Vercel/Cloudflare, không cần image |

HTTPS, tên miền, chứng chỉ do Dokploy (Traefik) lo; container chỉ nghe http và tin header `X-Forwarded-*` khi `BEHIND_PROXY=true`.

## 3. Build tay từng image (không compose)

```bash
# BE: chạy ở thư mục gốc dự án
docker build -f BE/Dockerfile -t retail-quan-ly-kho-be .
# FE: context là FE/, biến NEXT_PUBLIC_* truyền bằng --build-arg
docker build -t retail-quan-ly-kho-fe --build-arg NEXT_PUBLIC_API_URL=https://api.example.com FE
```

Image BE chạy user `app` (không phải root), nghe cổng `8080`, `HEALTHCHECK` gọi `GET /api/health` bằng bash `/dev/tcp` (image aspnet không có curl). Image FE chạy user `nextjs`, cổng `3000`, `HEALTHCHECK` bằng `wget` của BusyBox.

Nếu `corepack prepare` lỗi chữ ký (corepack cũ trong image node), thay dòng đó trong `FE/Dockerfile` bằng `npm install -g pnpm@11.9.0`.
