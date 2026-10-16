import { selectableReceiptTypes } from '@/config/inventory-labels'
import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { forbidden, notFound } from '@/mock/mock-errors'
import { listQuery, newId } from '@/mock/mock-helpers'
import type { PaginatedResult } from '@/types/api'
import type {
  DocActionRequest,
  GoodsIssueDto,
  GoodsReceiptDto,
  GoodsReceiptListItem,
  GoodsReceiptQuery,
  RejectRequest,
  SaveGoodsReceiptRequest,
} from '@/types/inventory'
import { receiptLineTotals } from '@/features/inventory/lib/costing'
import { inventoryRules } from '@/features/inventory/lib/rules'
import { inVnRange, vnToday } from '@/features/inventory/lib/vn-time'
import { stockLevel, supplierById } from '@/features/inventory/mock/catalog.store'
import { inventoryContext, scopedWarehouseFilter, type InventoryContext } from '@/features/inventory/mock/context'
import { docDate, issueToDto, receiptToDto, receiptToListItem } from '@/features/inventory/mock/doc-mappers'
import { guardDocAction, nowIso } from '@/features/inventory/mock/doc-guard'
import { assertNotLocked, checkWarehouse, resolveLines, type FieldErrorMap } from '@/features/inventory/mock/doc-lines'
import {
  allIssues,
  allReceipts,
  findReceipt,
  issuesDb,
  nextCodeFor,
  receiptsDb,
} from '@/features/inventory/mock/documents.store'
import { fieldErrors, inventoryErrors } from '@/features/inventory/mock/errors'
import { withPosting } from '@/features/inventory/mock/posting-runtime'
import { postReceipt } from '@/features/inventory/mock/posting'
import type { GoodsIssueRecord, GoodsReceiptRecord } from '@/features/inventory/mock/records'
import { receiptDescription } from '@/features/inventory/mock/seed-loader'

/**
 * Handler mock Phiếu nhập (07 §2.4, UC-03, UC-05, UC-07): lập, sửa, gửi, rút, duyệt (ghi sổ BR-08, BR-09), từ chối,
 * hủy, tạo phiếu ngược. Thứ tự kiểm theo §3.8, câu lỗi theo §2.12.
 */

const P = permissions.goodsReceipts

function getScoped(id: string, ctx: InventoryContext): GoodsReceiptRecord {
  const doc = findReceipt(id)
  if (!doc) throw notFound('Không tìm thấy phiếu nhập.')
  ctx.assertScope(doc.warehouseId)
  return structuredClone(doc)
}

/** Kiểm dữ liệu khi lưu (nháp chỉ kiểm định dạng; gửi duyệt kiểm đủ) và dựng dòng có giá trị */
function buildContent(req: SaveGoodsReceiptRequest, ctx: InventoryContext, submit: boolean, current?: GoodsReceiptRecord) {
  const errors: FieldErrorMap = {}
  checkWarehouse(req.warehouseId, 'warehouseId', errors, ctx.assertScope)
  const typeOk =
    selectableReceiptTypes.includes(req.type) || (current?.type === 'NhapDieuChinh' && req.type === 'NhapDieuChinh')
  if (!typeOk) errors.type = 'Chọn loại nhập'
  if (submit && req.type === 'MuaHang') {
    const sup = supplierById(req.supplierId)
    if (!req.supplierId || !sup || sup.isDeleted) errors.supplierId = 'Chọn nhà cung cấp'
    else if (!sup.isActive) errors.supplierId = `Nhà cung cấp ${sup.code} đã ngừng giao dịch`
  }
  if (req.sourceDocDate && req.sourceDocDate > vnToday())
    errors.sourceDocDate = 'Ngày chứng từ không được sau hôm nay'
  const freight = Number(req.freightCost ?? 0)
  if (!Number.isInteger(freight) || freight < 0) errors.freightCost = 'Chi phí mua hàng không được âm'
  const lines = resolveLines(req.lines, errors, { requireAtLeastOne: submit })
  req.lines?.forEach((l, i) => {
    if (!(Number(l.unitPrice) >= 0)) errors[`lines[${i}].unitPrice`] = 'Đơn giá không được âm'
  })
  if (Object.keys(errors).length) throw fieldErrors(errors)

  // BR-25: người không được xem giá mà không phải người lập → giữ giá cũ (không nhận từ request)
  const canPrice = ctx.canViewValues || !current || current.createdById === ctx.userId
  const prices = lines.map((l, i) => {
    if (canPrice) return Math.round(Number(req.lines[i].unitPrice) || 0)
    return current?.lines.find((c) => c.productId === l.productId && c.unitId === l.unitId)?.unitPrice ?? 0
  })
  const freightCost = canPrice ? freight : (current?.freightCost ?? 0)
  const totals = receiptLineTotals(
    lines.map((l, i) => ({ quantity: l.quantity, unitPrice: prices[i], factor: l.factor })),
    freightCost
  )
  return {
    warehouseId: req.warehouseId,
    type: req.type,
    supplierId: req.supplierId || undefined,
    delivererName: req.delivererName?.trim() || undefined,
    sourceDocNo: req.sourceDocNo?.trim() || undefined,
    sourceDocDate: req.sourceDocDate || undefined,
    note: req.note?.trim() || undefined,
    freightCost,
    totalAmount: totals.totalAmount,
    totalValue: totals.totalValue,
    lines: lines.map((l, i) => ({
      ...l,
      unitPrice: prices[i],
      amount: totals.lines[i].amount,
      allocatedCost: totals.lines[i].allocatedCost,
      value: totals.lines[i].value,
      landedUnitPrice: totals.lines[i].landedUnitPrice,
    })),
  }
}

