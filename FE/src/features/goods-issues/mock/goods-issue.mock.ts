import { selectableIssueTypes } from '@/config/inventory-labels'
import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { forbidden, notFound } from '@/mock/mock-errors'
import { listQuery, newId } from '@/mock/mock-helpers'
import type { PaginatedResult } from '@/types/api'
import type {
  DocActionRequest,
  GoodsIssueDto,
  GoodsIssueListItem,
  GoodsIssueQuery,
  GoodsReceiptDto,
  RejectRequest,
  SaveGoodsIssueRequest,
} from '@/types/inventory'
import { receiptLineTotals } from '@/features/inventory/lib/costing'
import { inventoryRules } from '@/features/inventory/lib/rules'
import { inVnRange } from '@/features/inventory/lib/vn-time'
import { supplierById } from '@/features/inventory/mock/catalog.store'
import { inventoryContext, scopedWarehouseFilter, type InventoryContext } from '@/features/inventory/mock/context'
import { docDate, issueToDto, issueToListItem, receiptToDto } from '@/features/inventory/mock/doc-mappers'
import { guardDocAction, nowIso } from '@/features/inventory/mock/doc-guard'
import {
  assertAvailable,
  assertNotLocked,
  assertOnHand,
  checkWarehouse,
  resolveLines,
  type FieldErrorMap,
} from '@/features/inventory/mock/doc-lines'
import {
  allIssues,
  allReceipts,
  findIssue,
  issuesDb,
  nextCodeFor,
  receiptsDb,
} from '@/features/inventory/mock/documents.store'
import { fieldErrors, inventoryErrors } from '@/features/inventory/mock/errors'
import { postIssue } from '@/features/inventory/mock/posting'
import { withPosting } from '@/features/inventory/mock/posting-runtime'
import type { GoodsIssueRecord, GoodsReceiptRecord } from '@/features/inventory/mock/records'
import { issueDescription } from '@/features/inventory/mock/seed-loader'

/**
 * Handler mock Phiếu xuất (07 §2.5, UC-04, UC-05, UC-07): giữ chỗ khi Chờ duyệt (BR-03), kiểm tồn khả dụng khi gửi
 * (BR-04), tồn thực + khóa kiểm kê khi duyệt, ghi sổ BR-10, phiếu ngược → phiếu nhập Nhập điều chỉnh.
 */

const P = permissions.goodsIssues

function getScoped(id: string, ctx: InventoryContext): GoodsIssueRecord {
  const doc = findIssue(id)
  if (!doc) throw notFound('Không tìm thấy phiếu xuất.')
  ctx.assertScope(doc.warehouseId)
  return structuredClone(doc)
}

type Content = Pick<
  GoodsIssueRecord,
  'warehouseId' | 'type' | 'recipientName' | 'supplierId' | 'orderRef' | 'reason' | 'lines'
>

function buildContent(req: SaveGoodsIssueRequest, ctx: InventoryContext, submit: boolean, current?: GoodsIssueRecord): Content {
  const errors: FieldErrorMap = {}
  checkWarehouse(req.warehouseId, 'warehouseId', errors, ctx.assertScope)
  const typeOk =
    selectableIssueTypes.includes(req.type) || (current?.type === 'XuatDieuChinh' && req.type === 'XuatDieuChinh')
  if (!typeOk) errors.type = 'Chọn loại xuất'
  const recipientName = req.recipientName?.trim() || undefined
  const reason = req.reason?.trim() || undefined
  if (submit) {
    if (req.type === 'XuatBan' && !recipientName) errors.recipientName = 'Nhập người nhận'
    if (req.type === 'XuatHuy' && !reason) errors.reason = 'Nhập lý do xuất hủy'
    if (req.type === 'XuatDieuChinh' && !reason) errors.reason = 'Nhập lý do điều chỉnh'
    if (req.type === 'TraNhaCungCap') {
      const sup = supplierById(req.supplierId)
      if (!sup || sup.isDeleted) errors.supplierId = 'Chọn nhà cung cấp nhận hàng trả'
    }
  }
  const lines = resolveLines(req.lines, errors, { requireAtLeastOne: submit })
  if (Object.keys(errors).length) throw fieldErrors(errors)
  return {
    warehouseId: req.warehouseId,
    type: req.type,
    recipientName,
    supplierId: req.type === 'TraNhaCungCap' ? req.supplierId || undefined : undefined,
    orderRef: req.orderRef?.trim() || undefined,
    reason,
    lines,
  }
}

