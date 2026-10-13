import { appConfig } from '@/config/app.config'

/**
 * Đọc/ghi localStorage, sessionStorage an toàn: không lỗi khi chạy phía máy chủ,
 * khi trình duyệt chặn bộ nhớ (chế độ riêng tư) hoặc khi dữ liệu hỏng.
 * Mọi khóa đều có tiền tố mã dự án, vd "retail-quan-ly-kho:db".
 */

export const storageKey = (name: string) => `${appConfig.storagePrefix}:${name}`

type Kind = 'local' | 'session'

function getStore(kind: Kind): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function readJson<T>(kind: Kind, key: string): T | null {
  const store = getStore(kind)
  if (!store) return null
  try {
    const raw = store.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** Trả về false khi ghi thất bại (thường do vượt dung lượng khoảng 5 MB). */
export function writeJson(kind: Kind, key: string, value: unknown): boolean {
  const store = getStore(kind)
  if (!store) return false
  try {
    store.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.error(`[storage] Không ghi được khóa ${key}:`, error)
    return false
  }
}

export function removeKey(kind: Kind, key: string): void {
  const store = getStore(kind)
  if (!store) return
  try {
    store.removeItem(key)
  } catch {
    // bỏ qua
  }
}
