import { permissions } from '@/config/permissions'
import type {
  ApprovalPreview,
  GoodsIssueDto,
  GoodsIssueListItem,
  GoodsReceiptDto,
  GoodsReceiptListItem,
  StocktakeDto,
  StocktakeListItem,
  TransferDto,
  TransferListItem,
} from '@/types/inventory'
import { isLate } from '../lib/stock-rules'
import { groupById, productById, stockLevel, supplierById, warehouseById } from './catalog.store'
import type { InventoryContext } from './context'
import { allIssues, allReceipts } from './documents.store'
import type { GoodsIssueRecord, GoodsReceiptRecord, StocktakeRecord, TransferRecord } from './records'

/**
 * Bản ghi → DTO (07 §2.4–2.9) theo người gọi: tên kho, nhà cung cấp tra lúc đọc; trường giá trị null khi không được
 * xem (BR-25); `preview` cho người duyệt phiếu Chờ duyệt; kiểm kê mù (BR-15).
 */

/** Ngày chứng từ dùng lọc theo ngày (quyết định 11) */
export const docDate = (d: { approvedAt?: string; submittedAt?: string; createdAt: string }) =>
  d.approvedAt ?? d.submittedAt ?? d.createdAt

// ───────────────────────── Phiếu nhập

export function receiptToDto(r: GoodsReceiptRecord, ctx: InventoryContext): GoodsReceiptDto {
  const wh = warehouseById(r.warehouseId)
  const sup = supplierById(r.supplierId)
  const see = ctx.canViewValues || r.createdById === ctx.userId
  const reversalOf = r.reversalOfId ? allIssues().find((x) => x.id === r.reversalOfId) : undefined
  const reversedBy = allIssues().find((x) => x.reversalOfId === r.id && x.status !== 'DaHuy')
  return {
    id: r.id,
    code: r.code,
    warehouseId: r.warehouseId,
    warehouseCode: wh?.code ?? '',
    warehouseName: wh?.name ?? '',
    type: r.type,
    supplierId: r.supplierId,
    supplierCode: sup?.code,
    supplierName: sup?.name,
    delivererName: r.delivererName,
    sourceDocNo: r.sourceDocNo,
    sourceDocDate: r.sourceDocDate,
    note: r.note,
    freightCost: see ? r.freightCost : undefined,
    totalAmount: see ? r.totalAmount : undefined,
    totalValue: see ? r.totalValue : undefined,
    status: r.status,
    version: r.version,
    createdById: r.createdById,
    createdByName: r.createdByName,
    createdAt: r.createdAt,
    submittedAt: r.submittedAt,
    approvedById: r.approvedById,
    approvedByName: r.approvedByName,
    approvedAt: r.approvedAt,
    rejectedByName: r.rejectedByName,
    rejectedAt: r.rejectedAt,
    rejectReason: r.rejectReason,
    cancelledByName: r.cancelledByName,
    cancelledAt: r.cancelledAt,
    reversalOfId: r.reversalOfId,
    reversalOfCode: reversalOf?.code,
    reversedById: reversedBy?.id,
    reversedByCode: reversedBy?.code,
    lineCount: r.lines.length,
    lines: r.lines.map((l) =>
      see
        ? { ...l }
        : {
            ...l,
            unitPrice: undefined,
            amount: undefined,
            allocatedCost: undefined,
            value: undefined,
            landedUnitPrice: undefined,
          }
    ),
    canViewValues: see,
  }
}

export function receiptToListItem(r: GoodsReceiptRecord, ctx: InventoryContext): GoodsReceiptListItem {
  const { lines, ...rest } = receiptToDto(r, ctx)
  void lines
  return rest
}

// ───────────────────────── Phiếu xuất

/** Số liệu cho người duyệt (UC-05 bước 2): tồn hiện tại, thiếu theo tổng các dòng cùng mặt hàng, giá vốn dự kiến */
function previews(
  warehouseId: string,
  lines: { productId: string; baseQuantity: number }[],
  canViewValues: boolean
): ApprovalPreview[] {
  const need = new Map<string, number>()
  for (const l of lines) need.set(l.productId, (need.get(l.productId) ?? 0) + l.baseQuantity)
  return lines.map((l) => {
    const level = stockLevel(warehouseId, l.productId)
    const onHand = level?.onHand ?? 0
    return {
      onHand,
      shortage: Math.max(0, (need.get(l.productId) ?? 0) - onHand),
      avgCost: canViewValues ? (level?.avgCost ?? 0) : undefined,
      estimatedValue: canViewValues ? l.baseQuantity * (level?.avgCost ?? 0) : undefined,
    }
  })
}

