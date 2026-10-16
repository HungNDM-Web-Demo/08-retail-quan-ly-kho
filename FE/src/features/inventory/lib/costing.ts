/**
 * Giá vốn, giá trị (07 §3.2–3.5, §3.7; BE `StockMath.cs`). Mọi số tiền là số nguyên đồng; phép chia làm tròn
 * tới 1 ₫, từ 0,5 làm tròn lên, viết bằng số nguyên để tránh sai số dấu phẩy động.
 * Dùng chung cho giao diện (tính trước khi gửi) và handler mock (ghi sổ).
 */

/** round(a ÷ b) = floor((2a + b) ÷ (2b)) với a ≥ 0, b > 0; a âm thì làm tròn đối xứng */
export function roundVnd(a: number, b: number): number {
  if (b <= 0) return 0
  if (a < 0) return -roundVnd(-a, b)
  return Math.floor((2 * a + b) / (2 * b))
}

/**
 * Phân bổ chi phí mua hàng (BR-08): theo thành tiền; dòng cuối nhận phần còn lại; tổng thành tiền 0 thì theo số
 * lượng quy đổi.
 */
export function allocateFreight(amounts: readonly number[], baseQtys: readonly number[], freight: number): number[] {
  if (!freight || amounts.length === 0) return amounts.map(() => 0)
  const useQty = amounts.reduce((s, a) => s + a, 0) === 0
  const weights = useQty ? baseQtys : amounts
  const total = weights.reduce((s, a) => s + a, 0)
  if (total <= 0) return amounts.map((_, i) => (i === amounts.length - 1 ? freight : 0))
  let used = 0
  return weights.map((w, i) => {
    if (i === weights.length - 1) return freight - used
    const a = roundVnd(freight * w, total)
    used += a
    return a
  })
}

export type ReceiptLineInput = { quantity: number; unitPrice: number; factor: number }
export type ReceiptLineTotals = {
  baseQuantity: number
  amount: number
  allocatedCost: number
  value: number
  /** "Đơn giá nhập kho" = round(value ÷ quantity), chỉ hiển thị */
  landedUnitPrice: number
}

/** Thành tiền, chi phí phân bổ, giá trị nhập kho từng dòng và tổng phiếu nhập (§3.2) */
export function receiptLineTotals(
  lines: readonly ReceiptLineInput[],
  freight: number
): { lines: ReceiptLineTotals[]; totalAmount: number; totalValue: number } {
  const amounts = lines.map((l) => (l.quantity || 0) * (l.unitPrice || 0))
  const baseQtys = lines.map((l) => (l.quantity || 0) * (l.factor || 1))
  const allocated = allocateFreight(amounts, baseQtys, freight || 0)
  const result = lines.map((l, i) => {
    const value = amounts[i] + allocated[i]
    return {
      baseQuantity: baseQtys[i],
      amount: amounts[i],
      allocatedCost: allocated[i],
      value,
      landedUnitPrice: l.quantity > 0 ? roundVnd(value, l.quantity) : 0,
    }
  })
  const totalAmount = amounts.reduce((s, a) => s + a, 0)
  return { lines: result, totalAmount, totalValue: totalAmount + (lines.length ? freight || 0 : 0) }
}

/** Phần giá trị của dòng tồn mà các hàm ghi sổ đọc, sửa */
export type LevelValues = { onHand: number; stockValue: number; avgCost: number }

/**
 * Nhập (BR-09): C ← round((V + v) ÷ (Q + q)); V ← V + v; Q ← Q + q. Sửa trực tiếp `level`.
 * Trả số cho dòng thẻ kho: đơn giá nhập = round(v ÷ q).
 */
export function applyIn(level: LevelValues, q: number, v: number): { unitCost: number; avgCostAfter: number } {
  level.avgCost = roundVnd(level.stockValue + v, level.onHand + q)
  level.stockValue += v
  level.onHand += q
  return { unitCost: roundVnd(v, q), avgCostAfter: level.avgCost }
}

/**
 * Xuất (BR-10): out = (q == Q) ? V : q × C; V ← V − out; Q ← Q − q; C giữ nguyên. Sửa trực tiếp `level`.
 * Không kiểm âm (người gọi đã kiểm cả phiếu trước khi ghi).
 */
export function applyOut(level: LevelValues, q: number): { unitCost: number; value: number } {
  const value = q === level.onHand ? level.stockValue : q * level.avgCost
  const unitCost = level.avgCost
  level.stockValue -= value
  level.onHand -= q
  return { unitCost, value }
}

/**
 * Điều chỉnh kiểm kê (BR-17): thừa cộng diff × giá sổ sách; thiếu trừ −diff × giá sổ sách, về 0 thì trừ đúng giá
 * trị còn lại; giá vốn giữ nguyên. Sửa trực tiếp `level`, trả giá trị tuyệt đối đã cộng/trừ.
 */
export function applyAdjust(level: LevelValues, diff: number, bookCost: number): number {
  if (diff === 0) return 0
  if (diff > 0) {
    const value = diff * bookCost
    level.onHand += diff
    level.stockValue += value
    return value
  }
  const value = level.onHand + diff === 0 ? level.stockValue : -diff * bookCost
  level.onHand += diff
  level.stockValue -= value
  return value
}
