import { appConfig } from '@/config/app.config'

/**
 * Đường dẫn ảnh từ dữ liệu → URL hiển thị được (QUY-UOC-API §1):
 * - `/uploads/...`        → ghép với NEXT_PUBLIC_API_URL (file BE lưu)
 * - `/logo/...`, `/seed/...`, `/images/...` → giữ nguyên (FE phục vụ trong public/)
 * - `http(s)://`, `data:`, `blob:` → giữ nguyên
 * - `idb://{id}`          → ảnh tải lên ở chế độ mock nằm trong IndexedDB: hàm này trả chuỗi rỗng,
 *                           trong component dùng hook `useAssetUrl` (hooks/use-asset-url.ts).
 * File thuần (không dùng React) nên gọi được cả trong server component.
 */

export const IDB_PREFIX = 'idb://'

export const isIdbUrl = (path: unknown): boolean =>
  typeof path === 'string' && path.startsWith(IDB_PREFIX)

export function assetUrl(path: string | null | undefined): string {
  if (!path || isIdbUrl(path)) return ''
  if (path.startsWith('/uploads/')) return `${appConfig.apiUrl}${path}`
  return path
}
