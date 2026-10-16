import { issueTypeLabels, receiptTypeLabels } from '@/config/inventory-labels'
import { permissions } from '@/config/permissions'
import { isAlert, isLate, slowBucket, stockStatus } from '@/features/inventory/lib/stock-rules'
import { addDaysKey, diffDaysKey, vnDateKey, vnRange, vnToday } from '@/features/inventory/lib/vn-time'
import {
  groupById,
  liveGroups,
  liveProducts,
  liveSuppliers,
  liveWarehouses,
  stockLevelsDb,
  warehouseById,
} from '@/features/inventory/mock/catalog.store'
import { inventoryContext, scopedWarehouseFilter, type InventoryContext } from '@/features/inventory/mock/context'
import {
  allIssues,
  allLedger,
  allReceipts,
  allStocktakes,
  allTransfers,
  reservedMap,
} from '@/features/inventory/mock/documents.store'
import type {
  GoodsIssueRecord,
  GoodsReceiptRecord,
  StocktakeRecord,
  TransferRecord,
} from '@/features/inventory/mock/records'
import { assertRange, ledgerOrder } from '@/features/stock/mock/inventory-queries'
import { mockDelay } from '@/lib/data-source'
import type {
  DashboardReport,
  IssueType,
  IssueTypeRow,
  MovementQuery,
  MovementReport,
  MovementRow,
  ReportPeriodQuery,
  SlowMovingQuery,
  SlowMovingRow,
  StaffTodo,
  StocktakeVarianceRow,
  SupplierReceiptRow,
  TodoDoc,
  TransferLossQuery,
  TransferLossRow,
  VarianceReason,
  WarehouseOption,
} from '@/types/inventory'

/**
 * Handler mock Tổng quan, Việc cần làm, báo cáo (07 §2.10, §3.10, §3.11). Đọc phiếu, dòng tồn, thẻ kho của lõi;
 * thống kê theo thời điểm ghi sổ (`approvedAt`, `receivedAt`, BR-11); phạm vi kho theo BR-23.
 */

const round1 = (v: number) => Math.round(v * 10) / 10
const share = (part: number, total: number) => (total > 0 ? round1((part * 100) / total) : 0)
const ISSUE_TYPES: IssueType[] = ['XuatBan', 'TraNhaCungCap', 'DungNoiBo', 'XuatHuy', 'XuatDieuChinh']

/** Kho trong phạm vi (đã lọc theo `warehouseId` nếu hợp lệ) */
function scopeSet(ctx: InventoryContext, warehouseId?: string | null): Set<string> {
  const w = scopedWarehouseFilter(ctx, warehouseId)
  return new Set(w ? [w] : ctx.scopeIds)
}

const inPeriod = (iso: string | undefined, start: string, end: string) => !!iso && iso >= start && iso <= end

// ───────────────────────── Việc cần làm (FR-03)

const receiptText = (r: GoodsReceiptRecord) => `Phiếu nhập · ${receiptTypeLabels[r.type]}`
const issueText = (i: GoodsIssueRecord) => `Phiếu xuất · ${issueTypeLabels[i.type]}`
const code = (id: string) => warehouseById(id)?.code ?? ''
const transferText = (t: TransferRecord) => `Chuyển kho ${code(t.fromWarehouseId)} → ${code(t.toWarehouseId)}`
const stocktakeText = (s: StocktakeRecord) =>
  s.scopeAll
    ? 'Kiểm kê · Toàn kho'
    : `Kiểm kê · ${s.groupIds.map((g) => groupById(g)?.name ?? '').filter(Boolean).join(', ')}`

type AnyDoc =
  | { kind: 'GoodsReceipt'; doc: GoodsReceiptRecord }
  | { kind: 'GoodsIssue'; doc: GoodsIssueRecord }
  | { kind: 'Transfer'; doc: TransferRecord }

function todoDoc(d: AnyDoc): TodoDoc {
  const base = {
    kind: d.kind,
    id: d.doc.id,
    code: d.doc.code,
    createdAt: d.doc.createdAt,
    updatedAt: d.doc.updatedAt ?? d.doc.createdAt,
    lineCount: d.doc.lines.length,
  }
  if (d.kind === 'Transfer') {
    return {
      ...base,
      warehouseCode: code(d.doc.fromWarehouseId),
      toWarehouseCode: code(d.doc.toWarehouseId),
      typeText: transferText(d.doc),
    }
  }
  return {
    ...base,
    warehouseCode: code(d.doc.warehouseId),
    typeText: d.kind === 'GoodsReceipt' ? receiptText(d.doc) : issueText(d.doc),
  }
}