/** Gửi duyệt: cấp mã nếu chưa có (quyết định 6) */
function markSubmitted(doc: GoodsReceiptRecord, at: string) {
  doc.status = 'ChoDuyet'
  doc.submittedAt = at
  if (!doc.code) doc.code = nextCodeFor('GoodsReceipt', at)
}

/** Kiểm gửi duyệt cho phiếu đã lưu (PATCH submit) */
function validateForSubmit(doc: GoodsReceiptRecord, ctx: InventoryContext) {
  buildContent(
    {
      ...doc,
      supplierId: doc.supplierId ?? null,
      lines: doc.lines.map((l) => ({ productId: l.productId, unitId: l.unitId ?? null, quantity: l.quantity, unitPrice: l.unitPrice })),
      clientRequestId: '',
    },
    ctx,
    true,
    doc
  )
}

function save(doc: GoodsReceiptRecord, requestId: string) {
  doc.version += 1
  doc.lastRequestId = requestId
  doc.updatedAt = nowIso()
  if (receiptsDb.get(doc.id)) receiptsDb.update(doc.id, doc)
  else receiptsDb.insert(doc)
}

export const goodsReceiptMock = {
  async getList(query: GoodsReceiptQuery): Promise<PaginatedResult<GoodsReceiptListItem>> {
    const ctx = inventoryContext(P.view)
    await mockDelay()
    const warehouseId = scopedWarehouseFilter(ctx, query.warehouseId)
    const items = allReceipts().filter(
      (r) =>
        ctx.inScope(r.warehouseId) &&
        (!warehouseId || r.warehouseId === warehouseId) &&
        (!query.type || r.type === query.type) &&
        (!query.status || r.status === query.status) &&
        (!query.supplierId || r.supplierId === query.supplierId) &&
        (!query.createdById || r.createdById === query.createdById) &&
        inVnRange(docDate(r), query.from, query.to)
    )
    const page = listQuery(items, query, {
      searchFields: ['code', 'sourceDocNo', (r) => supplierById(r.supplierId)?.name, 'delivererName'],
      defaultSortBy: 'createdAt',
    })
    return { ...page, items: page.items.map((r) => receiptToListItem(r, ctx)) }
  },

  async getById(id: string): Promise<GoodsReceiptDto> {
    const ctx = inventoryContext(P.view)
    await mockDelay(100, 200)
    return receiptToDto(getScoped(id, ctx), ctx)
  },

  async create(req: SaveGoodsReceiptRequest): Promise<GoodsReceiptDto> {
    const ctx = inventoryContext(P.create)
    await mockDelay()
    const existing = req.clientRequestId ? receiptsDb.find((r) => r.clientRequestId === req.clientRequestId) : undefined
    if (existing) return receiptToDto(existing, ctx)
    if (req.submit && !ctx.can(P.update)) throw forbidden()
    const content = buildContent(req, ctx, !!req.submit)
    const at = nowIso()
    const doc: GoodsReceiptRecord = {
      id: newId(),
      version: 1,
      status: 'Nhap',
      createdById: ctx.userId,
      createdByName: ctx.fullName,
      createdAt: at,
      updatedAt: at,
      clientRequestId: req.clientRequestId,
      lastRequestId: req.clientRequestId,
      ...content,
    }
    if (req.submit) markSubmitted(doc, at)
    receiptsDb.insert(doc)
    return receiptToDto(doc, ctx)
  },

  async update(id: string, req: SaveGoodsReceiptRequest): Promise<GoodsReceiptDto> {
    const ctx = inventoryContext(P.update)
    await mockDelay()
    const doc = getScoped(id, ctx)
    const step = guardDocAction(doc, { version: req.version, clientRequestId: req.clientRequestId }, {
      allowed: ['Nhap', 'TuChoi'],
      userId: ctx.userId,
      ownerOnly: true,
    })
    if (step === 'replay') return receiptToDto(doc, ctx)
    Object.assign(doc, buildContent(req, ctx, !!req.submit, doc))
    if (req.submit) markSubmitted(doc, nowIso())
    save(doc, req.clientRequestId)
    return receiptToDto(doc, ctx)
  },

  async submit(id: string, req: DocActionRequest): Promise<GoodsReceiptDto> {
    const ctx = inventoryContext(P.update)
    await mockDelay()
    const doc = getScoped(id, ctx)
    if (guardDocAction(doc, req, { allowed: ['Nhap', 'TuChoi'], userId: ctx.userId, ownerOnly: true }) === 'replay')
      return receiptToDto(doc, ctx)
    validateForSubmit(doc, ctx)
    markSubmitted(doc, nowIso())
    save(doc, req.clientRequestId)
    return receiptToDto(doc, ctx)
  },

  async withdraw(id: string, req: DocActionRequest): Promise<GoodsReceiptDto> {
    const ctx = inventoryContext(P.update)
    await mockDelay()
    const doc = getScoped(id, ctx)
    if (guardDocAction(doc, req, { allowed: ['ChoDuyet'], userId: ctx.userId, ownerOnly: true }) === 'replay')
      return receiptToDto(doc, ctx)
    doc.status = 'Nhap'
    save(doc, req.clientRequestId)
    return receiptToDto(doc, ctx)
  },

  async approve(id: string, req: DocActionRequest): Promise<GoodsReceiptDto> {
    const ctx = inventoryContext(P.approve)
    await mockDelay()
    const doc = getScoped(id, ctx)
    if (guardDocAction(doc, req, { allowed: ['ChoDuyet'], userId: ctx.userId, notOwner: true }) === 'replay')
      return receiptToDto(doc, ctx)
    assertNotLocked(doc.warehouseId, doc.lines)
    // Quyết định 9: hàng bán bị trả lại có dòng giá 0 → giá vốn bình quân hiện tại × hệ số
    if (doc.type === 'HangBanTraLai' && doc.lines.some((l) => !l.unitPrice)) {
      const prices = doc.lines.map((l) =>
        l.unitPrice ? l.unitPrice : (stockLevel(doc.warehouseId, l.productId)?.avgCost ?? 0) * l.factor
      )
      const totals = receiptLineTotals(
        doc.lines.map((l, i) => ({ quantity: l.quantity, unitPrice: prices[i], factor: l.factor })),
        doc.freightCost
      )
      doc.lines = doc.lines.map((l, i) => ({ ...l, unitPrice: prices[i], ...totals.lines[i] }))
      doc.totalAmount = totals.totalAmount
      doc.totalValue = totals.totalValue
    }
    const at = nowIso()
    const reversalOf = doc.reversalOfId ? allIssues().find((x) => x.id === doc.reversalOfId) : undefined
    withPosting(at, (posting) => {
      postReceipt(doc, posting, receiptDescription(doc, reversalOf?.code, supplierById(doc.supplierId)?.name))
      doc.status = 'DaDuyet'
      doc.approvedAt = at
      doc.approvedById = ctx.userId
      doc.approvedByName = ctx.fullName
      save(doc, req.clientRequestId)
    })
    return receiptToDto(doc, ctx)
  },

  async reject(id: string, req: RejectRequest): Promise<GoodsReceiptDto> {
    const ctx = inventoryContext(P.approve)
    await mockDelay()
    const doc = getScoped(id, ctx)
    if (guardDocAction(doc, req, { allowed: ['ChoDuyet'], userId: ctx.userId, notOwner: true }) === 'replay')
      return receiptToDto(doc, ctx)
    const reason = req.reason?.trim() ?? ''
    if (reason.length < inventoryRules.minRejectReason) throw fieldErrors({ reason: 'Lý do từ chối tối thiểu 10 ký tự' })
    const at = nowIso()
    Object.assign(doc, {
      status: 'TuChoi',
      rejectReason: reason,
      rejectedAt: at,
      rejectedById: ctx.userId,
      rejectedByName: ctx.fullName,
    })
    save(doc, req.clientRequestId)
    return receiptToDto(doc, ctx)
  },

  async cancel(id: string, req: DocActionRequest): Promise<GoodsReceiptDto> {
    const ctx = inventoryContext(P.delete)
    await mockDelay()
    const doc = getScoped(id, ctx)
    const step = guardDocAction(doc, req, {
      allowed: ['Nhap', 'TuChoi'],
      userId: ctx.userId,
      authorize: () => {
        if (doc.createdById !== ctx.userId && !ctx.can(P.approve)) throw inventoryErrors.khongPhaiNguoiLap()
      },
    })
    if (step === 'replay') return receiptToDto(doc, ctx)
    Object.assign(doc, { status: 'DaHuy', cancelledAt: nowIso(), cancelledById: ctx.userId, cancelledByName: ctx.fullName })
    save(doc, req.clientRequestId)
    return receiptToDto(doc, ctx)
  },

  /** Phiếu ngược của phiếu nhập → phiếu xuất nháp Xuất điều chỉnh (BR-12, quyết định 7) */
  async reverse(id: string, req: DocActionRequest): Promise<GoodsIssueDto> {
    const ctx = inventoryContext(P.reverse)
    await mockDelay()
    const doc = getScoped(id, ctx)
    if (req.clientRequestId && doc.lastRequestId === req.clientRequestId) {
      const made = issuesDb.find((x) => x.reversalOfId === doc.id && x.clientRequestId === req.clientRequestId)
      if (made) return issueToDto(made, ctx)
    }
    if (doc.status !== 'DaDuyet' || doc.type === 'NhapDieuChinh') throw inventoryErrors.khongTaoPhieuNguoc()
    const existing = allIssues().find((x) => x.reversalOfId === doc.id && x.status !== 'DaHuy')
    if (existing) throw inventoryErrors.phieuNguocDaCo(doc.code ?? '', existing.code)
    if (req.version !== doc.version) throw inventoryErrors.duLieuCu(doc.version)
    const at = nowIso()
    const issue: GoodsIssueRecord = {
      id: newId(),
      version: 1,
      status: 'Nhap',
      warehouseId: doc.warehouseId,
      type: 'XuatDieuChinh',
      reason: `Phiếu ngược của ${doc.code}`,
      reversalOfId: doc.id,
      createdById: ctx.userId,
      createdByName: ctx.fullName,
      createdAt: at,
      updatedAt: at,
      clientRequestId: req.clientRequestId,
      lastRequestId: req.clientRequestId,
      lines: doc.lines.map((l, i) => ({
        id: newId(),
        lineNo: i + 1,
        productId: l.productId,
        productCode: l.productCode,
        productName: l.productName,
        baseUnit: l.baseUnit,
        unitId: undefined,
        unitName: l.baseUnit,
        factor: 1,
        quantity: l.baseQuantity,
        baseQuantity: l.baseQuantity,
      })),
    }
    issuesDb.insert(issue)
    save(doc, req.clientRequestId) // tăng version phiếu gốc (06 §4): hai người bấm cùng lúc không tạo được hai phiếu
    return issueToDto(issue, ctx)
  },
}
