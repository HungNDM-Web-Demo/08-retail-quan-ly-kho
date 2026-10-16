import type { DocKind } from '@/types/inventory'

/**
 * Mã chứng từ (07 §3.12, SRS §5.3, BR-02): `PN`, `PX`, `PC` + yyMMdd + 3 số; `KK` + yyMMdd + 2 số.
 * Ngày là ngày gửi duyệt lần đầu (kiểm kê: ngày tạo) theo giờ Việt Nam.
 */
export const docPrefixes = {
  GoodsReceipt: 'PN',
  GoodsIssue: 'PX',
  Transfer: 'PC',
  Stocktake: 'KK',
} as const satisfies Record<DocKind, string>

export type DocPrefix = (typeof docPrefixes)[DocKind]

const digitsOf = (prefix: string) => (prefix === 'KK' ? 2 : 3)

/**
 * Mã kế tiếp: số lớn nhất đã cấp cùng tiền tố, cùng ngày + 1.
 * @param dateKey ngày "yyyy-MM-dd" (giờ Việt Nam)
 * @param existingCodes mọi mã đã có (cả kho lịch sử trong bộ nhớ và mock-db)
 */
export function nextDocCode(prefix: string, dateKey: string, existingCodes: Iterable<string | null | undefined>): string {
  const head = `${prefix}${dateKey.slice(2).replace(/-/g, '')}`
  const digits = digitsOf(prefix)
  let max = 0
  for (const code of existingCodes) {
    if (!code || code.length !== head.length + digits || !code.startsWith(head)) continue
    const n = Number(code.slice(head.length))
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${head}${String(max + 1).padStart(digits, '0')}`
}

/** Mã thứ n (từ 1) của tiền tố trong ngày, dùng khi nạp seed theo thứ tự */
export function docCodeAt(prefix: string, dateKey: string, n: number): string {
  return `${prefix}${dateKey.slice(2).replace(/-/g, '')}${String(n).padStart(digitsOf(prefix), '0')}`
}
