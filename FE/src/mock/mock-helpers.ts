import { matchesSearch, normalizeVi } from '@/lib/normalize'
import type { PaginatedResult, PaginationQuery, SortDir } from '@/types/api'

/** Tiện ích cho handler mock: id, ngày tương đối, tìm kiếm, sắp xếp, phân trang. */

// ───────────────────────── Id ─────────────────────────

/** Guid ngẫu nhiên (giống Guid.NewGuid() của BE). */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function fnv1a(text: string, seed: number): number {
  let hash = seed >>> 0
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** Băm ngắn không mã hóa (dùng để không lưu mật khẩu dạng chữ trong mock). */
export function mockHash(text: string): string {
  return [0x811c9dc5, 0x01234567, 0x89abcdef, 0x13579bdf]
    .map((seed) => fnv1a(text, seed).toString(16).padStart(8, '0'))
    .join('')
}

/**
 * Guid cố định theo khóa, vd stableId('role', 'ADMIN'). Dùng trong seed để các bản ghi
 * tham chiếu nhau ổn định qua mỗi lần nạp lại (đơn hàng trỏ tới khách hàng…).
 */
export function stableId(...parts: (string | number)[]): string {
  const h = mockHash(parts.join(':'))
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

// ───────────────────────── Ngày tương đối ─────────────────────────

type TimeOfDay = string | { hour: number; minute?: number }

function applyTime(date: Date, time?: TimeOfDay) {
  if (time === undefined) return date
  const [hour, minute] =
    typeof time === 'string' ? time.split(':').map(Number) : [time.hour, time.minute ?? 0]
  date.setHours(hour || 0, minute || 0, 0, 0)
  return date
}

/** ISO UTC của thời điểm n ngày trước (giờ tùy chọn "HH:mm" theo giờ máy). */
export function daysAgo(n: number, time?: TimeOfDay): string {
  const date = new Date()
  date.setDate(date.getDate() - n)
  return applyTime(date, time).toISOString()
}

/** ISO UTC lệch n ngày so với hôm nay (n âm là quá khứ, dương là tương lai). */
export function dayOffset(n: number, time?: TimeOfDay): string {
  return daysAgo(-n, time)
}

/** ISO UTC của thời điểm n phút trước. */
export function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString()
}

const RELATIVE_DATE = /^(daysAgo|dayOffset):(-?\d+)(?:@(\d{1,2}:\d{2}))?$/

/**
 * Đổi ngày tương đối trong seed JSON sang ISO, đệ quy toàn bộ object.
 * Cú pháp chuỗi (BE seed dùng cùng quy ước):
 *   "daysAgo:3"         → 3 ngày trước, giữ giờ hiện tại
 *   "daysAgo:3@14:30"   → 3 ngày trước lúc 14:30
 *   "dayOffset:2@09:00" → 2 ngày tới lúc 09:00 (số âm là quá khứ)
 */
export function resolveRelativeDates<T>(data: T): T {
  if (typeof data === 'string') {
    const match = RELATIVE_DATE.exec(data)
    if (!match) return data
    const [, kind, amount, time] = match
    const n = Number(amount)
    return (kind === 'daysAgo' ? daysAgo(n, time) : dayOffset(n, time)) as T
  }
  if (Array.isArray(data)) return data.map((item) => resolveRelativeDates(item)) as T
  if (data && typeof data === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) result[key] = resolveRelativeDates(value)
    return result as T
  }
  return data
}

// ───────────────────────── Tìm kiếm, sắp xếp, phân trang ─────────────────────────

type Field<T> = keyof T | ((item: T) => unknown)

const readField = <T>(item: T, field: Field<T>) =>
  typeof field === 'function' ? field(item) : item[field]

/** Lọc theo từ khóa trên nhiều trường, không phân biệt dấu (normalizeVi). */
export function search<T>(items: T[], keyword: string | undefined | null, fields: Field<T>[]): T[] {
  if (!normalizeVi(keyword)) return items
  return items.filter((item) =>
    matchesSearch(fields.map((field) => readField(item, field) ?? '').join(' '), keyword)
  )
}

const collator = new Intl.Collator('vi', { sensitivity: 'base', numeric: true })

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined || a === '') return 1
  if (b === null || b === undefined || b === '') return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return collator.compare(String(a), String(b))
}

/** Sắp xếp theo tên trường camelCase (giá trị rỗng luôn nằm cuối). */
export function sortItems<T>(items: T[], sortBy?: string, sortDir: SortDir = 'desc'): T[] {
  if (!sortBy) return items
  const dir = sortDir === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    const va = (a as Record<string, unknown>)[sortBy]
    const vb = (b as Record<string, unknown>)[sortBy]
    if (va === null || va === undefined || va === '') return 1
    if (vb === null || vb === undefined || vb === '') return -1
    return compareValues(va, vb) * dir
  })
}

/** Cắt trang, trả đúng dạng PaginatedResult của BE (pageSize tối đa 100). */
export function paginate<T>(items: T[], query: Pick<PaginationQuery, 'page' | 'pageSize'> = {}): PaginatedResult<T> {
  const pageSize = Math.min(Math.max(Number(query.pageSize) || 10, 1), 100)
  const totalCount = items.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const page = Math.min(Math.max(Number(query.page) || 1, 1), totalPages)
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    totalCount,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  }
}

/**
 * Gói đủ bước cho API danh sách: tìm kiếm → sắp xếp (mặc định createdAt desc) → phân trang.
 * Lọc riêng (trạng thái, ngày…) làm trước khi gọi hàm này.
 */
export function listQuery<T>(
  items: T[],
  query: PaginationQuery,
  options: { searchFields: Field<T>[]; defaultSortBy?: string; defaultSortDir?: SortDir }
): PaginatedResult<T> {
  const found = search(items, query.search, options.searchFields)
  const sorted = sortItems(
    found,
    query.sortBy || options.defaultSortBy || 'createdAt',
    query.sortDir || options.defaultSortDir || 'desc'
  )
  return paginate(sorted, query)
}

/** Ngày "yyyy-MM-dd" có nằm trong khoảng [from, to] (tính theo ngày giờ máy) không. */
export function inDateRange(iso: string | null | undefined, from?: string, to?: string): boolean {
  if (!from && !to) return true
  if (!iso) return false
  const time = new Date(iso).getTime()
  if (from && time < new Date(`${from}T00:00:00`).getTime()) return false
  if (to && time > new Date(`${to}T23:59:59.999`).getTime()) return false
  return true
}

/** Mã tiếp theo dạng tiền tố + số, vd nextCode(orders, 'code', 'DH', 6) → "DH000124". */
export function nextCode<T>(items: T[], field: keyof T, prefix: string, pad = 6): string {
  const max = items.reduce((acc, item) => {
    const value = String(item[field] ?? '')
    if (!value.startsWith(prefix)) return acc
    const n = Number(value.slice(prefix.length))
    return Number.isFinite(n) && n > acc ? n : acc
  }, 0)
  return `${prefix}${String(max + 1).padStart(pad, '0')}`
}

/** Chuỗi rỗng/khoảng trắng → null (giống BE lưu NULL). */
export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
