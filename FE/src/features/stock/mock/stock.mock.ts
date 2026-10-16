import { permissions } from '@/config/permissions'
import { isAlert, stockStatus, suggestQuantity } from '@/features/inventory/lib/stock-rules'
import { readQuantity } from '@/features/inventory/lib/uom'
import { vnRange } from '@/features/inventory/lib/vn-time'
import {
  groupById,
  liveProducts,
  liveWarehouses,
  productById,
  stockLevel,
  stockLevelsDb,
  unitReadings,
  warehouseById,
} from '@/features/inventory/mock/catalog.store'
import { inventoryContext, scopedWarehouseFilter } from '@/features/inventory/mock/context'
import { allLedger, reservations, reservedMap } from '@/features/inventory/mock/documents.store'
import type { ProductRecord, StockLevelRecord } from '@/features/inventory/mock/records'
import { mockDelay } from '@/lib/data-source'
import { matchesSearch } from '@/lib/normalize'
import { notFound } from '@/mock/mock-errors'
import { paginate, sortItems } from '@/mock/mock-helpers'
import type {
  ReservationDto,
  StockAlertDto,
  StockAlertQuery,
  StockCardDto,
  StockCardLineDto,
  StockCardQuery,
  StockListResult,
  StockQuery,
  StockRowDto,
  StockStatus,
} from '@/types/inventory'
import { assertRange, ledgerOrder } from './inventory-queries'

/**
 * Handler mock tồn kho, cảnh báo, giữ chỗ, thẻ kho (07 §2.8, §3.6, §3.9, §3.10). Đọc dòng tồn, phiếu, thẻ kho
 * qua store lõi; phạm vi kho theo `inventoryContext` (BR-23), giá trị theo `canViewValues` (BR-25).
 */

const productSearchText = (p: ProductRecord) =>
  [p.code, p.name, p.barcode, ...p.units.map((u) => u.barcode)].filter(Boolean).join(' ')

const ALERT_ORDER: Record<Exclude<StockStatus, 'BinhThuong'>, number> = { HetHang: 0, DuoiToiThieu: 1, VuotToiDa: 2 }

