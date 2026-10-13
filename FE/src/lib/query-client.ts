import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/lib/api-error'

/** Không thử lại với lỗi 4xx (sai dữ liệu, thiếu quyền…), chỉ thử lại 1 lần với lỗi mạng/5xx. */
function shouldRetry(failureCount: number, error: unknown) {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false
  return failureCount < 1
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
        // Mất mạng thì báo lỗi ngay, không treo request rồi tự gửi lại khi có mạng
        networkMode: 'always',
      },
    },
  })
}

/**
 * Query công khai (không phụ thuộc người đăng nhập) có khóa bắt đầu bằng 'public',
 * vd ['public', 'settings']. Khi đổi người dùng/vai trò chỉ làm mới các query còn lại.
 */
export const PUBLIC_QUERY_ROOT = 'public'

export function resetPrivateQueries(client: QueryClient) {
  return client.resetQueries({ predicate: (query) => query.queryKey[0] !== PUBLIC_QUERY_ROOT })
}

let browserQueryClient: QueryClient | undefined

/** Một QueryClient cho trình duyệt; phía máy chủ luôn tạo mới để không lẫn dữ liệu giữa các request. */
export function getQueryClient() {
  if (typeof window === 'undefined') return createQueryClient()
  if (!browserQueryClient) browserQueryClient = createQueryClient()
  return browserQueryClient
}
