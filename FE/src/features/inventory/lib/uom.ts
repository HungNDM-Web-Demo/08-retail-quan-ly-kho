import type { UnitReading } from '@/types/inventory'

/**
 * Quy đổi đơn vị và cách đọc số lượng (07 §3.1, BR-01). Số lượng luôn là số nguyên theo đơn vị cơ bản.
 */

/** baseQuantity = quantity × factor */
export const toBase = (qty: number, factor: number): number => qty * factor

/** Tên ngắn: bỏ phần số cuối, viết thường ("Thùng 24" → "thùng", "Chai" → "chai") */
export function unitShortName(name: string): string {
  return name.replace(/\s*\d[\d.,]*\s*$/, '').trim().toLowerCase() || name.toLowerCase()
}

/** Đơn vị cơ bản viết thường, dùng trong câu ("480 chai") */
export const baseUnitWord = (baseUnit: string): string => baseUnit.toLowerCase()

/**
 * Cách đọc quy đổi: "23 thùng 16 chai" (568 chai, Thùng 24); 0 → "0 chai".
 * `units` là đơn vị quy đổi (không gồm đơn vị cơ bản), thứ tự bất kỳ.
 */
export function readQuantity(q: number, baseUnit: string, units: readonly UnitReading[] = []): string {
  const base = baseUnitWord(baseUnit)
  if (!q) return `0 ${base}`
  const negative = q < 0
  let rest = Math.abs(q)
  const parts: string[] = []
  for (const unit of [...units].filter((u) => u.factor > 1).sort((a, b) => b.factor - a.factor)) {
    const n = Math.floor(rest / unit.factor)
    if (n > 0) {
      parts.push(`${n} ${unitShortName(unit.name)}`)
      rest -= n * unit.factor
    }
  }
  if (rest > 0) parts.push(`${rest} ${base}`)
  return (negative ? '−' : '') + parts.join(' ')
}

/** Tách số lượng cơ bản thành "thùng + lẻ" theo một hệ số (ô CartonInput, kiểm kê, nhận hàng) */
export function splitCartons(q: number, factor: number): { cartons: number; loose: number } {
  if (factor <= 1) return { cartons: 0, loose: q }
  return { cartons: Math.floor(q / factor), loose: q % factor }
}

/** Đơn vị quy đổi lớn nhất (không có thì null) */
export function largestUnit<T extends { factor: number }>(units: readonly T[]): T | null {
  return units.reduce<T | null>((max, u) => (!max || u.factor > max.factor ? u : max), null)
}

/** Phần trăm 1 chữ số thập phân, dấu phẩy: 25 → "25,0%" (07 §4.6) */
export function formatPercent1(value: number | null | undefined, fallback = '—'): string {
  if (value == null || Number.isNaN(value)) return fallback
  return `${value.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}
