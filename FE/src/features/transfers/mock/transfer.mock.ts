import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { formatNumber } from '@/lib/format'
import { forbidden, notFound } from '@/mock/mock-errors'
import { listQuery, newId } from '@/mock/mock-helpers'
import type { PaginatedResult } from '@/types/api'
import type {
  DocActionRequest,
  ReceiveTransferRequest,
  RejectRequest,
  SaveTransferRequest,
  TransferDto,
  TransferListItem,
  TransferQuery,
} from '@/types/inventory'
import { inventoryRules } from '@/features/inventory/lib/rules'
import { isLate } from '@/features/inventory/lib/stock-rules'
import { baseUnitWord } from '@/features/inventory/lib/uom'
import { inVnRange } from '@/features/inventory/lib/vn-time'
import { warehouseById } from '@/features/inventory/mock/catalog.store'
import { inventoryContext, scopedWarehouseFilter, type InventoryContext } from '@/features/inventory/mock/context'
import { docDate, transferToDto, transferToListItem } from '@/features/inventory/mock/doc-mappers'
import { guardDocAction, nowIso } from '@/features/inventory/mock/doc-guard'
import {
  assertAvailable,
  assertNotLocked,
  assertOnHand,
  checkWarehouse,
  resolveLines,
  type FieldErrorMap,
} from '@/features/inventory/mock/doc-lines'
import { allTransfers, findTransfer, nextCodeFor, transfersDb } from '@/features/inventory/mock/documents.store'
import { fieldErrors, inventoryErrors } from '@/features/inventory/mock/errors'
import { postTransferIn, postTransferOut } from '@/features/inventory/mock/posting'
import { withPosting } from '@/features/inventory/mock/posting-runtime'
import type { TransferRecord } from '@/features/inventory/mock/records'

/**
 * Handler mock Chuyển kho (07 §2.6, UC-06, BR-13): giữ chỗ kho đi khi Chờ duyệt, duyệt trừ kho đi (Đang chuyển),
 * kho đến xác nhận số thực nhận (Đã nhận), hao hụt ghi ở dòng phiếu.
 */

const P = permissions.transfers

/** Thấy được khi kho đi hoặc kho đến trong phạm vi (07 §1) */
function getVisible(id: string, ctx: InventoryContext): TransferRecord {
  const doc = findTransfer(id)
  if (!doc) throw notFound('Không tìm thấy phiếu chuyển kho.')
  if (!ctx.inScope(doc.fromWarehouseId) && !ctx.inScope(doc.toWarehouseId))
    throw inventoryErrors.khongPhuTrachKho(warehouseById(doc.fromWarehouseId)?.code ?? '')
  return structuredClone(doc)
}

function buildContent(req: SaveTransferRequest, ctx: InventoryContext, submit: boolean) {
  const errors: FieldErrorMap = {}
  checkWarehouse(req.fromWarehouseId, 'fromWarehouseId', errors, ctx.assertScope)
  if (!req.toWarehouseId) errors.toWarehouseId = 'Chọn kho đến'
  else if (req.toWarehouseId === req.fromWarehouseId) errors.toWarehouseId = 'Kho đến phải khác kho đi'
  else {
    const to = warehouseById(req.toWarehouseId)
    if (!to || to.isDeleted) errors.toWarehouseId = 'Chọn kho đến'
    else if (!to.isActive) errors.toWarehouseId = `Kho ${to.code} đã ngừng hoạt động`
  }
  const lines = resolveLines(req.lines, errors, { requireAtLeastOne: submit })
  if (Object.keys(errors).length) throw fieldErrors(errors)
  return {
    fromWarehouseId: req.fromWarehouseId,
    toWarehouseId: req.toWarehouseId,
    note: req.note?.trim() || undefined,
    lines,
  }
}

const toRequest = (doc: TransferRecord): SaveTransferRequest => ({
  fromWarehouseId: doc.fromWarehouseId,
  toWarehouseId: doc.toWarehouseId,
  note: doc.note,
  lines: doc.lines.map((l) => ({ productId: l.productId, unitId: l.unitId ?? null, quantity: l.quantity })),
  clientRequestId: '',
})

function markSubmitted(doc: TransferRecord, at: string) {
  assertAvailable(doc.fromWarehouseId, doc.lines, doc.id)
  doc.status = 'ChoDuyet'
  doc.submittedAt = at
  if (!doc.code) doc.code = nextCodeFor('Transfer', at)
}

