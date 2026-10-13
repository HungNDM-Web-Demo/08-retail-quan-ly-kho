import projectSeed from '@/mock/seed/project.json'

/**
 * Cấu hình ứng dụng (KIEN-TRUC-HE-THONG §6.5).
 * Tên, logo, màu hiển thị lúc chạy lấy từ cài đặt Brand.* (trang Cài đặt chung);
 * giá trị ở đây chỉ là mặc định khi chưa tải được cài đặt.
 */
export const appConfig = {
  /** Tên mặc định, bị thay bằng Brand.AppName sau khi tải cài đặt công khai */
  name: process.env.NEXT_PUBLIC_APP_NAME || 'Quản lý Kho',
  slogan: 'Bản trình diễn giải pháp quản lý cho doanh nghiệp',
  logoUrl: '/logo/logo.svg',

  /** Trang mở sau khi đăng nhập (project.json → homeAfterLogin) */
  homeAfterLogin: (projectSeed as { homeAfterLogin?: string }).homeAfterLogin || '/dashboard',

  apiUrl: (process.env.NEXT_PUBLIC_API_URL || 'https://localhost:7108').trim().replace(/\/+$/, ''),

  /** Thanh công cụ demo nổi góc dưới phải (NEXT_PUBLIC_DEMO_TOOLBAR=true) */
  demoToolbar: process.env.NEXT_PUBLIC_DEMO_TOOLBAR === 'true',
  /** Mật khẩu chung của tài khoản demo ở chế độ mock (trùng DEMO_PASSWORD của BE) */
  demoPassword: process.env.NEXT_PUBLIC_DEMO_PASSWORD || 'Demo@123',

  /** Tiền tố khóa localStorage, sessionStorage, IndexedDB, BroadcastChannel */
  storagePrefix: 'retail-quan-ly-kho',
  /**
   * Phiên bản dữ liệu mẫu. Tăng số này khi đổi cấu trúc seed để trình duyệt
   * của người xem tự xóa dữ liệu cũ và nạp lại (kể cả tài khoản, vai trò, cài đặt).
   */
  mockDataVersion: 1,
} as const
