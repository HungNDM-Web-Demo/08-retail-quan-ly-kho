# syntax=docker/dockerfile:1
#
# Image BE (.NET 8 Web API) của Quản lý Kho.
#
# BUILD CONTEXT PHẢI LÀ THƯ MỤC GỐC DỰ ÁN (nơi có BE/ và FE/), không phải BE/:
# Infrastructure.csproj nhúng dữ liệu mẫu từ ../../../FE/src/mock/seed/*.json.
#
#   docker build -f BE/Dockerfile -t retail-quan-ly-kho-be .
#   Dokploy: Build type = Dockerfile, Dockerfile path = BE/Dockerfile, Build context = .
#
# Cấu hình bằng biến môi trường (tên như BE/src/API/.env.example): DB_PROVIDER, CONNECTION_STRING, JWT_*,
# CORS_ORIGINS, DEMO_*. File .env không được đưa vào image (.dockerignore); không có file thì API chỉ đọc
# biến môi trường.

# ---------- Giai đoạn 1: build + publish ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1 \
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1

# Chép file project trước để layer `dotnet restore` được cache khi chỉ đổi code.
COPY BE/Directory.Build.props BE/Directory.Packages.props BE/
COPY BE/src/Domain/Domain.csproj BE/src/Domain/
COPY BE/src/Application/Application.csproj BE/src/Application/
COPY BE/src/Infrastructure/Infrastructure.csproj BE/src/Infrastructure/
COPY BE/src/API/API.csproj BE/src/API/
RUN dotnet restore BE/src/API/API.csproj

# Mã nguồn BE và đúng thư mục seed mà Infrastructure.csproj nhúng.
COPY BE/ BE/
COPY FE/src/mock/seed/ FE/src/mock/seed/
# Thiếu seed thì build vẫn qua nhưng API không seed được lúc chạy: chặn ngay tại đây.
RUN test -n "$(ls FE/src/mock/seed/*.json 2>/dev/null)" || (echo "Thiếu FE/src/mock/seed/*.json: build context phải là thư mục gốc dự án" && exit 1)

RUN dotnet publish BE/src/API/API.csproj -c Release -o /app/publish --no-restore

# ---------- Giai đoạn 2: image chạy ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Container chỉ nghe http; HTTPS do reverse proxy bên ngoài (Dokploy/Traefik, Caddy) lo.
# BEHIND_PROXY=true: tin X-Forwarded-For/Proto từ proxy (xem API/Configuration/ForwardedHeadersSetup.cs);
# đặt false nếu mở cổng 8080 thẳng ra Internet.
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    BEHIND_PROXY=true \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1

COPY --from=build /app/publish ./

# Thư mục file tải lên (mount volume vào đây). Tạo sẵn và giao cho user `app` (có sẵn trong image aspnet:8.0)
# để API tạo được thư mục con năm/tháng khi chạy không phải root.
RUN mkdir -p /app/wwwroot/uploads && chown -R app:app /app/wwwroot
USER app

EXPOSE 8080

# Image aspnet không có curl/wget; dùng bash /dev/tcp gọi GET /api/health và kiểm tra dòng trạng thái "200".
# Compose và Docker dùng HEALTHCHECK này cho depends_on/condition: service_healthy.
# Muốn tắt (để Dokploy/UptimeRobot kiểm tra ngoài): docker run --no-healthcheck hoặc healthcheck.disable trong compose.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080 && printf "GET /api/health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n" >&3 && head -n 1 <&3 | grep -q " 200 "' || exit 1

ENTRYPOINT ["dotnet", "API.dll"]