/** Giá trị dự kiến theo giá vốn hiện tại (Phiếu chờ duyệt) */
export function estimatedValue(warehouseId: string, lines: { productId: string; baseQuantity: number }[]): number {
  return lines.reduce((s, l) => s + l.baseQuantity * (stockLevel(warehouseId, l.productId)?.avgCost ?? 0), 0)
}

export function issueToDto(x: GoodsIssueRecord, ctx: InventoryContext): GoodsIssueDto {
  const wh = warehouseById(x.warehouseId)
  const sup = supplierById(x.supplierId)
  const see = ctx.canViewValues
  const reversalOf = x.reversalOfId ? allReceipts().find((r) => r.id === x.reversalOfId) : undefined
  const reversedBy = allReceipts().find((r) => r.reversalOfId === x.id && r.status !== 'DaHuy')
  const withPreview = x.status === 'ChoDuyet' && ctx.can(permissions.goodsIssues.approve)
  const pv = withPreview ? previews(x.warehouseId, x.lines, see) : []
  return {
    id: x.id,
    code: x.code,
    warehouseId: x.warehouseId,
    warehouseCode: wh?.code ?? '',
    warehouseName: wh?.name ?? '',
    type: x.type,
    recipientName: x.recipientName,
    supplierId: x.supplierId,
    supplierCode: sup?.code,
    supplierName: sup?.name,
    orderRef: x.orderRef,
    reason: x.reason,
    totalValue: see ? x.totalValue : undefined,
    status: x.status,
    version: x.version,
    createdById: x.createdById,
    createdByName: x.createdByName,
    createdAt: x.createdAt,
    submittedAt: x.submittedAt,
    approvedById: x.approvedById,
    approvedByName: x.approvedByName,
    approvedAt: x.approvedAt,
    rejectedByName: x.rejectedByName,
    rejectedAt: x.rejectedAt,
    rejectReason: x.rejectReason,
    cancelledByName: x.cancelledByName,
    cancelledAt: x.cancelledAt,
    reversalOfId: x.reversalOfId,
    reversalOfCode: reversalOf?.code,
    reversedById: reversedBy?.id,
    reversedByCode: reversedBy?.code,
    lineCount: x.lines.length,
    lines: x.lines.map((l, i) => ({
      ...l,
      unitCost: see ? l.unitCost : undefined,
      value: see ? l.value : undefined,
      preview: withPreview ? pv[i] : undefined,
    })),
    canViewValues: see,
  }
}

export function issueToListItem(x: GoodsIssueRecord, ctx: InventoryContext): GoodsIssueListItem {
  const { lines, ...rest } = issueToDto(x, ctx)
  void lines
  return rest
}

// ───────────────────────── Phiếu chuyển

export function transferToDto(t: TransferRecord, ctx: InventoryContext): TransferDto {
  const from = warehouseById(t.fromWarehouseId)
  const to = warehouseById(t.toWarehouseId)
  const see = ctx.canViewValues
  const withPreview = t.status === 'ChoDuyet' && ctx.can(permissions.transfers.approve)
  const pv = withPreview ? previews(t.fromWarehouseId, t.lines, see) : []
  return {
    id: t.id,
    code: t.code,
    fromWarehouseId: t.fromWarehouseId,
    fromWarehouseCode: from?.code ?? '',
    fromWarehouseName: from?.name ?? '',
    toWarehouseId: t.toWarehouseId,
    toWarehouseCode: to?.code ?? '',
    toWarehouseName: to?.name ?? '',
    note: t.note,
    status: t.status,
    isLate: t.status === 'DangChuyen' && isLate(t.approvedAt),
    version: t.version,
    createdById: t.createdById,
    createdByName: t.createdByName,
    createdAt: t.createdAt,
    submittedAt: t.submittedAt,
    approvedById: t.approvedById,
    approvedByName: t.approvedByName,
    approvedAt: t.approvedAt,
    rejectedByName: t.rejectedByName,
    rejectedAt: t.rejectedAt,
    rejectReason: t.rejectReason,
    cancelledByName: t.cancelledByName,
    cancelledAt: t.cancelledAt,
    receivedById: t.receivedById,
    receivedByName: t.receivedByName,
    receivedAt: t.receivedAt,
    totalValue: see ? t.totalValue : undefined,
    shortageValue: see ? t.shortageValue : undefined,
    lineCount: t.lines.length,
    lines: t.lines.map((l, i) => ({
      ...l,
      unitCost: see ? l.unitCost : undefined,
      value: see ? l.value : undefined,
      shortageValue: see ? l.shortageValue : undefined,
      preview: withPreview ? pv[i] : undefined,
    })),
    canViewValues: see,
  }
}

