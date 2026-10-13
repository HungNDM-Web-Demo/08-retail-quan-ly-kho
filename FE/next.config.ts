import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // NEXT_OUTPUT=standalone: build gọn để chạy trong Docker (FE/Dockerfile). Không đặt thì giữ mặc định cho Vercel/Cloudflare.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  images: {
    qualities: [100, 75],
  },
  // Ẩn nút "N" của Next.js khi chạy dev để màn hình demo gọn gàng
  devIndicators: false,
}

export default nextConfig