function save(doc: TransferRecord, requestId: string) {
  doc.version += 1
  doc.lastRequestId = requestId
  doc.updatedAt = nowIso()
  if (transfersDb.get(doc.id)) transfersDb.update(doc.id, doc)
  else transfersDb.insert(doc)
}

export const transferMock = {
  async getList(query: TransferQuery): Promise<PaginatedResult<TransferListItem>> {
    const ctx = inventoryContext(P.view)
    await mockDelay()
    const wh = scopedWarehouseFilter(ctx, query.warehouseId)
    const fromId = scopedWarehouseFilter(ctx, query.fromWarehouseId)
    const toId = scopedWarehouseFilter(ctx, query.toWarehouseId)
    const isLateFilter = String(query.isLate) === 'true'
    const items = allTransfers().filter(
      (t) =>
        (ctx.inScope(t.fromWarehouseId) || ctx.inScope(t.toWarehouseId)) &&
        (!wh || t.fromWarehouseId === wh || t.toWarehouseId === wh) &&
        (!fromId || t.fromWarehouseId === fromId) &&
        (!toId || t.toWarehouseId === toId) &&
        (!query.status || t.status === query.status) &&
        (!isLateFilter || (t.status === 'DangChuyen' && isLate(t.approvedAt))) &&
        (!query.createdById || t.createdById === query.createdById) &&
        inVnRange(docDate(t), query.from, query.to)
    )
    const page = listQuery(items, query, {
      searchFields: ['code', 'note', (t) => warehouseById(t.fromWarehouseId)?.code, (t) => warehouseById(t.toWarehouseId)?.code],
      defaultSortBy: 'createdAt',
    })
    return { ...page, items: page.items.map((t) => transferToListItem(t, ctx)) }
  },

  async getById(id: string): Promise<TransferDto> {
    const ctx = inventoryContext(P.view)
    await mockDelay(100, 200)
    return transferToDto(getVisible(id, ctx), ctx)
  },

  async create(req: SaveTransferRequest): Promise<TransferDto> {
    const ctx = inventoryContext(P.create)
    await mockDelay()
    const existing = req.clientRequestId ? transfersDb.find((t) => t.clientRequestId === req.clientRequestId) : undefined
    if (existing) return transferToDto(existing, ctx)
    if (req.submit && !ctx.can(P.update)) throw forbidden()
    const at = nowIso()
    const doc: TransferRecord = {
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
    transfersDb.insert(doc)
    return transferToDto(doc, ctx)
  },

  async update(id: string, req: SaveTransferRequest): Promise<TransferDto> {
    const ctx = inventoryContext(P.update)
    await mockDelay()
    const doc = getVisible(id, ctx)
    const step = guardDocAction(doc, { version: req.version, clientRequestId: req.clientRequestId }, {
      allowed: ['Nhap', 'TuChoi'],
      userId: ctx.userId,
      ownerOnly: true,
      authorize: () => ctx.assertScope(doc.fromWarehouseId),
    })
    if (step === 'replay') return transferToDto(doc, ctx)
    Object.assign(doc, buildContent(req, ctx, !!req.submit))
    if (req.submit) markSubmitted(doc, nowIso())
    save(doc, req.clientRequestId)
    return transferToDto(doc, ctx)
  },

  async submit(id: string, req: DocActionRequest): Promise<TransferDto> {
    const ctx = inventoryContext(P.update)
    await mockDelay()
    const doc = getVisible(id, ctx)
    const step = guardDocAction(doc, req, {
      allowed: ['Nhap', 'TuChoi'],
      userId: ctx.userId,
      ownerOnly: true,
      authorize: () => ctx.assertScope(doc.fromWarehouseId),
    })
    if (step === 'replay') return transferToDto(doc, ctx)
    buildContent(toRequest(doc), ctx, true)
    markSubmitted(doc, nowIso())
    save(doc, req.clientRequestId)
    return transferToDto(doc, ctx)
  },

  async withdraw(id: string, req: DocActionRequest): Promise<TransferDto> {
    const ctx = inventoryContext(P.update)
    await mockDelay()
    const doc = getVisible(id, ctx)
    if (guardDocAction(doc, req, { allowed: ['ChoDuyet'], userId: ctx.userId, ownerOnly: true }) === 'replay')
      return transferToDto(doc, ctx)
    doc.status = 'Nhap'
    save(doc, req.clientRequestId)
    return transferToDto(doc, ctx)
  },

  async approve(id: string, req: DocActionRequest): Promise<TransferDto> {
    const ctx = inventoryContext(P.approve)
    await mockDelay()
    const doc = getVisible(id, ctx)
    const step = guardDocAction(doc, req, {
      allowed: ['ChoDuyet'],
      userId: ctx.userId,
      notOwner: true,
      authorize: () => ctx.assertScope(doc.fromWarehouseId),
    })
    if (step === 'replay') return transferToDto(doc, ctx)
    assertOnHand(doc.fromWarehouseId, doc.lines)
    assertNotLocked(doc.fromWarehouseId, doc.lines)
    const to = warehouseById(doc.toWarehouseId)
    const at = nowIso()
    withPosting(at, (posting) => {
      postTransferOut(doc, posting, `Chuyển đến ${to?.code} – ${to?.name}`)
      Object.assign(doc, { status: 'DangChuyen', approvedAt: at, approvedById: ctx.userId, approvedByName: ctx.fullName })
      save(doc, req.clientRequestId)
    })
    return transferToDto(doc, ctx)
  },

  async reject(id: string, req: RejectRequest): Promise<TransferDto> {
    const ctx = inventoryContext(P.approve)
    await mockDelay()
    const doc = getVisible(id, ctx)
    if (guardDocAction(doc, req, { allowed: ['ChoDuyet'], userId: ctx.userId, notOwner: true }) === 'replay')
      return transferToDto(doc, ctx)
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
    return transferToDto(doc, ctx)
  },

  async cancel(id: string, req: DocActionRequest): Promise<TransferDto> {
    const ctx = inventoryContext(P.delete)
    await mockDelay()
    const doc = getVisible(id, ctx)
    const step = guardDocAction(doc, req, {
      allowed: ['Nhap', 'TuChoi'],
      userId: ctx.userId,
      authorize: () => {
        if (doc.createdById !== ctx.userId && !ctx.can(P.approve)) throw inventoryErrors.khongPhaiNguoiLap()
      },
    })
    if (step === 'replay') return transferToDto(doc, ctx)
    Object.assign(doc, { status: 'DaHuy', cancelledAt: nowIso(), cancelledById: ctx.userId, cancelledByName: ctx.fullName })
    save(doc, req.clientRequestId)
    return transferToDto(doc, ctx)
  },

  /** Xác nhận nhận hàng tại kho đến (UC-06 bước 4, TC-18, TC-19) */
  async receive(id: string, req: ReceiveTransferRequest): Promise<TransferDto> {
    const ctx = inventoryContext(P.receive)
    await mockDelay()
    const doc = getVisible(id, ctx)
    const toCode = warehouseById(doc.toWarehouseId)?.code ?? ''
    const step = guardDocAction(
      { ...doc, approvedByName: doc.receivedByName ?? doc.approvedByName, approvedAt: doc.receivedAt ?? doc.approvedAt },
      req,
      {
        allowed: ['DangChuyen'],
        userId: ctx.userId,
        authorize: () => {
          if (!ctx.inScope(doc.toWarehouseId)) throw inventoryErrors.khongPhuTrachKho(toCode, true)
        },
      }
    )
    if (step === 'replay') return transferToDto(doc, ctx)
    const errors: FieldErrorMap = {}
    const received: Record<string, number> = {}
    const input = req.lines ?? []
    if (doc.lines.some((l) => !input.some((x) => x.lineId === l.id))) errors.lines = 'Nhập số thực nhận cho mọi dòng'
    doc.lines.forEach((l, i) => {
      const entry = input.find((x) => x.lineId === l.id)
      if (!entry) return
      const r = Number(entry.receivedBaseQuantity)
      if (!Number.isInteger(r) || r < 0 || r > l.baseQuantity) {
        errors[`lines[${i}].receivedBaseQuantity`] =
          `Không vượt số lượng chuyển ${formatNumber(l.baseQuantity, 0)} ${baseUnitWord(l.baseUnit)}`
      }
      received[l.id] = r
    })
    if (Object.keys(errors).length) throw fieldErrors(errors)
    assertNotLocked(
      doc.toWarehouseId,
      doc.lines.filter((l) => (received[l.id] ?? 0) > 0)
    )
    const from = warehouseById(doc.fromWarehouseId)
    const at = nowIso()
    withPosting(at, (posting) => {
      postTransferIn(doc, posting, received, `Nhận từ ${from?.code} – ${from?.name}`)
      Object.assign(doc, { status: 'DaNhan', receivedAt: at, receivedById: ctx.userId, receivedByName: ctx.fullName })
      save(doc, req.clientRequestId)
    })
    return transferToDto(doc, ctx)
  },
}