export const reportMock = {
  /** GET /api/reports/dashboard (FR-01, FR-02, §3.11) */
  async getDashboard(): Promise<DashboardReport> {
    await mockDelay()
    const ctx = inventoryContext(permissions.reports.view)
    const scope = new Set(ctx.scopeIds)
    const warehouses = liveWarehouses().filter((w) => w.isActive && scope.has(w.id))
    const active = new Set(warehouses.map((w) => w.id))

    // Giá trị tồn, số cảnh báo (chỉ dòng có ngưỡng, quyết định 27)
    const totals = new Map<string, { value: number; stocked: number }>()
    let belowMinCount = 0
    let outOfStockCount = 0
    let overMaxCount = 0
    const reserved = new Map(warehouses.map((w) => [w.id, reservedMap(w.id)]))
    const live = new Set(liveProducts().map((p) => p.id))
    for (const l of stockLevelsDb.all()) {
      if (!active.has(l.warehouseId)) continue
      const t = totals.get(l.warehouseId) ?? { value: 0, stocked: 0 }
      t.value += l.stockValue
      if (l.onHand > 0) t.stocked += 1
      totals.set(l.warehouseId, t)
      if (!live.has(l.productId)) continue
      const status = stockStatus(l, reserved.get(l.warehouseId)?.get(l.productId) ?? 0)
      if (!isAlert(l, status)) continue
      if (status === 'DuoiToiThieu') belowMinCount += 1
      else if (status === 'HetHang') outOfStockCount += 1
      else if (status === 'VuotToiDa') overMaxCount += 1
    }

    const receipts = allReceipts().filter((r) => scope.has(r.warehouseId))
    const issues = allIssues().filter((i) => scope.has(i.warehouseId))
    const transfers = allTransfers().filter((t) => scope.has(t.fromWarehouseId) || scope.has(t.toWarehouseId))
    const stocktakes = allStocktakes().filter((s) => scope.has(s.warehouseId))
    const pending = {
      goodsReceipts: receipts.filter((r) => r.status === 'ChoDuyet').length,
      goodsIssues: issues.filter((i) => i.status === 'ChoDuyet').length,
      transfers: transfers.filter((t) => t.status === 'ChoDuyet').length,
      stocktakes: stocktakes.filter((s) => s.status === 'ChoDuyet').length,
      total: 0,
    }
    pending.total = pending.goodsReceipts + pending.goodsIssues + pending.transfers + pending.stocktakes

    const now = Date.now()
    const moving = transfers.filter((t) => t.status === 'DangChuyen')
    const inTransit = {
      count: moving.length,
      value: moving.reduce((s, t) => s + (t.totalValue ?? 0), 0),
      lateCount: moving.filter((t) => isLate(t.approvedAt, now)).length,
    }

    // 30 ngày tới hôm nay (giờ Việt Nam): nhập = phiếu nhập; xuất = phiếu xuất trừ Xuất điều chỉnh (quyết định 29)
    const today = vnToday()
    const first = addDaysKey(today, -29)
    const days = Array.from({ length: 30 }, (_, i) => addDaysKey(first, i))
    const daily = new Map(days.map((d) => [d, { date: d, inValue: 0, outValue: 0 }]))
    for (const r of receipts) {
      if (r.status !== 'DaDuyet' || !r.approvedAt) continue
      const d = daily.get(vnDateKey(r.approvedAt))
      if (d) d.inValue += r.totalValue
    }
    const top = new Map<string, { quantity: number; value: number }>()
    for (const i of issues) {
      if (i.status !== 'DaDuyet' || !i.approvedAt || i.type === 'XuatDieuChinh') continue
      const d = daily.get(vnDateKey(i.approvedAt))
      if (!d) continue
      d.outValue += i.totalValue ?? 0
      for (const l of i.lines) {
        const t = top.get(l.productId) ?? { quantity: 0, value: 0 }
        t.quantity += l.baseQuantity
        t.value += l.value ?? 0
        top.set(l.productId, t)
      }
    }
    const products = new Map(liveProducts().map((p) => [p.id, p]))
    const topIssued = [...top.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 10)
      .map(([productId, t]) => {
        const p = products.get(productId)
        return { productId, code: p?.code ?? '', name: p?.name ?? '', baseUnit: p?.baseUnit ?? '', quantity: t.quantity, value: t.value }
      })

    const rows = warehouses.map((w) => ({
      warehouseId: w.id,
      code: w.code,
      name: w.name,
      stockValue: totals.get(w.id)?.value ?? 0,
      stockedProductCount: totals.get(w.id)?.stocked ?? 0,
    }))
    return {
      asOf: new Date().toISOString(),
      warehouses: rows,
      totalStockValue: rows.reduce((s, w) => s + w.stockValue, 0),
      belowMinCount,
      outOfStockCount,
      overMaxCount,
      pending,
      inTransit,
      daily: [...daily.values()],
      topIssued,
    }
  },

  /** GET /api/reports/staff-todo (FR-03): việc của người gọi tại kho trong phạm vi, không có số tiền */
  async getStaffTodo(): Promise<StaffTodo> {
    await mockDelay()
    const ctx = inventoryContext(permissions.dashboard.view)
    const scope = new Set(ctx.scopeIds)
    const me = ctx.userId
    const mine: AnyDoc[] = [
      ...allReceipts()
        .filter((r) => r.createdById === me && scope.has(r.warehouseId))
        .map((doc) => ({ kind: 'GoodsReceipt' as const, doc })),
      ...allIssues()
        .filter((i) => i.createdById === me && scope.has(i.warehouseId))
        .map((doc) => ({ kind: 'GoodsIssue' as const, doc })),
      ...allTransfers()
        .filter((t) => t.createdById === me && (scope.has(t.fromWarehouseId) || scope.has(t.toWarehouseId)))
        .map((doc) => ({ kind: 'Transfer' as const, doc })),
    ]
    const byUpdated = (a: TodoDoc, b: TodoDoc) => b.updatedAt.localeCompare(a.updatedAt)
    const now = Date.now()
    const warehouses: WarehouseOption[] = liveWarehouses()
      .filter((w) => scope.has(w.id))
      .map((w) => ({ id: w.id, code: w.code, name: w.name, isActive: w.isActive }))

    return {
      warehouses,
      drafts: mine.filter((d) => d.doc.status === 'Nhap').map(todoDoc).sort(byUpdated),
      rejected: mine
        .filter((d) => d.doc.status === 'TuChoi')
        .map((d) => ({
          ...todoDoc(d),
          rejectReason: d.doc.rejectReason ?? '',
          rejectedByName: d.doc.rejectedByName ?? '',
          rejectedAt: d.doc.rejectedAt ?? d.doc.updatedAt,
        }))
        .sort((a, b) => b.rejectedAt.localeCompare(a.rejectedAt)),
      waiting: mine
        .filter((d) => d.doc.status === 'ChoDuyet')
        .map(todoDoc)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      toReceive: allTransfers()
        .filter((t) => t.status === 'DangChuyen' && scope.has(t.toWarehouseId))
        .map((t) => ({
          ...todoDoc({ kind: 'Transfer', doc: t }),
          // 07 §5 #44: hàng chờ nhận ghi kho đến ở warehouseCode, như BE
          warehouseCode: code(t.toWarehouseId),
          fromWarehouseCode: code(t.fromWarehouseId),
          approvedAt: t.approvedAt ?? t.updatedAt,
          isLate: isLate(t.approvedAt, now),
        }))
        .sort((a, b) => a.approvedAt.localeCompare(b.approvedAt)),
      counting: allStocktakes()
        .filter((s) => s.status === 'DangKiem' && scope.has(s.warehouseId))
        .map((s) => ({
          kind: 'Stocktake' as const,
          id: s.id,
          code: s.code,
          warehouseCode: code(s.warehouseId),
          typeText: stocktakeText(s),
          createdAt: s.createdAt,
          updatedAt: s.updatedAt ?? s.createdAt,
          lineCount: s.lines.length,
          counterName: s.counterName,
          countedLines: s.lines.filter((l) => l.countedQuantity != null).length,
          totalLines: s.lines.length,
        })),
    }
  },

  /** GET /api/reports/inventory-movement (FR-32, BR-21, §3.10) */
  async getMovement(query: MovementQuery): Promise<MovementReport> {
    await mockDelay()
    const ctx = inventoryContext(permissions.reports.view)
    const { from, to } = assertRange(query.from, query.to)
    const [start, end] = vnRange(from, to) as [string, string]
    const warehouseId = scopedWarehouseFilter(ctx, query.warehouseId)
    const scope = scopeSet(ctx, warehouseId)
    const products = new Map(
      liveProducts()
        .filter((p) => !query.groupId || p.groupId === query.groupId)
        .map((p) => [p.id, p])
    )
    // Sản phẩm đã xóa vẫn có thẻ kho: bỏ qua (chỉ xóa được khi chưa có chứng từ)
    const ledger = allLedger()
      .filter((l) => scope.has(l.warehouseId) && products.has(l.productId) && l.postedAt <= end)
      .sort(ledgerOrder)

    const lastBefore = new Map<string, { q: number; v: number }>() // key kho|hàng
    const rows = new Map<string, MovementRow>()
    const rowOf = (productId: string) => {
      let r = rows.get(productId)
      if (!r) {
        const p = products.get(productId)!
        const g = groupById(p.groupId)
        r = {
          productId,
          productCode: p.code,
          productName: p.name,
          groupId: p.groupId,
          groupName: g?.name ?? '',
          baseUnit: p.baseUnit,
          openingQty: 0,
          openingValue: 0,
          inQty: 0,
          inValue: 0,
          outQty: 0,
          outValue: 0,
          closingQty: 0,
          closingValue: 0,
        }
        rows.set(productId, r)
      }
      return r
    }
    for (const l of ledger) {
      if (l.postedAt < start) {
        lastBefore.set(`${l.warehouseId}|${l.productId}`, { q: l.balanceQuantity, v: l.balanceValue })
        continue
      }
      const r = rowOf(l.productId)
      r.inQty += l.inQuantity
      r.inValue += l.inValue
      r.outQty += l.outQuantity
      r.outValue += l.outValue
    }
    for (const [key, b] of lastBefore) {
      const r = rowOf(key.split('|')[1])
      r.openingQty += b.q
      r.openingValue += b.v
    }
    const groupOrder = new Map(liveGroups().map((g, i) => [g.id, i]))
    const list = [...rows.values()]
      .map((r) => ({
        ...r,
        closingQty: r.openingQty + r.inQty - r.outQty,
        closingValue: r.openingValue + r.inValue - r.outValue,
      }))
      .filter((r) => r.openingQty || r.inQty || r.outQty || r.closingQty || r.openingValue || r.closingValue)
      .sort(
        (a, b) =>
          (groupOrder.get(a.groupId) ?? 99) - (groupOrder.get(b.groupId) ?? 99) || a.productCode.localeCompare(b.productCode)
      )
    const totals = list.reduce(
      (s, r) => ({
        openingQty: s.openingQty + r.openingQty,
        openingValue: s.openingValue + r.openingValue,
        inQty: s.inQty + r.inQty,
        inValue: s.inValue + r.inValue,
        outQty: s.outQty + r.outQty,
        outValue: s.outValue + r.outValue,
        closingQty: s.closingQty + r.closingQty,
        closingValue: s.closingValue + r.closingValue,
      }),
      { openingQty: 0, openingValue: 0, inQty: 0, inValue: 0, outQty: 0, outValue: 0, closingQty: 0, closingValue: 0 }
    )

    // Hàng đang chuyển cuối kỳ: chỉ khi "Tất cả kho" (quyết định 30)
    let inTransit: MovementReport['inTransit']
    if (!warehouseId) {
      const byProduct = new Map<string, { quantity: number; value: number }>()
      for (const t of allTransfers()) {
        if (!t.approvedAt || t.approvedAt > end) continue
        if (t.receivedAt && t.receivedAt <= end) continue
        if (t.status !== 'DangChuyen' && t.status !== 'DaNhan') continue
        if (!scope.has(t.fromWarehouseId) && !scope.has(t.toWarehouseId)) continue
        for (const l of t.lines) {
          if (!products.has(l.productId)) continue
          const x = byProduct.get(l.productId) ?? { quantity: 0, value: 0 }
          x.quantity += l.baseQuantity
          x.value += l.value ?? 0
          byProduct.set(l.productId, x)
        }
      }
      if (byProduct.size) {
        const lines = [...byProduct.entries()]
          .map(([productId, x]) => {
            const p = products.get(productId)!
            return { productId, productCode: p.code, productName: p.name, baseUnit: p.baseUnit, ...x }
          })
          .sort((a, b) => a.productCode.localeCompare(b.productCode))
        inTransit = { totalValue: lines.reduce((s, l) => s + l.value, 0), lines }
      }
    }
    return { from, to, warehouseId, rows: list, totals, inTransit }
  },

  /** GET /api/reports/slow-moving (FR-34, BR-22, quyết định 26) */
  async getSlowMoving(query: SlowMovingQuery): Promise<SlowMovingRow[]> {
    await mockDelay()
    const ctx = inventoryContext(permissions.reports.view)
    const scope = scopeSet(ctx, query.warehouseId)
    const today = vnToday()
    const products = new Map(liveProducts().map((p) => [p.id, p]))
    const rows: SlowMovingRow[] = []
    for (const l of stockLevelsDb.all()) {
      if (!scope.has(l.warehouseId) || l.onHand <= 0) continue
      const p = products.get(l.productId)
      if (!p || (query.groupId && p.groupId !== query.groupId)) continue
      const mark = l.lastIssueAt ?? l.firstReceiptAt
      if (!mark) continue
      const daysSince = diffDaysKey(vnDateKey(mark), today)
      const bucket = slowBucket(daysSince)
      if (!bucket) continue
      rows.push({
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        groupName: groupById(p.groupId)?.name ?? '',
        baseUnit: p.baseUnit,
        warehouseId: l.warehouseId,
        warehouseCode: code(l.warehouseId),
        onHand: l.onHand,
        stockValue: ctx.canViewValues ? l.stockValue : undefined,
        lastIssueAt: l.lastIssueAt ?? undefined,
        firstReceiptAt: l.firstReceiptAt ?? undefined,
        daysSince,
        bucket,
      })
    }
    return rows.sort((a, b) => (b.stockValue ?? 0) - (a.stockValue ?? 0) || b.daysSince - a.daysSince)
  },

  /** GET /api/reports/receipts-by-supplier: phiếu Mua hàng đã duyệt trong kỳ */
  async getReceiptsBySupplier(query: ReportPeriodQuery): Promise<SupplierReceiptRow[]> {
    await mockDelay()
    const ctx = inventoryContext(permissions.reports.view)
    const { from, to } = assertRange(query.from, query.to)
    const [start, end] = vnRange(from, to) as [string, string]
    const scope = scopeSet(ctx, query.warehouseId)
    const suppliers = new Map(liveSuppliers().map((s) => [s.id, s]))
    const map = new Map<string, Omit<SupplierReceiptRow, 'sharePercent'>>()
    for (const r of allReceipts()) {
      if (r.status !== 'DaDuyet' || r.type !== 'MuaHang' || !r.supplierId) continue
      if (!scope.has(r.warehouseId) || !inPeriod(r.approvedAt, start, end)) continue
      const s = suppliers.get(r.supplierId)
      const row = map.get(r.supplierId) ?? {
        supplierId: r.supplierId,
        supplierCode: s?.code ?? '',
        supplierName: s?.name ?? '',
        receiptCount: 0,
        totalAmount: 0,
        freightCost: 0,
        totalValue: 0,
      }
      row.receiptCount += 1
      row.totalAmount += r.totalAmount
      row.freightCost += r.freightCost
      row.totalValue += r.totalValue
      map.set(r.supplierId, row)
    }
    const total = [...map.values()].reduce((s, r) => s + r.totalValue, 0)
    return [...map.values()]
      .map((r) => ({ ...r, sharePercent: share(r.totalValue, total) }))
      .sort((a, b) => b.totalValue - a.totalValue)
  },

  /** GET /api/reports/issues-by-type: đủ 5 loại, kể cả 0 */
  async getIssuesByType(query: ReportPeriodQuery): Promise<IssueTypeRow[]> {
    await mockDelay()
    const ctx = inventoryContext(permissions.reports.view)
    const { from, to } = assertRange(query.from, query.to)
    const [start, end] = vnRange(from, to) as [string, string]
    const scope = scopeSet(ctx, query.warehouseId)
    const map = new Map(ISSUE_TYPES.map((t) => [t, { type: t, docCount: 0, baseQuantity: 0, value: 0 }]))
    for (const i of allIssues()) {
      if (i.status !== 'DaDuyet' || !scope.has(i.warehouseId) || !inPeriod(i.approvedAt, start, end)) continue
      const row = map.get(i.type)!
      row.docCount += 1
      row.baseQuantity += i.lines.reduce((s, l) => s + l.baseQuantity, 0)
      row.value += i.totalValue ?? 0
    }
    const total = [...map.values()].reduce((s, r) => s + r.value, 0)
    return [...map.values()].map((r) => ({ ...r, sharePercent: share(r.value, total) }))
  },

  /** GET /api/reports/stocktake-variances: phiếu Đã cân bằng có approvedAt trong kỳ */
  async getStocktakeVariances(query: ReportPeriodQuery): Promise<StocktakeVarianceRow[]> {
    await mockDelay()
    const ctx = inventoryContext(permissions.reports.view)
    const { from, to } = assertRange(query.from, query.to)
    const [start, end] = vnRange(from, to) as [string, string]
    const scope = scopeSet(ctx, query.warehouseId)
    return allStocktakes()
      .filter((s) => s.status === 'DaCanBang' && scope.has(s.warehouseId) && inPeriod(s.approvedAt, start, end))
      .sort((a, b) => (b.approvedAt ?? '').localeCompare(a.approvedAt ?? ''))
      .map((s) => {
        const variance = s.lines.filter((l) => (l.difference ?? 0) !== 0)
        const surplusValue = variance.reduce((sum, l) => sum + Math.max(l.differenceValue ?? 0, 0), 0)
        const shortageValue = variance.reduce((sum, l) => sum + Math.max(-(l.differenceValue ?? 0), 0), 0)
        const reasons = new Map<string, { reason?: VarianceReason; lineCount: number; value: number }>()
        for (const l of variance) {
          const key = l.reason ?? ''
          const r = reasons.get(key) ?? { reason: l.reason ?? undefined, lineCount: 0, value: 0 }
          r.lineCount += 1
          r.value += l.differenceValue ?? 0
          reasons.set(key, r)
        }
        return {
          stocktakeId: s.id,
          code: s.code,
          warehouseCode: code(s.warehouseId),
          approvedAt: s.approvedAt!,
          lineCount: s.lines.length,
          varianceLineCount: variance.length,
          surplusValue,
          shortageValue,
          netValue: surplusValue - shortageValue,
          byReason: [...reasons.values()].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
        }
      })
  },

  /** GET /api/reports/transfer-losses: phiếu Đã nhận có receivedAt trong kỳ, gom theo tuyến */
  async getTransferLosses(query: TransferLossQuery): Promise<TransferLossRow[]> {
    await mockDelay()
    const ctx = inventoryContext(permissions.reports.view)
    const { from, to } = assertRange(query.from, query.to)
    const [start, end] = vnRange(from, to) as [string, string]
    const fromId = scopedWarehouseFilter(ctx, query.fromWarehouseId)
    const toId = scopedWarehouseFilter(ctx, query.toWarehouseId)
    const scope = new Set(ctx.scopeIds)
    const routes = new Map<string, TransferLossRow>()
    for (const t of allTransfers()) {
      if (t.status !== 'DaNhan' || !inPeriod(t.receivedAt, start, end)) continue
      if (!scope.has(t.fromWarehouseId) && !scope.has(t.toWarehouseId)) continue
      if ((fromId && t.fromWarehouseId !== fromId) || (toId && t.toWarehouseId !== toId)) continue
      const key = `${t.fromWarehouseId}|${t.toWarehouseId}`
      const row = routes.get(key) ?? {
        fromWarehouseCode: code(t.fromWarehouseId),
        toWarehouseCode: code(t.toWarehouseId),
        transferCount: 0,
        shortageLineCount: 0,
        shortageValue: 0,
        transfers: [],
      }
      const short = t.lines.filter((l) => (l.shortageQuantity ?? 0) > 0)
      row.transferCount += 1
      row.shortageLineCount += short.length
      const value = t.shortageValue ?? short.reduce((s, l) => s + (l.shortageValue ?? 0), 0)
      row.shortageValue += value
      if (short.length) {
        row.transfers.push({
          id: t.id,
          code: t.code ?? '',
          receivedAt: t.receivedAt!,
          shortageQuantity: short.reduce((s, l) => s + (l.shortageQuantity ?? 0), 0),
          shortageValue: value,
        })
      }
      routes.set(key, row)
    }
    return [...routes.values()]
      .map((r) => ({ ...r, transfers: r.transfers.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)) }))
      .sort((a, b) => b.shortageValue - a.shortageValue || a.fromWarehouseCode.localeCompare(b.fromWarehouseCode))
  },
}