export const stockMock = {
  /** GET /api/stock-levels (UC-08, FR-24) */
  async getList(query: StockQuery): Promise<StockListResult> {
    await mockDelay()
    const ctx = inventoryContext(permissions.stockLevels.view)
    const warehouseId = scopedWarehouseFilter(ctx, query.warehouseId)
    const warehouseIds = warehouseId ? [warehouseId] : ctx.scopeIds
    const scope = new Set(warehouseIds)
    const reserved = new Map(warehouseIds.map((id) => [id, reservedMap(id)]))
    const products = new Map(
      liveProducts()
        .filter((p) => (!query.groupId || p.groupId === query.groupId) && matchesSearch(productSearchText(p), query.search))
        .map((p) => [p.id, p])
    )

    // Dòng tồn trong phạm vi theo mặt hàng
    const byProduct = new Map<string, StockLevelRecord[]>()
    for (const l of stockLevelsDb.all()) {
      if (!scope.has(l.warehouseId) || !products.has(l.productId)) continue
      const list = byProduct.get(l.productId) ?? []
      list.push(l)
      byProduct.set(l.productId, list)
    }
    const order = new Map(liveWarehouses().map((w, i) => [w.id, i]))

    const rows: StockRowDto[] = []
    for (const [productId, levels] of byProduct) {
      const p = products.get(productId)!
      const g = groupById(p.groupId)
      const units = unitReadings(p)
      const cells = levels
        .sort((a, b) => (order.get(a.warehouseId) ?? 0) - (order.get(b.warehouseId) ?? 0))
        .map((l) => {
          const r = reserved.get(l.warehouseId)?.get(productId) ?? 0
          return { level: l, reserved: r, status: stockStatus(l, r) }
        })
      const onHand = cells.reduce((s, c) => s + c.level.onHand, 0)
      const res = cells.reduce((s, c) => s + c.reserved, 0)
      const value = cells.reduce((s, c) => s + c.level.stockValue, 0)
      if (query.inStockOnly && String(query.inStockOnly) !== 'false' && onHand <= 0) continue
      if (query.status && !cells.some((c) => c.status === query.status)) continue
      const single = warehouseId ? cells[0] : undefined
      rows.push({
        productId,
        productCode: p.code,
        productName: p.name,
        groupId: p.groupId,
        groupName: g?.name ?? '',
        groupColor: g?.color ?? '#64748B',
        baseUnit: p.baseUnit,
        units,
        imageUrl: p.imageUrl,
        warehouseId,
        onHand,
        reserved: res,
        available: onHand - res,
        reading: readQuantity(onHand, p.baseUnit, units),
        avgCost: single && ctx.canViewValues ? single.level.avgCost : undefined,
        stockValue: ctx.canViewValues ? value : undefined,
        minQty: single?.level.minQty ?? undefined,
        maxQty: single?.level.maxQty ?? undefined,
        status: single?.status,
        byWarehouse: warehouseId
          ? undefined
          : cells.map((c) => ({
              warehouseId: c.level.warehouseId,
              warehouseCode: warehouseById(c.level.warehouseId)?.code ?? '',
              onHand: c.level.onHand,
              available: c.level.onHand - c.reserved,
              status: c.status,
            })),
      })
    }

    const sortBy = query.sortBy || 'productCode'
    const sorted = sortItems(rows, sortBy, query.sortDir || 'asc')
    return {
      ...paginate(sorted, query),
      totalValue: ctx.canViewValues ? rows.reduce((s, r) => s + (r.stockValue ?? 0), 0) : undefined,
      canViewValues: ctx.canViewValues,
    }
  },

  /** GET /api/stock-levels/reservations (UC-08 bước 4, TC-21) */
  async getReservations(warehouseId: string, productId: string): Promise<ReservationDto[]> {
    await mockDelay(80, 160)
    const ctx = inventoryContext(permissions.stockLevels.view)
    ctx.assertScope(warehouseId)
    return reservations(warehouseId, productId)
  },

  /** GET /api/stock-levels/alerts (UC-10, FR-26, §3.9): chỉ dòng có ngưỡng tương ứng */
  async getAlerts(query: StockAlertQuery): Promise<StockAlertDto[]> {
    await mockDelay()
    const ctx = inventoryContext(permissions.stockLevels.view)
    const warehouseId = scopedWarehouseFilter(ctx, query.warehouseId)
    const active = liveWarehouses().filter((w) => w.isActive && ctx.inScope(w.id))
    const targets = active.filter((w) => !warehouseId || w.id === warehouseId)
    const reserved = new Map(active.map((w) => [w.id, reservedMap(w.id)]))
    const available = (wId: string, pId: string) =>
      (stockLevel(wId, pId)?.onHand ?? 0) - (reserved.get(wId)?.get(pId) ?? 0)

    const result: StockAlertDto[] = []
    const products = new Map(liveProducts().map((p) => [p.id, p]))
    for (const w of targets) {
      for (const l of stockLevelsDb.filter((x) => x.warehouseId === w.id)) {
        const p = products.get(l.productId)
        if (!p || (query.groupId && p.groupId !== query.groupId)) continue
        const r = reserved.get(w.id)?.get(p.id) ?? 0
        const status = stockStatus(l, r)
        if (status === 'BinhThuong' || !isAlert(l, status)) continue
        if (query.status && status !== query.status) continue
        const units = unitReadings(p)
        const avail = l.onHand - r
        const shortage = status === 'HetHang' || status === 'DuoiToiThieu'
        const suggested = shortage ? suggestQuantity(l, avail, units) : null
        result.push({
          productId: p.id,
          productCode: p.code,
          productName: p.name,
          groupName: groupById(p.groupId)?.name ?? '',
          baseUnit: p.baseUnit,
          units,
          warehouseId: w.id,
          warehouseCode: w.code,
          onHand: l.onHand,
          available: avail,
          minQty: l.minQty ?? undefined,
          maxQty: l.maxQty ?? undefined,
          status,
          suggestedQuantity: suggested ?? undefined,
          suggestedReading: suggested != null ? readQuantity(suggested, p.baseUnit, units) : undefined,
          sources: shortage
            ? active
                .filter((o) => o.id !== w.id)
                .map((o) => ({ warehouseId: o.id, warehouseCode: o.code, warehouseName: o.name, available: available(o.id, p.id) }))
                .filter((s) => s.available > 0)
            : [],
        })
      }
    }
    return result.sort(
      (a, b) => ALERT_ORDER[a.status] - ALERT_ORDER[b.status] || a.productCode.localeCompare(b.productCode) || a.warehouseCode.localeCompare(b.warehouseCode)
    )
  },

  /** GET /api/stock-cards (UC-09, FR-25, BR-20, §3.10) */
  async getStockCard(query: StockCardQuery): Promise<StockCardDto> {
    await mockDelay()
    const ctx = inventoryContext(permissions.stockLevels.view)
    const { from, to } = assertRange(query.from, query.to)
    const p = productById(query.productId)
    if (!p || p.isDeleted) throw notFound('Không tìm thấy mặt hàng.')
    const warehouseId = scopedWarehouseFilter(ctx, query.warehouseId)
    const scope = new Set(warehouseId ? [warehouseId] : ctx.scopeIds)
    const [startIso, endIso] = vnRange(from, to) as [string, string]
    const ledger = allLedger()
      .filter((l) => l.productId === p.id && scope.has(l.warehouseId))
      .sort(ledgerOrder)

    // Tồn đầu kỳ: số dư sau dòng cuối trước kỳ của từng kho, cộng các kho
    const lastBefore = new Map<string, { q: number; v: number }>()
    for (const l of ledger) {
      if (l.postedAt >= startIso) break
      lastBefore.set(l.warehouseId, { q: l.balanceQuantity, v: l.balanceValue })
    }
    const opening = [...lastBefore.values()].reduce((s, b) => ({ q: s.q + b.q, v: s.v + b.v }), { q: 0, v: 0 })

    const inPeriod = ledger.filter((l) => l.postedAt >= startIso && l.postedAt <= endIso)
    let runQ = opening.q
    let runV = opening.v
    const show = ctx.canViewValues
    const lines: StockCardLineDto[] = inPeriod.map((l) => {
      runQ += l.inQuantity - l.outQuantity
      runV += l.inValue - l.outValue
      return {
        id: l.id,
        postedAt: l.postedAt,
        warehouseId: l.warehouseId,
        warehouseCode: warehouseById(l.warehouseId)?.code ?? '',
        docType: l.docType,
        docKind: l.docKind,
        docId: l.docId,
        docCode: l.docCode,
        description: l.description,
        inQuantity: l.inQuantity,
        outQuantity: l.outQuantity,
        balanceQuantity: warehouseId ? l.balanceQuantity : runQ,
        unitCost: show ? l.unitCost : undefined,
        inValue: show ? l.inValue : undefined,
        outValue: show ? l.outValue : undefined,
        balanceValue: show ? (warehouseId ? l.balanceValue : runV) : undefined,
        avgCostAfter: show && warehouseId ? l.avgCostAfter : undefined,
      }
    })
    const totals = inPeriod.reduce(
      (s, l) => ({
        inQuantity: s.inQuantity + l.inQuantity,
        outQuantity: s.outQuantity + l.outQuantity,
        inValue: s.inValue + l.inValue,
        outValue: s.outValue + l.outValue,
      }),
      { inQuantity: 0, outQuantity: 0, inValue: 0, outValue: 0 }
    )
    const w = warehouseId ? warehouseById(warehouseId) : undefined
    return {
      product: { id: p.id, code: p.code, name: p.name, baseUnit: p.baseUnit, units: unitReadings(p) },
      warehouseId,
      warehouseCode: w?.code,
      from,
      to,
      opening: { quantity: opening.q, value: show ? opening.v : undefined },
      totals: {
        inQuantity: totals.inQuantity,
        outQuantity: totals.outQuantity,
        inValue: show ? totals.inValue : undefined,
        outValue: show ? totals.outValue : undefined,
      },
      closing: {
        quantity: opening.q + totals.inQuantity - totals.outQuantity,
        value: show ? opening.v + totals.inValue - totals.outValue : undefined,
      },
      lines,
      canViewValues: show,
    }
  },
}
