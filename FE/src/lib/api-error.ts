import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import type { ProblemDetails } from '@/types/api'

const TITLES: Record<number, string> = {
  0: 'Network Error',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
}

/**
 * Lỗi thống nhất cho cả hai chế độ dữ liệu.
 * - Chế độ api: lib/axios.ts đổi AxiosError thành ApiError.
 * - Chế độ mock: src/mock/mock-errors.ts ném ApiError.
 * Nhờ vậy giao diện chỉ xử lý một kiểu lỗi.
 */
export class ApiError extends Error {
  readonly status: number
  readonly problem: ProblemDetails

  constructor(problem: ProblemDetails) {
    super(problem.detail || problem.title)
    this.name = 'ApiError'
    this.status = problem.status
    this.problem = problem
  }

  static fromStatus(status: number, detail?: string, extra?: Partial<ProblemDetails>): ApiError {
    return new ApiError({
      type: `https://httpstatuses.io/${status}`,
      title: TITLES[status] ?? 'Error',
      status,
      detail,
      ...extra,
    })
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError

const lowerFirst = (key: string) => key.charAt(0).toLowerCase() + key.slice(1)

/**
 * Chuẩn hóa key lỗi của BE sang đường dẫn trường của React Hook Form:
 * "Accounts[1].Username" → "accounts.1.username", "faqs[0].question" → "faqs.0.question".
 */
export const normalizeFieldKey = (key: string) =>
  key
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .map(lowerFirst)
    .join('.')

/** Lỗi theo trường (key camelCase, mảng dạng `items.0.name`) → thông báo đầu tiên của mỗi trường. */
export function getFieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error) || !error.problem.errors) return {}
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(error.problem.errors)) {
    const message = Array.isArray(value) ? value[0] : (value as unknown as string)
    if (message) result[normalizeFieldKey(key)] = message
  }
  return result
}

/** Thông báo lỗi tiếng Việt dễ hiểu để hiện toast. */
export function getErrorMessage(error: unknown, fallback = 'Có lỗi xảy ra, vui lòng thử lại.'): string {
  if (isApiError(error)) {
    if (error.status === 0) {
      return 'Không kết nối được máy chủ. Kiểm tra mạng hoặc BE rồi thử lại.'
    }
    if (error.status >= 500) return 'Hệ thống đang gặp sự cố, vui lòng thử lại sau.'
    const firstField = Object.values(getFieldErrors(error))[0]
    return error.problem.detail || firstField || fallback
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** Danh sách điều kiện còn thiếu (ProblemDetails mở rộng "missing"). */
export function getMissing(error: unknown): string[] {
  if (!isApiError(error)) return []
  const missing = error.problem.missing
  return Array.isArray(missing) ? missing.map(String) : []
}

/**
 * Gắn lỗi theo trường từ API vào form React Hook Form.
 * Trả về true nếu đã gắn được ít nhất một lỗi (khi đó không cần hiện toast).
 */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: unknown,
  fields?: readonly Path<T>[]
): boolean {
  const fieldErrors = getFieldErrors(error)
  let applied = false
  for (const [key, message] of Object.entries(fieldErrors)) {
    if (fields && !fields.includes(key as Path<T>)) continue
    setError(key as Path<T>, { type: 'server', message }, { shouldFocus: !applied })
    applied = true
  }
  return applied
}
