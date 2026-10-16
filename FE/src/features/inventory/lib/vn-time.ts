/**
 * Giờ Việt Nam (UTC+7, không đổi giờ mùa hè) cho ngày lịch, mã chứng từ, bộ lọc ngày, kỳ báo cáo, "Trễ" của phiếu
 * chuyển, số ngày chậm luân chuyển (06 §3; BE `VietnamTime`). Không phụ thuộc múi giờ của máy.
 * Chép từ demo Menu QR (`features/pos/lib/vn-time.ts`), thêm `vnRange`.
 */

const OFFSET_MS = 7 * 60 * 60_000
export const DAY_MS = 86_400_000

type DateInput = Date | number | string

export type VnParts = { year: number; month: number; day: number; hour: number; minute: number; isoWeekday: number }

/** Thời điểm hiện tại (ms). Một chỗ để mock và giao diện dùng chung. */
export const vnNow = (): number => Date.now()

/** Tách ngày giờ Việt Nam của một thời điểm */
export function vnParts(date: DateInput): VnParts {
  const d = new Date(new Date(date).getTime() + OFFSET_MS)
  const weekday = d.getUTCDay() // 0 = CN
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    isoWeekday: weekday === 0 ? 7 : weekday,
  }
}

/** Khóa ngày "yyyy-MM-dd" theo giờ Việt Nam */
export function vnDateKey(date: DateInput): string {
  const p = vnParts(date)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Hôm nay "yyyy-MM-dd" theo giờ Việt Nam */
export const vnToday = (): string => vnDateKey(vnNow())

/** "yyMMdd" theo giờ Việt Nam (mã PN, PX, PC, KK) */
export function vnYyMMdd(date: DateInput): string {
  return vnDateKey(date).slice(2).replace(/-/g, '')
}

/** Thời điểm UTC (ms) của 00:00 ngày "yyyy-MM-dd" giờ Việt Nam */
export function vnStartOfDay(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return Date.UTC(y, m - 1, d) - OFFSET_MS
}

/** Thời điểm (ms) của "HH:mm" giờ Việt Nam ngày dateKey */
export function vnAt(dateKey: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return vnStartOfDay(dateKey) + (h * 60 + m) * 60_000
}

/** Cộng n ngày vào khóa ngày */
export function addDaysKey(dateKey: string, days: number): string {
  return vnDateKey(vnStartOfDay(dateKey) + days * DAY_MS + 12 * 3600_000)
}

/** Số ngày giữa hai khóa ngày (to − from) */
export function diffDaysKey(from: string, to: string): number {
  return Math.round((vnStartOfDay(to) - vnStartOfDay(from)) / DAY_MS)
}

/** "HH:mm" giờ Việt Nam */
export function vnHhmm(date: DateInput): string {
  const p = vnParts(date)
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

/** "HH:mm dd/MM/yyyy" giờ Việt Nam (câu lỗi `PhieuDaDuyet`, 07 §2.12) */
export function vnHhmmDate(date: DateInput): string {
  const p = vnParts(date)
  return `${vnHhmm(date)} ${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year}`
}

/** "dd/MM/yyyy" giờ Việt Nam */
export function vnDdMmYyyy(date: DateInput): string {
  const p = vnParts(date)
  return `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year}`
}

/** Phút trong ngày (giờ Việt Nam), 0–1439 */
export function vnMinutesOfDay(date: DateInput): number {
  const p = vnParts(date)
  return p.hour * 60 + p.minute
}

/**
 * Khoảng ngày `from`, `to` ("yyyy-MM-dd", giờ Việt Nam) → [ISO 00:00 của `from`, ISO 23:59:59.999 của `to`]
 * (07 §2 "Quy ước chung"). Thiếu một đầu thì đầu đó là null.
 */
export function vnRange(from?: string | null, to?: string | null): [string | null, string | null] {
  return [
    from ? new Date(vnStartOfDay(from)).toISOString() : null,
    to ? new Date(vnStartOfDay(addDaysKey(to, 1)) - 1).toISOString() : null,
  ]
}

/** Thời điểm `iso` có nằm trong khoảng ngày [from, to] (giờ Việt Nam) không; không có khoảng thì luôn đúng */
export function inVnRange(iso: string | null | undefined, from?: string | null, to?: string | null): boolean {
  if (!from && !to) return true
  if (!iso) return false
  const key = vnDateKey(iso)
  if (from && key < from) return false
  if (to && key > to) return false
  return true
}
