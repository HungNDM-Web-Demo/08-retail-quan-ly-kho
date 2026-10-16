import { roleCodes, permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { notFound } from '@/mock/mock-errors'
import { listQuery, newId } from '@/mock/mock-helpers'
import { rolesOfUser, usersDb } from '@/mock/system-data'
import type { PaginatedResult } from '@/types/api'
import type {
  CreateStocktakeRequest,
  DocActionRequest,
  ReturnStocktakeRequest,
  StocktakeDto,
  StocktakeListItem,
  StocktakeQuery,
  SubmitCountsRequest,
  SubmitStocktakeRequest,
} from '@/types/inventory'
import { varianceOf } from '@/features/inventory/lib/stock-rules'
import { inVnRange } from '@/features/inventory/lib/vn-time'
import {
  groupById,
  liveGroups,
  liveProducts,
  productById,
  stockLevel,
  stockLevelsDb,
  warehouseById,
} from '@/features/inventory/mock/catalog.store'
import { inventoryContext, scopedWarehouseFilter, type InventoryContext } from '@/features/inventory/mock/context'
import { docDate, stocktakeToDto, stocktakeToListItem } from '@/features/inventory/mock/doc-mappers'
import { guardDocAction, nowIso } from '@/features/inventory/mock/doc-guard'
import { checkWarehouse, type FieldErrorMap } from '@/features/inventory/mock/doc-lines'
import {
  allStocktakes,
  findStocktake,
  nextCodeFor,
  openStocktakeAt,
  stocktakesDb,
} from '@/features/inventory/mock/documents.store'
import { fieldErrors, inventoryErrors } from '@/features/inventory/mock/errors'
import { postStocktake } from '@/features/inventory/mock/posting'
import { withPosting } from '@/features/inventory/mock/posting-runtime'
import type { StocktakeLineRecord, StocktakeRecord } from '@/features/inventory/mock/records'

/**
 * Handler mock Kiểm kê (07 §2.9, §3.7, UC-11, BR-14 → BR-17): chốt sổ sách lúc tạo, đếm nhiều lượt (chống trùng
 * bằng `clientRequestId`), kiểm kê mù, nguyên nhân chênh lệch, trả lại đếm lại, duyệt cân bằng, hủy.
 * Lượt đếm không trễ giả (màn tablet cần nhanh, 07 §4.8).
 */

const P = permissions.stocktakes

function getScoped(id: string, ctx: InventoryContext): StocktakeRecord {
  const doc = findStocktake(id)
  if (!doc) throw notFound('Không tìm thấy phiếu kiểm kê.')
  ctx.assertScope(doc.warehouseId)
  return structuredClone(doc)
}

/** Mặt hàng thuộc phạm vi phiếu (nhóm hiện tại, quyết định 19) */
function inScope(doc: StocktakeRecord, productId: string): boolean {
  if (doc.scopeAll || doc.lines.some((l) => l.productId === productId)) return true
  const p = productById(productId)
  return !!p && doc.groupIds.includes(p.groupId)
}

/** Tính lại chênh lệch một dòng (BR-16) theo giá trị tồn hiện tại */
function refreshVariance(doc: StocktakeRecord, line: StocktakeLineRecord) {
  const v = varianceOf(line, stockLevel(doc.warehouseId, line.productId)?.stockValue ?? 0)
  line.difference = v?.difference ?? null
  line.differenceValue = v?.differenceValue ?? null
  line.differencePercent = v?.differencePercent ?? null
  line.reasonRequired = v?.reasonRequired ?? false
}

function totals(doc: StocktakeRecord) {
  doc.surplusValue = doc.lines.reduce((s, l) => s + Math.max(l.differenceValue ?? 0, 0), 0)
  doc.shortageValue = doc.lines.reduce((s, l) => s + Math.max(-(l.differenceValue ?? 0), 0), 0)
}

function save(doc: StocktakeRecord, requestId?: string, bumpVersion = true) {
  if (bumpVersion) doc.version += 1
  if (requestId) doc.lastRequestId = requestId
  doc.updatedAt = nowIso()
  if (stocktakesDb.get(doc.id)) stocktakesDb.update(doc.id, doc)
  else stocktakesDb.insert(doc)
}

export const stocktakeMock = {
  async getList(query: StocktakeQuery): Promise<PaginatedResult<StocktakeListItem>> {
    const ctx = inventoryContext(P.view)
    await mockDelay()
    const warehouseId = scopedWarehouseFilter(ctx, query.warehouseId)
    const items = allStocktakes().filter(
      (s) =>
        ctx.inScope(s.warehouseId) &&
        (!warehouseId || s.warehouseId === warehouseId) &&
        (!query.status || s.status === query.status) &&
        inVnRange(docDate(s), query.from, query.to)
    )
    const page = listQuery(items, query, {
      searchFields: ['code', 'note', 'counterName', (s) => warehouseById(s.warehouseId)?.code],
      defaultSortBy: 'createdAt',
    })
    return { ...page, items: page.items.map((s) => stocktakeToListItem(s, ctx)) }
  },

  async getById(id: string): Promise<StocktakeDto> {
    const ctx = inventoryContext(P.view)
    return stocktakeToDto(getScoped(id, ctx), ctx)
  },

  /** Tạo phiếu, chốt sổ sách (UC-11 bước 2) */
  async create(req: CreateStocktakeRequest): Promise<StocktakeDto> {
    const ctx = inventoryContext(P.create)
    await mockDelay()
    const existing = req.clientRequestId ? stocktakesDb.find((s) => s.clientRequestId === req.clientRequestId) : undefined
    if (existing) return stocktakeToDto(existing, ctx)
    const errors: FieldErrorMap = {}
    checkWarehouse(req.warehouseId, 'warehouseId', errors, ctx.assertScope)
    const wh = warehouseById(req.warehouseId)
    if (!req.scopeAll && !req.groupIds?.length) errors.groupIds = 'Chọn ít nhất một nhóm hàng'
    const counter = usersDb.get(req.counterId)
    const counterIsKeeper =
      !!counter &&
      !!wh?.keeperUserIds.includes(counter.id) &&
      rolesOfUser(counter).some((r) => r.code === roleCodes.staff)
    if (!counter || (req.counterId !== ctx.userId && !counterIsKeeper))
      errors.counterId = `Người đếm phải là thủ kho phụ trách kho ${wh?.code ?? ''}`
    if (Object.keys(errors).length) throw fieldErrors(errors)
    const open = openStocktakeAt(req.warehouseId)
    if (open) throw inventoryErrors.khoDaCoPhieuKiemKe(wh!.code, open.id, open.code)

    const groups = liveGroups()
    const order = new Map(groups.map((g, i) => [g.id, i]))
    const products = new Map(liveProducts().map((p) => [p.id, p]))
    const levels = stockLevelsDb
      .filter((l) => l.warehouseId === req.warehouseId && l.onHand !== 0)
      .map((l) => ({ l, p: products.get(l.productId) }))
      .filter((x) => x.p && (req.scopeAll || req.groupIds.includes(x.p.groupId)))
      .sort((a, b) => (order.get(a.p!.groupId) ?? 0) - (order.get(b.p!.groupId) ?? 0) || a.p!.code.localeCompare(b.p!.code))
    if (!levels.length) throw inventoryErrors.khongCoHangKiemKe()

    const at = nowIso()
    const doc: StocktakeRecord = {
      id: newId(),
      code: nextCodeFor('Stocktake', at),
      warehouseId: req.warehouseId,
      scopeAll: req.scopeAll,
      groupIds: req.scopeAll ? [] : [...req.groupIds],
      status: 'DangKiem',
      version: 1,
      snapshotAt: at,
      createdById: ctx.userId,
      createdByName: ctx.fullName,
      createdAt: at,
      updatedAt: at,
      counterId: counter!.id,
      counterName: counter!.fullName,
      counterIds: [],
      note: req.note?.trim() || undefined,
      clientRequestId: req.clientRequestId,
      lastRequestId: req.clientRequestId,
      countRequestIds: [],
      lines: levels.map(({ l, p }, i) => ({
        id: newId(),
        productId: p!.id,
        productCode: p!.code,
        productName: p!.name,
        groupId: p!.groupId,
        groupName: groupById(p!.groupId)?.name ?? '',
        baseUnit: p!.baseUnit,
        bookQuantity: l.onHand,
        bookCost: l.avgCost,
        countedQuantity: null,
        reasonRequired: false,
        needsRecount: false,
        isAdded: false,
        sortOrder: i + 1,
      })),
    }
    stocktakesDb.insert(doc)
    return stocktakeToDto(doc, ctx)
  },

  /** Lượt đếm (không cần version; cùng `clientRequestId` không cộng lần hai) */
  async submitCounts(id: string, req: SubmitCountsRequest): Promise<StocktakeDto> {
    const ctx = inventoryContext(P.count)
    const doc = getScoped(id, ctx)
    if (req.clientRequestId && doc.countRequestIds.includes(req.clientRequestId)) return stocktakeToDto(doc, ctx)
    if (doc.status !== 'DangKiem') throw inventoryErrors.trangThaiKhongHopLe(doc.status)
    const errors: FieldErrorMap = {}
    const at = nowIso()
    const entries = req.entries ?? []
    entries.forEach((e, i) => {
      const p = productById(e.productId)
      if (!p || p.isDeleted) {
        errors[`entries[${i}].productId`] = 'Mặt hàng không tồn tại'
        return
      }
      if (!inScope(doc, p.id)) throw inventoryErrors.ngoaiPhamViKiemKe(p.name, i)
      if (!Number.isInteger(e.quantity) || e.quantity < 0)
        errors[`entries[${i}].quantity`] = 'Số lượng phải là số nguyên không âm'
      if (e.unitId && !p.units.some((u) => u.id === e.unitId)) errors[`entries[${i}].unitId`] = 'Đơn vị không thuộc mặt hàng'
    })
    if (Object.keys(errors).length) throw fieldErrors(errors)
    for (const e of entries) {
      const p = productById(e.productId)!
      const factor = e.unitId ? (p.units.find((u) => u.id === e.unitId)?.factor ?? 1) : 1
      const b = e.quantity * factor
      let line = doc.lines.find((l) => l.productId === p.id)
      if (!line) {
        line = {
          id: newId(),
          productId: p.id,
          productCode: p.code,
          productName: p.name,
          groupId: p.groupId,
          groupName: groupById(p.groupId)?.name ?? '',
          baseUnit: p.baseUnit,
          bookQuantity: 0,
          bookCost: stockLevel(doc.warehouseId, p.id)?.avgCost ?? 0,
          countedQuantity: null,
          reasonRequired: false,
          needsRecount: false,
          isAdded: true,
          sortOrder: doc.lines.reduce((m, l) => Math.max(m, l.sortOrder), 0) + 1,
        }
        doc.lines.push(line)
      }
      line.countedQuantity = e.mode === 'Cong' ? (line.countedQuantity ?? 0) + b : b
      line.needsRecount = false
      line.lastCountedById = ctx.userId
      line.lastCountedByName = ctx.fullName
      line.lastCountedAt = at
      refreshVariance(doc, line)
    }
    if (!doc.counterIds.includes(ctx.userId)) doc.counterIds.push(ctx.userId)
    if (req.clientRequestId) doc.countRequestIds = [...doc.countRequestIds.slice(-199), req.clientRequestId]
    totals(doc)
    // Lượt đếm không tăng version (07 §5 quyết định BE): nhiều máy đếm song song không làm lệch thao tác gửi duyệt
    save(doc, undefined, false)
    return stocktakeToDto(doc, ctx)
  },

  /** Điền số đếm = sổ sách cho dòng chưa đếm (BR-16, TC-27 bước 3) */
  async fillUncounted(id: string, req: DocActionRequest): Promise<StocktakeDto> {
    const ctx = inventoryContext(P.count)
    await mockDelay(100, 200)
    const doc = getScoped(id, ctx)
    if (guardDocAction(doc, req, { allowed: ['DangKiem'], userId: ctx.userId }) === 'replay')
      return stocktakeToDto(doc, ctx)
    const at = nowIso()
    for (const line of doc.lines) {
      if (line.countedQuantity != null) continue
      line.countedQuantity = line.bookQuantity
      line.needsRecount = false
      line.lastCountedById = ctx.userId
      line.lastCountedByName = ctx.fullName
      line.lastCountedAt = at
      refreshVariance(doc, line)
    }
    if (!doc.counterIds.includes(ctx.userId)) doc.counterIds.push(ctx.userId)
    totals(doc)
    save(doc, req.clientRequestId)
    return stocktakeToDto(doc, ctx)
  },

  /** Gửi duyệt (UC-11 bước 5–6): đủ dòng đã đếm, đủ nguyên nhân cho dòng chênh lớn */
  async submit(id: string, req: SubmitStocktakeRequest): Promise<StocktakeDto> {
    const ctx = inventoryContext(P.count)
    await mockDelay()
    const doc = getScoped(id, ctx)
    if (guardDocAction(doc, req, { allowed: ['DangKiem'], userId: ctx.userId }) === 'replay')
      return stocktakeToDto(doc, ctx)
    const uncounted = doc.lines.filter((l) => l.countedQuantity == null).map((l) => l.id)
    if (uncounted.length) throw inventoryErrors.conDongChuaDem(uncounted)
    const errors: FieldErrorMap = {}
    ;(req.reasons ?? []).forEach((r, i) => {
      const line = doc.lines.find((l) => l.id === r.lineId)
      if (!line) return
      if (r.reason === 'Khac' && !r.note?.trim()) errors[`reasons[${i}].note`] = 'Nhập ghi chú cho nguyên nhân Khác'
      line.reason = r.reason
      line.reasonNote = r.note?.trim() || null
    })
    if (Object.keys(errors).length) throw fieldErrors(errors)
    for (const line of doc.lines) refreshVariance(doc, line)
    const missing = doc.lines.filter((l) => l.reasonRequired && !l.reason)
    if (missing.length) {
      throw inventoryErrors.thieuNguyenNhan(
        missing.map((l) => ({
          lineId: l.id,
          productName: l.productName,
          difference: l.difference ?? 0,
          differencePercent: l.differencePercent,
          differenceValue: ctx.canViewValues ? l.differenceValue : undefined,
        }))
      )
    }
    totals(doc)
    Object.assign(doc, { status: 'ChoDuyet', submittedAt: nowIso(), submittedById: ctx.userId, submittedByName: ctx.fullName })
    if (!doc.counterIds.includes(ctx.userId)) doc.counterIds.push(ctx.userId)
    save(doc, req.clientRequestId)
    return stocktakeToDto(doc, ctx)
  },

  /** Duyệt cân bằng (BR-17): người duyệt khác người đếm */
  async approve(id: string, req: DocActionRequest): Promise<StocktakeDto> {
    const ctx = inventoryContext(P.approve)
    await mockDelay()
    const doc = getScoped(id, ctx)
    const step = guardDocAction(doc, req, {
      allowed: ['ChoDuyet'],
      userId: ctx.userId,
      notUsers: [doc.counterId, ...doc.counterIds],
      stocktake: true,
    })
    if (step === 'replay') return stocktakeToDto(doc, ctx)
    for (const line of doc.lines) refreshVariance(doc, line)
    totals(doc)
    const at = nowIso()
    withPosting(at, (posting) => {
      postStocktake(doc, posting)
      Object.assign(doc, { status: 'DaCanBang', approvedAt: at, approvedById: ctx.userId, approvedByName: ctx.fullName })
      save(doc, req.clientRequestId)
    })
    return stocktakeToDto(doc, ctx)
  },

  /** Trả lại đếm lại (UC-11 7a, quyết định 23) */
  async returnForRecount(id: string, req: ReturnStocktakeRequest): Promise<StocktakeDto> {
    const ctx = inventoryContext(P.approve)
    await mockDelay()
    const doc = getScoped(id, ctx)
    if (guardDocAction(doc, req, { allowed: ['ChoDuyet'], userId: ctx.userId }) === 'replay')
      return stocktakeToDto(doc, ctx)
    const errors: FieldErrorMap = {}
    const ids = new Set(req.lineIds ?? [])
    if (!doc.lines.some((l) => ids.has(l.id))) errors.lineIds = 'Chọn ít nhất một dòng cần đếm lại'
    const note = req.note?.trim() ?? ''
    if (!note) errors.note = 'Nhập ghi chú cho người đếm'
    if (Object.keys(errors).length) throw fieldErrors(errors)
    for (const line of doc.lines) {
      if (!ids.has(line.id)) continue
      Object.assign(line, {
        needsRecount: true,
        recountNote: note,
        countedQuantity: null,
        reason: null,
        reasonNote: null,
        difference: null,
        differenceValue: null,
        differencePercent: null,
        reasonRequired: false,
      })
    }
    totals(doc)
    Object.assign(doc, { status: 'DangKiem', returnNote: note })
    save(doc, req.clientRequestId)
    return stocktakeToDto(doc, ctx)
  },

  /** Hủy phiếu chưa duyệt: không điều chỉnh, mở khóa (FR-31, TC-29) */
  async cancel(id: string, req: DocActionRequest): Promise<StocktakeDto> {
    const ctx = inventoryContext(P.cancel)
    await mockDelay()
    const doc = getScoped(id, ctx)
    if (guardDocAction(doc, req, { allowed: ['DangKiem', 'ChoDuyet'], userId: ctx.userId }) === 'replay')
      return stocktakeToDto(doc, ctx)
    Object.assign(doc, { status: 'DaHuy', cancelledAt: nowIso(), cancelledById: ctx.userId, cancelledByName: ctx.fullName })
    save(doc, req.clientRequestId)
    return stocktakeToDto(doc, ctx)
  },
}

