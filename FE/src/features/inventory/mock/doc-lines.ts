import { newId } from '@/mock/mock-helpers'
import type { DocLineInput } from '@/types/inventory'
import { inventoryRules } from '../lib/rules'
import { productById, stockLevel, warehouseById } from './catalog.store'
import { activeStocktakeLock, reservedMap } from './documents.store'
import { inventoryErrors } from './errors'

/**
 * Dòng phiếu nhập, xuất, chuyển: kiểm, chụp tên hàng/đơn vị (SRS §5.1), kiểm tồn khả dụng (BR-04), tồn thực khi
 * duyệt (UC-05 E2), khóa kiểm kê (BR-14).
 */

export type ResolvedLine = {
  id: string
  lineNo: number
  productId: string
  productCode: string
  productName: string
  baseUnit: string
  unitId?: string
  unitName: string
  factor: number
  quantity: number
  baseQuantity: number
}

export type FieldErrorMap = Record<string, string>

/** Kiểm và chụp dòng; lỗi ghi vào `errors` theo key `lines[i].…` (07 §2.4) */
export function resolveLines(
  input: readonly DocLineInput[] | undefined,
  errors: FieldErrorMap,
  options: { requireAtLeastOne: boolean }
): ResolvedLine[] {
  const lines = input ?? []
  if (lines.length > inventoryRules.maxLines) errors.lines = 'Phiếu tối đa 200 dòng, hãy tách phiếu'
  else if (options.requireAtLeastOne && lines.length === 0) errors.lines = 'Phiếu phải có ít nhất 1 dòng'
  const result: ResolvedLine[] = []
  lines.forEach((line, i) => {
    const product = productById(line.productId)
    if (!product || product.isDeleted) {
      errors[`lines[${i}].productId`] = 'Mặt hàng không tồn tại'
      return
    }
    if (!product.isActive) errors[`lines[${i}].productId`] = `${product.name} đã ngừng sử dụng`
    const unit = line.unitId ? product.units.find((u) => u.id === line.unitId) : null
    if (line.unitId && !unit) errors[`lines[${i}].unitId`] = 'Đơn vị không thuộc mặt hàng'
    const quantity = Number(line.quantity)
    if (!Number.isInteger(quantity) || quantity <= 0)
      errors[`lines[${i}].quantity`] = 'Số lượng phải là số nguyên lớn hơn 0'
    const factor = unit?.factor ?? 1
    result.push({
      id: newId(),
      lineNo: i + 1,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      baseUnit: product.baseUnit,
      unitId: unit?.id,
      unitName: unit?.name ?? product.baseUnit,
      factor,
      quantity,
      baseQuantity: quantity * factor,
    })
  })
  return result
}

/**
 * Gửi duyệt phiếu xuất, chuyển (BR-04, §3.6): Σ baseQuantity theo mặt hàng ≤ khả dụng (phiếu đang gửi chưa giữ
 * chỗ nên không tự trừ). Vượt → `VuotTonKhaDung`, gắn vào mọi dòng của mặt hàng đó.
 */
export function assertAvailable(warehouseId: string, lines: readonly ResolvedLine[], docId: string) {
  const reserved = reservedMap(warehouseId, docId)
  const need = new Map<string, number>()
  for (const l of lines) need.set(l.productId, (need.get(l.productId) ?? 0) + l.baseQuantity)
  const over: Parameters<typeof inventoryErrors.vuotTonKhaDung>[0] = []
  lines.forEach((l, index) => {
    const onHand = stockLevel(warehouseId, l.productId)?.onHand ?? 0
    const available = onHand - (reserved.get(l.productId) ?? 0)
    const requested = need.get(l.productId) ?? 0
    if (requested > available) {
      over.push({ index, productId: l.productId, requested, available, excess: requested - available, baseUnit: l.baseUnit })
    }
  })
  if (over.length) throw inventoryErrors.vuotTonKhaDung(over)
}

/** Duyệt phiếu xuất, chuyển: Σ theo mặt hàng ≤ tồn thực (UC-05 E2) */
export function assertOnHand(warehouseId: string, lines: readonly ResolvedLine[]) {
  const need = new Map<string, { qty: number; line: ResolvedLine }>()
  for (const l of lines) {
    const cur = need.get(l.productId)
    need.set(l.productId, { qty: (cur?.qty ?? 0) + l.baseQuantity, line: cur?.line ?? l })
  }
  const shortages = [...need.values()]
    .map(({ qty, line }) => {
      const onHand = stockLevel(warehouseId, line.productId)?.onHand ?? 0
      return {
        productId: line.productId,
        productName: line.productName,
        required: qty,
        onHand,
        missing: qty - onHand,
        baseUnit: line.baseUnit,
      }
    })
    .filter((s) => s.missing > 0)
  if (shortages.length) throw inventoryErrors.khongDuTonThuc(shortages)
}

/** Khóa kiểm kê (BR-14): mặt hàng đầu tiên đang bị khóa → `DangKiemKe` */
export function assertNotLocked(warehouseId: string, lines: readonly { productId: string; productName: string }[]) {
  for (const l of lines) {
    const st = activeStocktakeLock(warehouseId, l.productId)
    if (st) {
      const locked = lines.filter((x) => activeStocktakeLock(warehouseId, x.productId)?.id === st.id)
      throw inventoryErrors.dangKiemKe(
        l.productName,
        warehouseById(warehouseId)?.code ?? '',
        st.id,
        st.code,
        [...new Set(locked.map((x) => x.productId))]
      )
    }
  }
}

/** Kho trong phạm vi, đang hoạt động (07 §2.4 bảng kiểm) */
export function checkWarehouse(
  warehouseId: string | undefined,
  key: string,
  errors: FieldErrorMap,
  assertScope: (id: string) => void
) {
  if (!warehouseId) {
    errors[key] = 'Chọn kho'
    return
  }
  const wh = warehouseById(warehouseId)
  if (!wh || wh.isDeleted) {
    errors[key] = 'Chọn kho'
    return
  }
  assertScope(warehouseId)
  if (!wh.isActive) errors[key] = `Kho ${wh.code} đã ngừng hoạt động`
}
