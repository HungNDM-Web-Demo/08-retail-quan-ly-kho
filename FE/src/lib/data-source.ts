/**
 * Chọn nguồn dữ liệu (KIEN-TRUC-HE-THONG §6.2).
 * Chỉ service (features/*\/services) được gọi isMockMode(). Page, hook, component thì không.
 */

export type DataSource = 'mock' | 'api'

/** Mặc định là mock để bản demo chạy được ngay cả khi thiếu .env.local. */
export const DATA_SOURCE: DataSource = process.env.NEXT_PUBLIC_DATA_SOURCE === 'api' ? 'api' : 'mock'

export const isMockMode = (): boolean => DATA_SOURCE === 'mock'

/** Độ trễ giả 200–400 ms để thấy trạng thái đang tải như khi gọi API thật. */
export function mockDelay(min = 200, max = 400): Promise<void> {
  const ms = Math.round(min + Math.random() * Math.max(0, max - min))
  return new Promise((resolve) => setTimeout(resolve, ms))
}