function toRequest(doc: GoodsIssueRecord): SaveGoodsIssueRequest {
  return {
    warehouseId: doc.warehouseId,
    type: doc.type,
    recipientName: doc.recipientName,
    supplierId: doc.supplierId ?? null,
    orderRef: doc.orderRef,
    reason: doc.reason,
    lines: doc.lines.map((l) => ({ productId: l.productId, unitId: l.unitId ?? null, quantity: l.quantity })),
    clientRequestId: '',
  }
}

function markSubmitted(doc: GoodsIssueRecord, at: string) {
  assertAvailable(doc.warehouseId, doc.lines, doc.id)
  doc.status = 'ChoDuyet'
  doc.submittedAt = at
  if (!doc.code) doc.code = nextCodeFor('GoodsIssue', at)
}

function save(doc: GoodsIssueRecord, requestId: string) {
  doc.version += 1
  doc.lastRequestId = requestId
  doc.updatedAt = nowIso()
  if (issuesDb.get(doc.id)) issuesDb.update(doc.id, doc)
  else issuesDb.insert(doc)
}

export const goodsIssueMock = {
  async getList(query: GoodsIssueQuery): Promise<PaginatedResult<GoodsIssueListItem>> {
    const ctx = inventoryContext(P.view)
    await mockDelay()
    const warehouseId = scopedWarehouseFilter(ctx, query.warehouseId)
    const items = allIssues().filter(
      (x) =>
        ctx.inScope(x.warehouseId) &&
        (!warehouseId || x.warehouseId === warehouseId) &&
        (!query.type || x.type === query.type) &&
        (!query.status || x.status === query.status) &&
        (!query.createdById || x.createdById === query.createdById) &&
        inVnRange(docDate(x), query.from, query.to)
    )
    const page = listQuery(items, query, {
      searchFields: ['code', 'recipientName', 'orderRef', (x) => supplierById(x.supplierId)?.name],
      defaultSortBy: 'createdAt',
    })
    return { ...page, items: page.items.map((x) => issueToListItem(x, ctx)) }
  },

  async getById(id: string): Promise<GoodsIssueDto> {
    const ctx = inventoryContext(P.view)
    await mockDelay(100, 200)
    return issueToDto(getScoped(id, ctx), ctx)
  },

  async create(req: SaveGoodsIssueRequest): Promise<GoodsIssueDto> {
    const ctx = inventoryContext(P.create)
    await mockDelay()
    const existing = req.clientRequestId ? issuesDb.find((x) => x.clientRequestId === req.clientRequestId) : undefined
    if (existing) return issueToDto(existing, ctx)
    if (req.submit && !ctx.can(P.update)) throw forbidden()
    const at = nowIso()
    const doc: GoodsIssueRecord = {
      id: newId(),
      version: 1,
      status: 'Nhap',
      createdById: ctx.userId,
      createdByName: ctx.fullName,
      createdAt: at,
      updatedAt: at,
      clientRequestId: req.clientRequestId,
      lastRequestId: req.clientRequestId,
      ...buildContent(req, ctx, !!req.submit),
    }
    if (req.submit) markSubmitted(doc, at)
    issuesDb.insert(doc)
    return issueToDto(doc, ctx)
  },

  async update(id: string, req: SaveGoodsIssueRequest): Promise<GoodsIssueDto> {
    const ctx = inventoryContext(P.update)
    await mockDelay()
    const doc = getScoped(id, ctx)
    const step = guardDocAction(doc, { version: req.version, clientRequestId: req.clientRequestId }, {
      allowed: ['Nhap', 'TuChoi'],
      userId: ctx.userId,
      ownerOnly: true,
    })
    if (step === 'replay') return issueToDto(doc, ctx)
    Object.assign(doc, buildContent(req, ctx, !!req.submit, doc))
    if (req.submit) markSubmitted(doc, nowIso())
    save(doc, req.clientRequestId)
    return issueToDto(doc, ctx)
  },

  async submit(id: string, req: DocActionRequest): Promise<GoodsIssueDto> {
    const ctx = inventoryContext(P.update)
    await mockDelay()
    const doc = getScoped(id, ctx)
    if (guardDocAction(doc, req, { allowed: ['Nhap', 'TuChoi'], userId: ctx.userId, ownerOnly: true }) === 'replay')
      return issueToDto(doc, ctx)
    buildContent(toRequest(doc), ctx, true, doc)
    markSubmitted(doc, nowIso())
    save(doc, req.clientRequestId)
    return issueToDto(doc, ctx)
  },

  async withdraw(id: string, req: DocActionRequest): Promise<GoodsIssueDto> {
    const ctx = inventoryContext(P.update)
    await mockDelay()
    const doc = getScoped(id, ctx)
    if (guardDocAction(doc, req, { allowed: ['ChoDuyet'], userId: ctx.userId, ownerOnly: true }) === 'replay')
      return issueToDto(doc, ctx)
    doc.status = 'Nhap'
    save(doc, req.clientRequestId)
    return issueToDto(doc, ctx)
  },

  async approve(id: string, req: DocActionRequest): Promise<GoodsIssueDto> {
    const ctx = inventoryContext(P.approve)
    await mockDelay()
    const doc = getScoped(id, ctx)
    if (guardDocAction(doc, req, { allowed: ['ChoDuyet'], userId: ctx.userId, notOwner: true }) === 'replay')
      return issueToDto(doc, ctx)
    assertOnHand(doc.warehouseId, doc.lines)
    assertNotLocked(doc.warehouseId, doc.lines)
    const at = nowIso()
    const reversalOf = doc.reversalOfId ? allReceipts().find((r) => r.id === doc.reversalOfId) : undefined
    withPosting(at, (posting) => {
      postIssue(doc, posting, issueDescription(doc, reversalOf?.code, supplierById(doc.supplierId)?.name))
      Object.assign(doc, { status: 'DaDuyet', approvedAt: at, approvedById: ctx.userId, approvedByName: ctx.fullName })
      save(doc, req.clientRequestId)
    })
    return issueToDto(doc, ctx)
  },

  async reject(id: string, req: RejectRequest): Promise<GoodsIssueDto> {
    const ctx = inventoryContext(P.approve)
    await mockDelay()
    const doc = getScoped(id, ctx)
    if (guardDocAction(doc, req, { allowed: ['ChoDuyet'], userId: ctx.userId, notOwner: true }) === 'replay')
      return issueToDto(doc, ctx)
    const reason = req.reason?.trim() ?? ''
    if (reason.length < inventoryRules.minRejectReason) throw fieldErrors({ reason: 'Lý do từ chối tối thiểu 10 ký tự' })
    Object.assign(doc, {
      status: 'TuChoi',
      rejectReason: reason,
      rejectedAt: nowIso(),
      rejectedById: ctx.userId,
      rejectedByName: ctx.fullName,
    })
    save(doc, req.clientRequestId)
    return issueToDto(doc, ctx)
  },

  async cancel(id: string, req: DocActionRequest): Promise<GoodsIssueDto> {
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
    if (step === 'replay') return issueToDto(doc, ctx)
    Object.assign(doc, { status: 'DaHuy', cancelledAt: nowIso(), cancelledById: ctx.userId, cancelledByName: ctx.fullName })
    save(doc, req.clientRequestId)
    return issueToDto(doc, ctx)
  },

  /** Phiếu ngược của phiếu xuất → phiếu nhập nháp Nhập điều chỉnh, đơn giá = giá vốn dòng gốc (BR-12, quyết định 8) */
  async reverse(id: string, req: DocActionRequest): Promise<GoodsReceiptDto> {
    const ctx = inventoryContext(P.reverse)
    await mockDelay()
    const doc = getScoped(id, ctx)
    if (req.clientRequestId && doc.lastRequestId === req.clientRequestId) {
      const made = receiptsDb.find((r) => r.reversalOfId === doc.id && r.clientRequestId === req.clientRequestId)
      if (made) return receiptToDto(made, ctx)
    }
    if (doc.status !== 'DaDuyet' || doc.type === 'XuatDieuChinh') throw inventoryErrors.khongTaoPhieuNguoc()
    const existing = allReceipts().find((r) => r.reversalOfId === doc.id && r.status !== 'DaHuy')
    if (existing) throw inventoryErrors.phieuNguocDaCo(doc.code ?? '', existing.code)
    if (req.version !== doc.version) throw inventoryErrors.duLieuCu(doc.version)
    const at = nowIso()
    const totals = receiptLineTotals(
      doc.lines.map((l) => ({ quantity: l.baseQuantity, unitPrice: l.unitCost ?? 0, factor: 1 })),
      0
    )
    const receipt: GoodsReceiptRecord = {
      id: newId(),
      version: 1,
      status: 'Nhap',
      warehouseId: doc.warehouseId,
      type: 'NhapDieuChinh',
      note: `Phiếu ngược của ${doc.code}`,
      freightCost: 0,
      totalAmount: totals.totalAmount,
      totalValue: totals.totalValue,
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
        unitPrice: l.unitCost ?? 0,
        ...totals.lines[i],
      })),
    }
    receiptsDb.insert(receipt)
    save(doc, req.clientRequestId)
    return receiptToDto(receipt, ctx)
  },
}
