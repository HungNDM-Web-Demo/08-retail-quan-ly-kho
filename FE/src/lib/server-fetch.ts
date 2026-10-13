import { appConfig } from '@/config/app.config'
import { isMockMode } from '@/lib/data-source'

/**
 * Lấy dữ liệu phía máy chủ Next.js cho trang công khai (KIEN-TRUC-HE-THONG §6.3).
 * - Chế độ api: gọi BE `serverApiUrl()` + path, cache `revalidate` giây (mặc định 60).
 *   Chỉ khi NODE_ENV=development và host là localhost mới bỏ qua kiểm tra chứng chỉ
 *   (BE dev dùng chứng chỉ tự ký).
 * - Chế độ mock: trả dữ liệu gốc từ seed qua hàm `mock` (máy chủ không đọc được localStorage).
 * Chỉ dùng cho dữ liệu công khai; dữ liệu nội bộ do trình duyệt tự gọi API kèm token.
 *
 *   const settings = await serverFetch('/api/settings/public', {
 *     mock: seedPublicSettings,
 *     fallback: seedPublicSettings(),
 *   })
 */

type ServerFetchOptions<T> = {
  /** Dữ liệu trả về ở chế độ mock */
  mock: () => T | Promise<T>
  /** Giá trị dùng khi gọi BE lỗi; bỏ trống thì ném lỗi */
  fallback?: T
  /** Số giây cache (ISR); false là không cache */
  revalidate?: number | false
  timeoutMs?: number
}

const isLocalhost = (url: URL) => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname)

/**
 * Địa chỉ BE cho mọi lời gọi phía máy chủ. Trong Docker, server Next gọi BE qua mạng nội bộ
 * (`API_INTERNAL_URL=http://be:8080`, biến chỉ có ở máy chủ, đọc lúc chạy) còn trình duyệt vẫn dùng
 * địa chỉ công khai `NEXT_PUBLIC_API_URL`. Không đặt `API_INTERNAL_URL` thì hai bên dùng chung một địa chỉ.
 */
export function serverApiUrl(): string {
  const internal = process.env.API_INTERNAL_URL?.trim().replace(/\/+$/, '')
  return internal || appConfig.apiUrl
}

/** GET qua node:https, bỏ qua chứng chỉ tự ký (chỉ dùng khi dev + localhost). */
async function fetchInsecureLocal<T>(url: URL, timeoutMs: number): Promise<T> {
  const https = await import('node:https')
  return new Promise<T>((resolve, reject) => {
    const request = https.request(
      url,
      { method: 'GET', rejectUnauthorized: false, headers: { Accept: 'application/json' }, timeout: timeoutMs },
      (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk: string) => (body += chunk))
        response.on('end', () => {
          const status = response.statusCode ?? 0
          if (status < 200 || status >= 300) return reject(new Error(`BE trả mã ${status} cho ${url.pathname}`))
          try {
            resolve(JSON.parse(body) as T)
          } catch (error) {
            reject(error)
          }
        })
      }
    )
    request.on('timeout', () => request.destroy(new Error(`Hết thời gian chờ ${url.pathname}`)))
    request.on('error', reject)
    request.end()
  })
}

export async function serverFetch<T>(path: string, options: ServerFetchOptions<T>): Promise<T> {
  if (isMockMode()) return options.mock()

  const url = new URL(path, `${serverApiUrl()}/`)
  const timeoutMs = options.timeoutMs ?? 5_000
  try {
    if (process.env.NODE_ENV === 'development' && url.protocol === 'https:' && isLocalhost(url)) {
      return await fetchInsecureLocal<T>(url, timeoutMs)
    }
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: options.revalidate ?? 60 },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) throw new Error(`BE trả mã ${response.status} cho ${url.pathname}`)
    return (await response.json()) as T
  } catch (error) {
    if (options.fallback !== undefined) {
      console.warn(`[server-fetch] ${url.href}: ${(error as Error).message}. Dùng dữ liệu dự phòng.`)
      return options.fallback
    }
    throw error
  }
}
