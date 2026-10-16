import type { SlowMovingBucket, StockStatus } from '@/types/inventory'
import { roundVnd } from './costing'
import { inventoryRules } from './rules'
import { DAY_MS } from './vn-time'

/**
 * Trạng thái tồn, cảnh báo, đề xuất nhập (07 §3.9, BR-18, BR-19), chênh lệch kiểm kê (§3.7, BR-16),
 * chậm luân chuyển (§3.11, BR-22), "Trễ" của phiếu chuyển (BR-13).
 */

export type LevelThresholds = { onHand: number; minQty?: number | null; maxQty?: number | null }

/** onHand 0 → Hết hàng; khả dụng ≤ min → Dưới tối thiểu; onHand > max → Vượt tối đa; còn lại Bình thường */
export function stockStatus(level: LevelThresholds, reserved = 0): StockStatus {
  const available = level.onHand - reserved
  if (level.onHand === 0) return 'HetHang'
  if (level.minQty != null && available <= level.minQty) return 'DuoiToiThieu'
  if (level.maxQty != null && level.onHand > level.maxQty) return 'VuotToiDa'
  return 'BinhThuong'
}

/** Dòng có được tính là cảnh báo không ("để trống ngưỡng thì không cảnh báo", quyết định 27) */
export function isAlert(level: Pick<LevelThresholds, 'minQty' | 'maxQty'>, status: StockStatus): boolean {
  switch (status) {
    case 'HetHang':
      return level.minQty != null || level.maxQty != null
    case 'DuoiToiThieu':
      return level.minQty != null
    case 'VuotToiDa':
      return level.maxQty != null
    default:
      return false
  }
}

/**
 * Đề xuất nhập (BR-19): F = hệ số đơn vị lớn nhất (không có thì 1); raw = max − khả dụng;
 * suggested = floor(raw ÷ F) × F; ≤ 0 thì F. Không có tồn tối đa → null. TC-25: 720, 90, 24 → 624.
 */
export function suggestQuantity(
  level: Pick<LevelThresholds, 'maxQty'>,
  available: number,
  units: readonly { factor: number }[] = []
): number | null {
  if (level.maxQty == null) return null
  const f = units.reduce((max, u) => Math.max(max, u.factor), 1)
  const suggested = Math.floor((level.maxQty - available) / f) * f
  return suggested <= 0 ? f : suggested
}

/** BR-16: bắt buộc nguyên nhân khi |giá trị chênh| ≥ 1.000.000, hoặc |chênh| × 100 ≥ 5 × sổ sách, hoặc sổ 0 mà đếm > 0 */
export function reasonRequired(difference: number, differenceValue: number, book: number, counted: number): boolean {
  if (Math.abs(differenceValue) >= inventoryRules.varianceValueThreshold) return true
  if (book > 0 && Math.abs(difference) * 100 >= inventoryRules.variancePercentThreshold * book) return true
  return book === 0 && counted > 0
}

export type Variance = {
  difference: number
  differenceValue: number
  /** 1 chữ số thập phân; sổ sách 0 → null */
  differencePercent: number | null
  reasonRequired: boolean
}

/**
 * Chênh lệch một dòng kiểm kê (§3.7). `stockValue` là giá trị tồn hiện tại của dòng tồn (dùng khi đếm 0 mà sổ > 0).
 * Chưa đếm (`countedQuantity` null) → null.
 */
export function varianceOf(
  line: { bookQuantity: number; bookCost: number; countedQuantity?: number | null },
  stockValue: number
): Variance | null {
  if (line.countedQuantity == null) return null
  const book = line.bookQuantity
  const counted = line.countedQuantity
  const difference = counted - book
  const differenceValue = counted === 0 && book > 0 ? -stockValue : difference * line.bookCost
  const differencePercent = book > 0 ? roundVnd(Math.abs(difference) * 1000, book) / 10 : null
  return {
    difference,
    differenceValue,
    differencePercent,
    reasonRequired: reasonRequired(difference, differenceValue, book, counted),
  }
}

/** Nhóm chậm luân chuyển theo số ngày (BR-22): < 30 → null */
export function slowBucket(days: number): SlowMovingBucket | null {
  if (days >= 90) return 'Tu90'
  if (days >= 60) return 'Tu60'
  if (days >= 30) return 'Tu30'
  return null
}

/** Phiếu đang chuyển quá 3 ngày kể từ lúc duyệt (BR-13) */
export function isLate(approvedAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!approvedAt) return false
  return now - new Date(approvedAt).getTime() > inventoryRules.lateTransferDays * DAY_MS
}