export function transferToListItem(t: TransferRecord, ctx: InventoryContext): TransferListItem {
  const { lines, ...rest } = transferToDto(t, ctx)
  void lines
  return rest
}

// ───────────────────────── Kiểm kê

export function stocktakeToDto(s: StocktakeRecord, ctx: InventoryContext): StocktakeDto {
  const wh = warehouseById(s.warehouseId)
  const blind = s.status === 'DangKiem' && !ctx.can(permissions.stocktakes.approve)
  const see = ctx.canViewValues
  return {
    id: s.id,
    code: s.code,
    warehouseId: s.warehouseId,
    warehouseCode: wh?.code ?? '',
    warehouseName: wh?.name ?? '',
    scopeAll: s.scopeAll,
    groups: s.groupIds.map((id) => {
      const line = s.lines.find((l) => l.groupId === id)
      return { id, name: line?.groupName ?? groupById(id)?.name ?? '' }
    }),
    status: s.status,
    version: s.version,
    snapshotAt: s.snapshotAt,
    createdById: s.createdById,
    createdByName: s.createdByName,
    counterId: s.counterId,
    counterName: s.counterName,
    submittedByName: s.submittedByName,
    submittedAt: s.submittedAt,
    approvedById: s.approvedById,
    approvedByName: s.approvedByName,
    approvedAt: s.approvedAt,
    cancelledByName: s.cancelledByName,
    cancelledAt: s.cancelledAt,
    note: s.note,
    returnNote: s.returnNote,
    totalLines: s.lines.length,
    countedLines: s.lines.filter((l) => l.countedQuantity != null).length,
    surplusValue: !blind && see ? sumValue(s, 1) : undefined,
    shortageValue: !blind && see ? sumValue(s, -1) : undefined,
    isBlind: blind,
    canViewValues: see,
    lines: [...s.lines]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => {
        const product = productById(l.productId)
        return {
          id: l.id,
          productId: l.productId,
          productCode: l.productCode,
          productName: l.productName,
          groupId: l.groupId,
          groupName: l.groupName,
          baseUnit: l.baseUnit,
          units: [...(product?.units ?? [])]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((u) => ({ id: u.id, name: u.name, factor: u.factor, barcode: u.barcode })),
          barcode: product?.barcode,
          bookQuantity: blind ? undefined : l.bookQuantity,
          bookCost: blind || !see ? undefined : l.bookCost,
          countedQuantity: l.countedQuantity ?? undefined,
          difference: blind ? undefined : (l.difference ?? undefined),
          differencePercent: blind ? undefined : (l.differencePercent ?? undefined),
          differenceValue: blind || !see ? undefined : (l.differenceValue ?? undefined),
          reasonRequired: blind ? undefined : l.reasonRequired,
          reason: l.reason ?? undefined,
          reasonNote: l.reasonNote ?? undefined,
          needsRecount: l.needsRecount,
          recountNote: l.recountNote ?? undefined,
          isAdded: l.isAdded,
          lastCountedByName: l.lastCountedByName ?? undefined,
          lastCountedAt: l.lastCountedAt ?? undefined,
        }
      }),
  }
}

function sumValue(s: StocktakeRecord, sign: 1 | -1) {
  return s.lines.reduce((sum, l) => {
    const v = l.differenceValue ?? 0
    return sign > 0 ? sum + Math.max(v, 0) : sum + Math.max(-v, 0)
  }, 0)
}

export function stocktakeToListItem(s: StocktakeRecord, ctx: InventoryContext): StocktakeListItem {
  const { lines, ...rest } = stocktakeToDto(s, ctx)
  void lines
  return rest
}
