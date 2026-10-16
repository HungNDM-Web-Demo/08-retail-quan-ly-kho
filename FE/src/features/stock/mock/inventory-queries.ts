import { permissions } from '@/config/permissions'
import {
  liveWarehouses,
  warehouseScope,
} from '@/features/inventory/mock/catalog.store'
import {
  allIssues,
  allLedger,
  allReceipts,
  allStocktakes,
  allTransfers,
  reservedMap,
} from '@/features/inventory/mock/documents.store'
import type { LedgerRecord, WarehouseRecord } from '@/features/inventory/mock/records'
import { fieldErrors } from '@/features/inventory/mock/errors'
import { inventoryRules } from '@/features/inventory/lib/rules'
import { diffDaysKey } from '@/features/inventory/lib/vn-time'
import type { InventoryErrorCode } from '@/features/inventory/lib/problem'
import { ApiError } from '@/lib/api-error'
import type { MockSessionContext } from '@/mock/mock-auth'
import { usersDb } from '@/mock/system-data'
import type { UserRef } from '@/types/inventory'

/**
 * Truy vấn dùng chung cho handler mock của FE-Danh mục & Báo cáo (hàng hóa, kho, nhà cung cấp, tồn, báo cáo).
 * Chỉ đọc store lõi `features/inventory/mock` (07 §4.9), không khai báo collection.
 */

/** BR-25: xem giá vốn, giá trị */
export const canViewValues = (ctx: MockSessionContext) =>
  ctx.isSuperAdmin || ctx.permissions.includes(permissions.stockValues.view)

/** Kho trong phạm vi người gọi (BR-23), theo `sortOrder` */
export function scopedWarehouses(ctx: MockSessionContext): WarehouseRecord[] {
  const ids = new Set(warehouseScope(ctx))
  return liveWarehouses().filter((w) => ids.has(w.id))
}

/**
 * `warehouseId` ngoài phạm vi bị bỏ qua như không lọc (07 §1 "Phạm vi kho", UC-08 E1, TC-06).
 * Trả id kho hợp lệ hoặc undefined.
 */
export function scopedWarehouseId(ctx: MockSessionContext, warehouseId?: string | null): string | undefined {
  if (!warehouseId) return undefined
  return warehouseScope(ctx).includes(warehouseId) ? warehouseId : undefined
}

export const userRef = (userId: string): UserRef | null => {
  const u = usersDb.get(userId)
  return u && !u.isDeleted ? { id: u.id, username: u.username, fullName: u.fullName } : null
}

/** Dấu vết sử dụng của danh mục trong chứng từ, thẻ kho (BR-24: đã có chứng từ thì không xóa) */
export type CatalogUsage = {
  warehouseIds: Set<string>
  supplierIds: Set<string>
  productIds: Set<string>
  unitIds: Set<string>
}

export function catalogUsage(): CatalogUsage {
  const usage: CatalogUsage = {
    warehouseIds: new Set(),
    supplierIds: new Set(),
    productIds: new Set(),
    unitIds: new Set(),
  }
  const lines = (list: { productId: string; unitId?: string | null }[]) => {
    for (const l of list) {
      usage.productIds.add(l.productId)
      if (l.unitId) usage.unitIds.add(l.unitId)
    }
  }
  for (const r of allReceipts()) {
    usage.warehouseIds.add(r.warehouseId)
    if (r.supplierId) usage.supplierIds.add(r.supplierId)
    lines(r.lines)
  }
  for (const i of allIssues()) {
    usage.warehouseIds.add(i.warehouseId)
    if (i.supplierId) usage.supplierIds.add(i.supplierId)
    lines(i.lines)
  }
  for (const t of allTransfers()) {
    usage.warehouseIds.add(t.fromWarehouseId)
    usage.warehouseIds.add(t.toWarehouseId)
    lines(t.lines)
  }
  for (const s of allStocktakes()) {
    usage.warehouseIds.add(s.warehouseId)
    for (const l of s.lines) usage.productIds.add(l.productId)
  }
  for (const l of allLedger()) {
    usage.warehouseIds.add(l.warehouseId)
    usage.productIds.add(l.productId)
  }
  return usage
}

/**
 * Số phiếu chưa kết thúc liên quan kho (06 §4 `Inventory_Warehouses`): nhập, xuất `Nhap`/`ChoDuyet`/`TuChoi`;
 * chuyển (kho đi hoặc đến) `Nhap`/`ChoDuyet`/`TuChoi`/`DangChuyen`; kiểm kê `DangKiem`/`ChoDuyet`.
 */
export function openDocumentCounts(): Map<string, number> {
  const map = new Map<string, number>()
  const add = (id: string) => map.set(id, (map.get(id) ?? 0) + 1)
  const open = (s: string) => s === 'Nhap' || s === 'ChoDuyet' || s === 'TuChoi'
  for (const r of allReceipts()) if (open(r.status)) add(r.warehouseId)
  for (const i of allIssues()) if (open(i.status)) add(i.warehouseId)
  for (const t of allTransfers()) {
    if (open(t.status) || t.status === 'DangChuyen') {
      add(t.fromWarehouseId)
      if (t.toWarehouseId !== t.fromWarehouseId) add(t.toWarehouseId)
    }
  }
  for (const s of allStocktakes()) if (s.status === 'DangKiem' || s.status === 'ChoDuyet') add(s.warehouseId)
  return map
}

/** Số chờ xuất theo kho → mặt hàng (BR-03) */
export function reservedByWarehouse(warehouseIds: string[]): Map<string, Map<string, number>> {
  return new Map(warehouseIds.map((id) => [id, reservedMap(id)]))
}

/** 400 nghiệp vụ có `code` (07 §2.12) */
export function domainError(code: InventoryErrorCode, detail: string, extra: Record<string, unknown> = {}): ApiError {
  return ApiError.fromStatus(400, detail, { code, ...extra })
}

/** 409 có `code` và lỗi theo trường */
export function conflictError(
  detail: string,
  errors: Record<string, string>,
  code?: InventoryErrorCode
): ApiError {
  return ApiError.fromStatus(409, detail, {
    ...(code ? { code } : {}),
    errors: Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, [v]])),
  })
}

/** 403 KhongPhuTrachKho (BR-23) */
export const outOfScopeError = (warehouseCode: string): ApiError =>
  ApiError.fromStatus(403, `Bạn không phụ trách kho ${warehouseCode}`, { code: 'KhongPhuTrachKho' })

/**
 * Khoảng ngày của thẻ kho, báo cáo (07 §2 "Quy ước chung", §2.10): thiếu → "Chọn khoảng ngày";
 * `to` < `from` → errors.to; dài hơn 366 ngày → errors.from.
 */
export function assertRange(from?: string | null, to?: string | null): { from: string; to: string } {
  if (!from || !to || !DATE_KEY.test(from) || !DATE_KEY.test(to)) throw fieldErrors({ from: 'Chọn khoảng ngày' })
  if (to < from) throw fieldErrors({ to: 'Ngày kết thúc phải sau ngày bắt đầu' })
  if (diffDaysKey(from, to) + 1 > inventoryRules.maxRangeDays) throw fieldErrors({ from: 'Khoảng ngày tối đa 366 ngày' })
  return { from, to }
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

/** Thẻ kho xếp (postedAt, docCode, seq) (07 §3.10) */
export const ledgerOrder = (a: LedgerRecord, b: LedgerRecord) =>
  a.postedAt.localeCompare(b.postedAt) || a.docCode.localeCompare(b.docCode) || a.seq - b.seq
