import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { apiRoutes } from '@/config/api-routes'
import { appConfig } from '@/config/app.config'
import { ApiError } from '@/lib/api-error'
import { expireSession, getAccessToken, getRefreshToken, useAuthStore } from '@/stores/auth.store'
import type { AuthResponse } from '@/features/auth/types/auth.types'
import type { ProblemDetails } from '@/types/api'

/**
 * Gọi BE ở chế độ api (KIEN-TRUC-HE-THONG §7.1):
 * - Gắn `Authorization: Bearer` từ phiên hiện tại.
 * - Gặp 401: tự gia hạn bằng refresh token rồi gửi lại request; các request đến
 *   trong lúc đang gia hạn được xếp hàng chờ token mới.
 * - Mọi lỗi đổi thành ApiError (ProblemDetails) để giao diện xử lý một kiểu.
 */

export const api = axios.create({
  baseURL: appConfig.apiUrl,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean }
type Waiter = { resolve: (token: string) => void; reject: (error: unknown) => void }

let refreshing: Promise<string> | null = null
let waiters: Waiter[] = []

const isAuthEndpoint = (url?: string) =>
  !!url && (url.includes(apiRoutes.auth.login) || url.includes(apiRoutes.auth.refresh))

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw ApiError.fromStatus(401, 'Phiên đăng nhập đã hết hạn.')

  // Gọi bằng axios gốc để không đi qua interceptor (tránh vòng lặp 401)
  const { data } = await axios.post<AuthResponse>(
    `${appConfig.apiUrl}${apiRoutes.auth.refresh}`,
    { refreshToken },
    { timeout: 15_000 }
  )
  if (!data?.accessToken) throw ApiError.fromStatus(401, 'Phiên đăng nhập đã hết hạn.')

  // BE xoay vòng refresh token: token cũ bị thu hồi ngay, bắt buộc lưu token mới
  useAuthStore.getState().updateTokens(data)
  return data.accessToken
}

function getFreshToken(): Promise<string> {
  if (refreshing) {
    return new Promise((resolve, reject) => waiters.push({ resolve, reject }))
  }
  refreshing = refreshAccessToken()
    .then((token) => {
      waiters.forEach((w) => w.resolve(token))
      return token
    })
    .catch((error) => {
      waiters.forEach((w) => w.reject(error))
      expireSession()
      throw error
    })
    .finally(() => {
      waiters = []
      refreshing = null
    })
  return refreshing
}

/** AxiosError → ApiError với ProblemDetails (tự dựng nếu BE không trả đúng dạng). */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof AxiosError) {
    if (!error.response) {
      return ApiError.fromStatus(0, 'Không kết nối được máy chủ.')
    }
    const { status, data } = error.response
    if (data && typeof data === 'object' && 'status' in data && 'title' in data) {
      return new ApiError(data as ProblemDetails)
    }
    const detail =
      typeof data === 'string' && data.length < 300 ? data : (error.message ?? undefined)
    return ApiError.fromStatus(status, detail)
  }
  if (error instanceof Error) return ApiError.fromStatus(0, error.message)
  return ApiError.fromStatus(0, 'Có lỗi không xác định.')
}

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined

    if (
      typeof window !== 'undefined' &&
      error.response?.status === 401 &&
      original &&
      !isAuthEndpoint(original.url)
    ) {
      if (!original._retry && getRefreshToken()) {
        original._retry = true
        try {
          const token = await getFreshToken()
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        } catch (refreshError) {
          return Promise.reject(toApiError(refreshError))
        }
      }
      expireSession()
    }

    return Promise.reject(toApiError(error))
  }
)

/** Gọi API trả thẳng phần thân (BE không bọc dữ liệu). */
export const apiCall = {
  get: async <T>(url: string, config?: AxiosRequestConfig) => (await api.get<T>(url, config)).data,
  post: async <T = void>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    (await api.post<T>(url, body, config)).data,
  put: async <T = void>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    (await api.put<T>(url, body, config)).data,
  patch: async <T = void>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    (await api.patch<T>(url, body, config)).data,
  delete: async <T = void>(url: string, config?: AxiosRequestConfig) =>
    (await api.delete<T>(url, config)).data,
}
