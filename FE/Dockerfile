# syntax=docker/dockerfile:1
#
# Image FE (Next.js standalone) của Quản lý Kho. Build context là thư mục FE/.
#
#   docker build -t retail-quan-ly-kho-fe --build-arg NEXT_PUBLIC_API_URL=https://api.example.com FE
#   Dokploy: Build type = Dockerfile, Dockerfile path = FE/Dockerfile, Build context = FE, Build-time env = các NEXT_PUBLIC_*
#
# Biến NEXT_PUBLIC_* được Next nhúng vào bundle LÚC BUILD nên phải truyền bằng --build-arg (hoặc build.args trong compose);
# đổi giá trị là phải build lại image. Biến chỉ phía máy chủ (API_INTERNAL_URL, PORT) đặt lúc chạy.

ARG NODE_IMAGE=node:22-alpine

# ---------- Giai đoạn 0: node + pnpm ----------
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION=11.9.0
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
# libc6-compat: gói native (sharp) trên Alpine. pnpm qua corepack, ghim phiên bản (pnpm-workspace.yaml dùng cú pháp pnpm 11).
RUN apk add --no-cache libc6-compat \
    && corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# ---------- Giai đoạn 1: cài dependency ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
    && pnpm install --frozen-lockfile

# ---------- Giai đoạn 2: build ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Biến công khai, nhúng lúc build (tên như FE/.env.example). NEXT_PUBLIC_SITE_URL chỉ một số dự án dùng, mặc định rỗng.
ARG NEXT_PUBLIC_APP_NAME="Quản lý Kho"
ARG NEXT_PUBLIC_DATA_SOURCE=api
ARG NEXT_PUBLIC_API_URL=http://localhost:7108
ARG NEXT_PUBLIC_DEMO_TOOLBAR=true
ARG NEXT_PUBLIC_DEMO_PASSWORD=Demo@123
ARG NEXT_PUBLIC_SITE_URL=
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME} \
    NEXT_PUBLIC_DATA_SOURCE=${NEXT_PUBLIC_DATA_SOURCE} \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_DEMO_TOOLBAR=${NEXT_PUBLIC_DEMO_TOOLBAR} \
    NEXT_PUBLIC_DEMO_PASSWORD=${NEXT_PUBLIC_DEMO_PASSWORD} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_OUTPUT=standalone \
    NODE_ENV=production

# Lúc build, trang render sẵn có thể gọi BE (vd metadata ở layout gốc); không có BE thì dùng dữ liệu dự phòng,
# sau khi chạy sẽ tự làm mới theo revalidate.
RUN pnpm build

# ---------- Giai đoạn 3: image chạy ----------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs \
    && adduser -S -u 1001 -G nodejs nextjs

# Bản standalone chỉ gồm server.js + node_modules cần thiết; static và public phải chép thêm đúng chỗ.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Image alpine có wget (BusyBox): kiểm tra trang chủ trả HTTP (2xx/3xx đều coi là sống).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
