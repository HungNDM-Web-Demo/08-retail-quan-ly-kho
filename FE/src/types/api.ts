/**
 * Kiểu dùng chung cho mọi API (QUY-UOC-API §1.2, §4.7).
 * BE trả thẳng DTO hoặc PaginatedResult<T>, không bọc thêm.
 */

export type SortDir = 'asc' | 'desc'

/** Query chung cho mọi API danh sách. Bộ lọc riêng thêm vào bằng kiểu mở rộng. */
export type PaginationQuery = {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortDir?: SortDir
}

export type PaginatedResult<T> = {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

/** Lỗi dạng ProblemDetails (RFC 7807). */
export type ProblemDetails = {
  type?: string
  title: string
  status: number
  detail?: string
  /** Lỗi validate theo trường camelCase */
  errors?: Record<string, string[]>
  /** Trường mở rộng, vd "missing": string[] khi thiếu điều kiện nghiệp vụ */
  [extension: string]: unknown
}

/** Tùy chọn cho ô chọn (Select, bộ lọc). */
export type Option<T extends string = string> = {
  value: T
  label: string
  description?: string
}
