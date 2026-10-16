import { issueTypeLabels, receiptTypeLabels } from '@/config/inventory-labels'
import demoData from '@/mock/seed/demo-data.json'
import { stableId } from '@/mock/mock-helpers'
import { systemSeed } from '@/mock/system-seed'
import { userIdOf } from '@/mock/system-data'
import type { DemoDataFile, TimeToken } from '@/types/inventory-seed'
import type { DocStatus, TransferStatus } from '@/types/inventory'
import { receiptLineTotals } from '../lib/costing'
import { docCodeAt, docPrefixes } from '../lib/doc-codes'
import { varianceOf } from '../lib/stock-rules'
import { addDaysKey, vnAt, vnDateKey } from '../lib/vn-time'
import {
  createMemoryBook,
  levelId,
  postIssue,
  postReceipt,
  postStocktake,
  postTransferIn,
  postTransferOut,
} from './posting'
import type {
  GoodsIssueRecord,
  GoodsReceiptRecord,
  LedgerRecord,
  ProductGroupRecord,
  ProductRecord,
  StockLevelRecord,
  StocktakeLineRecord,
  StocktakeRecord,
  SupplierRecord,
  TransferRecord,
  WarehouseRecord,
} from './records'

/**
 * Nạp demo-data.json theo 06 §5 (giống `replay()` của scripts/generate-documents.mjs và `DemoDataSeeder` BE):
 * dựng danh mục, phiếu, rồi ghi sổ lại mọi sự kiện theo thời gian bằng chính `posting.ts`.
 * Kết quả chia hai phần (07 §4.8): `open` (danh mục, dòng tồn, phiếu chưa kết thúc) vào mock-db; `history`
 * (phiếu đã kết thúc, thẻ kho) giữ trong bộ nhớ, không ghi localStorage.
 */

export const demoDataFile = demoData as unknown as DemoDataFile

export type SeedResult = {
  groups: ProductGroupRecord[]
  warehouses: WarehouseRecord[]
  suppliers: SupplierRecord[]
  products: ProductRecord[]
  levels: StockLevelRecord[]
  open: {
    receipts: GoodsReceiptRecord[]
    issues: GoodsIssueRecord[]
    transfers: TransferRecord[]
    stocktakes: StocktakeRecord[]
  }
  history: {
    receipts: GoodsReceiptRecord[]
    issues: GoodsIssueRecord[]
    transfers: TransferRecord[]
    stocktakes: StocktakeRecord[]
    ledger: LedgerRecord[]
  }
}

export const seedIds = {
  warehouse: (code: string) => stableId('warehouse', code),
  supplier: (code: string) => stableId('supplier', code),
  group: (code: string) => stableId('product-group', code),
  product: (code: string) => stableId('product', code),
  unit: (productCode: string, sortOrder: number) => stableId('product-unit', productCode, sortOrder),
  receipt: (key: string) => stableId('goods-receipt', key),
  issue: (key: string) => stableId('goods-issue', key),
  transfer: (key: string) => stableId('transfer', key),
  stocktake: (key: string) => stableId('stocktake', key),
}

const userName = (username: string) =>
  systemSeed.users.find((u) => u.username === username)?.fullName ?? username

const FINISHED_DOC: DocStatus[] = ['DaDuyet', 'DaHuy']
const FINISHED_TRANSFER: TransferStatus[] = ['DaNhan', 'DaHuy']

export function loadSeed(anchorNow: number): SeedResult {
  const data = demoDataFile
  const now = Math.floor(anchorNow / 60_000) * 60_000
  const today = vnDateKey(now)
  const at = (t: TimeToken): string => {
    if (typeof t === 'number') return new Date(now + t * 60_000).toISOString()
    const [d, hhmm] = t.split('@')
    return new Date(vnAt(addDaysKey(today, -Number(d)), hhmm)).toISOString()
  }
  const createdAt = new Date(now - 120 * 86_400_000).toISOString()

  // ───────────── Danh mục (06 §5.2)
  const groups: ProductGroupRecord[] = data.productGroups.map((g, i) => ({
    id: seedIds.group(g.code),
    code: g.code,
    name: g.name,
    color: g.color,
    isActive: true,
    sortOrder: (i + 1) * 10,
    createdAt,
  }))
  const groupByCode = new Map(groups.map((g) => [g.code, g]))
  const warehouses: WarehouseRecord[] = data.warehouses.map((w, i) => ({
    id: seedIds.warehouse(w.code),
    code: w.code,
    name: w.name,
    address: w.address,
    phone: w.phone,
    isActive: w.active ?? true,
    sortOrder: (i + 1) * 10,
    keeperUserIds: w.keepers.map(userIdOf),
    createdAt,
  }))
  const suppliers: SupplierRecord[] = data.suppliers.map((s) => ({
    id: seedIds.supplier(s.code),
    code: s.code,
    name: s.name,
    taxCode: s.taxCode,
    phone: s.phone,
    address: s.address,
    contactName: s.contactName,
    isActive: s.active ?? true,
    createdAt,
  }))
  const products: ProductRecord[] = data.products.map((p) => ({
    id: seedIds.product(p.code),
    code: p.code,
    name: p.name,
    groupId: seedIds.group(p.group),
    baseUnit: p.unit,
    barcode: p.barcode,
    spec: p.spec,
    imageUrl: `/seed/products/${p.image}.webp`,
    isActive: true,
    units: p.units.map(([name, factor, barcode], i) => ({
      id: seedIds.unit(p.code, i + 1),
      name,
      factor,
      barcode,
      sortOrder: i + 1,
    })),
    createdAt,
  }))
  const productByCode = new Map(products.map((p) => [p.code, p]))

  const levels: StockLevelRecord[] = []
  for (const p of data.products) {
    for (const [w, [min, max]] of Object.entries(p.stock)) {
      const wid = seedIds.warehouse(w)
      const pid = seedIds.product(p.code)
      levels.push({
        id: levelId(wid, pid),
        warehouseId: wid,
        productId: pid,
        onHand: 0,
        stockValue: 0,
        avgCost: 0,
        minQty: min,
        maxQty: max,
        lastIssueAt: null,
        firstReceiptAt: null,
        version: 1,
      })
    }
  }
  const book = createMemoryBook(levels)

  /** Đơn vị theo chỉ số 0 = cơ bản, 1 = units[0], 2 = units[1] */
  const unitOf = (code: string, idx: number) => {
    const product = productByCode.get(code)!
    if (idx === 0) return { product, unitId: undefined, unitName: product.baseUnit, factor: 1 }
    const u = product.units[idx - 1]
    return { product, unitId: u.id, unitName: u.name, factor: u.factor }
  }

  // ───────────── Mã chứng từ (06 §5.4 bước 3): theo (sb, vị trí trong mảng)
  const codeMap = new Map<string, string>()
  const assignCodes = (prefix: string, docs: { id: string; sb?: TimeToken }[], scope: string) => {
    const withSb = docs
      .map((d, index) => ({ d, index, t: d.sb !== undefined ? new Date(at(d.sb)).getTime() : null }))
      .filter((x) => x.t !== null)
      .sort((a, b) => a.t! - b.t! || a.index - b.index)
    const counters = new Map<string, number>()
    for (const { d, t } of withSb) {
      const day = vnDateKey(t!)
      const n = (counters.get(day) ?? 0) + 1
      counters.set(day, n)
      codeMap.set(`${scope}:${d.id}`, docCodeAt(prefix, day, n))
    }
  }
  assignCodes(docPrefixes.GoodsReceipt, data.receipts, 'R')
  assignCodes(docPrefixes.GoodsIssue, data.issues, 'I')
  assignCodes(docPrefixes.Transfer, data.transfers, 'T')
  assignCodes(
    docPrefixes.Stocktake,
    data.stocktakes.map((k) => ({ id: k.id, sb: k.cr })),
    'K'
  )

  type Base = {
    by: string
    cr: TimeToken
    sb?: TimeToken
    rj?: [TimeToken, string, string]
    sb2?: TimeToken
    ap?: [TimeToken, string]
    cx?: [TimeToken, string]
  }
  const common = (x: Base, code: string | undefined) => {
    const events = [x.cr, x.sb, x.rj?.[0], x.sb2, x.ap?.[0], x.cx?.[0]].filter((t) => t !== undefined)
    const times = events.map((t) => at(t as TimeToken)).sort()
    return {
      code,
      version: 1,
      createdById: userIdOf(x.by),
      createdByName: userName(x.by),
      createdAt: at(x.cr),
      updatedAt: times[times.length - 1],
      submittedAt: x.sb2 !== undefined ? at(x.sb2) : x.sb !== undefined ? at(x.sb) : undefined,
      approvedById: x.ap ? userIdOf(x.ap[1]) : undefined,
      approvedByName: x.ap ? userName(x.ap[1]) : undefined,
      approvedAt: x.ap ? at(x.ap[0]) : undefined,
      rejectedById: x.rj ? userIdOf(x.rj[1]) : undefined,
      rejectedByName: x.rj ? userName(x.rj[1]) : undefined,
      rejectedAt: x.rj ? at(x.rj[0]) : undefined,
      rejectReason: x.rj?.[2],
      cancelledById: x.cx ? userIdOf(x.cx[1]) : undefined,
      cancelledByName: x.cx ? userName(x.cx[1]) : undefined,
      cancelledAt: x.cx ? at(x.cx[0]) : undefined,
      clientRequestId: null,
      lastRequestId: null,
    }
  }
  const docStatus = (x: Base): DocStatus =>
    x.cx ? 'DaHuy' : x.ap ? 'DaDuyet' : x.rj && x.sb2 === undefined ? 'TuChoi' : x.sb !== undefined ? 'ChoDuyet' : 'Nhap'

  // ───────────── Phiếu nhập
  const receipts: GoodsReceiptRecord[] = data.receipts.map((r) => {
    const id = seedIds.receipt(r.id)
    const freight = r.f ?? 0
    const units = r.ln.map(([code, idx]) => unitOf(code, idx))
    const totals = receiptLineTotals(
      r.ln.map(([, , quantity, unitPrice], i) => ({ quantity, unitPrice, factor: units[i].factor })),
      freight
    )
    return {
      id,
      ...common(r, codeMap.get(`R:${r.id}`)),
      warehouseId: seedIds.warehouse(r.w),
      type: r.t,
      status: docStatus(r),
      supplierId: r.s ? seedIds.supplier(r.s) : undefined,
      delivererName: r.dl,
      sourceDocNo: r.inv?.[0],
      sourceDocDate: r.inv ? addDaysKey(today, -r.inv[1]) : undefined,
      note: r.nt,
      freightCost: freight,
      totalAmount: totals.totalAmount,
      totalValue: totals.totalValue,
      reversalOfId: r.rv ? seedIds.issue(r.rv) : undefined,
      lines: r.ln.map(([, , quantity, unitPrice], i) => ({
        id: stableId('goods-receipt-line', r.id, i + 1),
        lineNo: i + 1,
        productId: units[i].product.id,
        productCode: units[i].product.code,
        productName: units[i].product.name,
        baseUnit: units[i].product.baseUnit,
        unitId: units[i].unitId,
        unitName: units[i].unitName,
        factor: units[i].factor,
        quantity,
        baseQuantity: totals.lines[i].baseQuantity,
        unitPrice,
        amount: totals.lines[i].amount,
        allocatedCost: totals.lines[i].allocatedCost,
        value: totals.lines[i].value,
        landedUnitPrice: totals.lines[i].landedUnitPrice,
      })),
    }
  })

  // ───────────── Phiếu xuất
  const issues: GoodsIssueRecord[] = data.issues.map((x) => ({
    id: seedIds.issue(x.id),
    ...common(x, codeMap.get(`I:${x.id}`)),
    warehouseId: seedIds.warehouse(x.w),
    type: x.t,
    status: docStatus(x),
    recipientName: x.rc,
    supplierId: x.s ? seedIds.supplier(x.s) : undefined,
    orderRef: x.or,
    reason: x.why,
    reversalOfId: x.rv ? seedIds.receipt(x.rv) : undefined,
    lines: x.ln.map(([code, idx, quantity], i) => {
      const u = unitOf(code, idx)
      return {
        id: stableId('goods-issue-line', x.id, i + 1),
        lineNo: i + 1,
        productId: u.product.id,
        productCode: u.product.code,
        productName: u.product.name,
        baseUnit: u.product.baseUnit,
        unitId: u.unitId,
        unitName: u.unitName,
        factor: u.factor,
        quantity,
        baseQuantity: quantity * u.factor,
      }
    }),
  }))

  // ───────────── Phiếu chuyển
  const transfers: TransferRecord[] = data.transfers.map((t) => {
    const status: TransferStatus = t.cx
      ? 'DaHuy'
      : t.re
        ? 'DaNhan'
        : t.ap
          ? 'DangChuyen'
          : t.rj && t.sb2 === undefined
            ? 'TuChoi'
            : t.sb !== undefined
              ? 'ChoDuyet'
              : 'Nhap'
    const base = common(t, codeMap.get(`T:${t.id}`))
    return {
      id: seedIds.transfer(t.id),
      ...base,
      updatedAt: t.re && at(t.re[0]) > base.updatedAt ? at(t.re[0]) : base.updatedAt,
      fromWarehouseId: seedIds.warehouse(t.fw),
      toWarehouseId: seedIds.warehouse(t.tw),
      status,
      note: t.nt,
      receivedById: t.re ? userIdOf(t.re[1]) : undefined,
      receivedByName: t.re ? userName(t.re[1]) : undefined,
      receivedAt: t.re ? at(t.re[0]) : undefined,
      lines: t.ln.map(([code, idx, quantity], i) => {
        const u = unitOf(code, idx)
        return {
          id: stableId('transfer-line', t.id, i + 1),
          lineNo: i + 1,
          productId: u.product.id,
          productCode: u.product.code,
          productName: u.product.name,
          baseUnit: u.product.baseUnit,
          unitId: u.unitId,
          unitName: u.unitName,
          factor: u.factor,
          quantity,
          baseQuantity: quantity * u.factor,
        }
      }),
    }
  })

  // ───────────── Kiểm kê (dòng dựng lúc ghi sổ, 06 §5.4 bước 7)
  const stocktakes: StocktakeRecord[] = data.stocktakes.map((k) => {
    const status = k.ap ? 'DaCanBang' : k.cx ? 'DaHuy' : k.sb !== undefined ? 'ChoDuyet' : 'DangKiem'
    return {
      id: seedIds.stocktake(k.id),
      code: codeMap.get(`K:${k.id}`)!,
      warehouseId: seedIds.warehouse(k.w),
      scopeAll: k.sc === 'all',
      groupIds: k.sc === 'all' ? [] : k.sc.map((c) => seedIds.group(c)),
      status,
      version: 1,
      snapshotAt: at(k.cr),
      createdById: userIdOf(k.by),
      createdByName: userName(k.by),
      createdAt: at(k.cr),
      updatedAt: at(k.ap?.[0] ?? k.cx?.[0] ?? k.sb ?? k.cr),
      counterId: userIdOf(k.ct),
      counterName: userName(k.ct),
      counterIds: [userIdOf(k.ct)],
      submittedById: k.sb !== undefined ? userIdOf(k.ct) : undefined,
      submittedByName: k.sb !== undefined ? userName(k.ct) : undefined,
      submittedAt: k.sb !== undefined ? at(k.sb) : undefined,
      approvedById: k.ap ? userIdOf(k.ap[1]) : undefined,
      approvedByName: k.ap ? userName(k.ap[1]) : undefined,
      approvedAt: k.ap ? at(k.ap[0]) : undefined,
      cancelledById: k.cx ? userIdOf(k.cx[1]) : undefined,
      cancelledByName: k.cx ? userName(k.cx[1]) : undefined,
      cancelledAt: k.cx ? at(k.cx[0]) : undefined,
      clientRequestId: null,
      lastRequestId: null,
      countRequestIds: [],
      lines: [],
    }
  })

  const buildStocktakeLines = (k: DemoDataFile['stocktakes'][number], doc: StocktakeRecord) => {
    const scopeGroups = k.sc === 'all' ? null : new Set(k.sc)
    const lines: StocktakeLineRecord[] = []
    const candidates = data.products
      .filter((p) => (scopeGroups ? scopeGroups.has(p.group) : true))
      .map((p) => ({ p, level: book.levels.get(`${doc.warehouseId}|${seedIds.product(p.code)}`) }))
      .filter((x) => x.level && x.level.onHand !== 0)
      .sort(
        (a, b) =>
          groupByCode.get(a.p.group)!.sortOrder - groupByCode.get(b.p.group)!.sortOrder ||
          a.p.code.localeCompare(b.p.code)
      )
    candidates.forEach(({ p, level }, i) => {
      const diffRow = k.df.find((d) => d[0] === p.code)
      const counted = level!.onHand + (diffRow?.[1] ?? 0)
      const group = groupByCode.get(p.group)!
      const v = varianceOf({ bookQuantity: level!.onHand, bookCost: level!.avgCost, countedQuantity: counted }, level!.stockValue)!
      lines.push({
        id: stableId('stocktake-line', k.id, i + 1),
        productId: seedIds.product(p.code),
        productCode: p.code,
        productName: p.name,
        groupId: group.id,
        groupName: group.name,
        baseUnit: p.unit,
        bookQuantity: level!.onHand,
        bookCost: level!.avgCost,
        countedQuantity: counted,
        difference: v.difference,
        differenceValue: v.differenceValue,
        differencePercent: v.differencePercent,
        reasonRequired: v.reasonRequired,
        reason: diffRow?.[2] ?? null,
        reasonNote: diffRow?.[3] ?? null,
        needsRecount: false,
        recountNote: null,
        isAdded: false,
        lastCountedById: userIdOf(k.ct),
        lastCountedByName: userName(k.ct),
        lastCountedAt: k.sb !== undefined ? at(k.sb) : null,
        sortOrder: i + 1,
      })
    })
    doc.lines = lines
    doc.surplusValue = lines.reduce((s, l) => s + Math.max(l.differenceValue ?? 0, 0), 0)
    doc.shortageValue = lines.reduce((s, l) => s + Math.max(-(l.differenceValue ?? 0), 0), 0)
  }

  // ───────────── Ghi sổ lại theo thời gian (06 §5.5)
  const whName = (id: string) => warehouses.find((w) => w.id === id)!
  const supName = (id?: string) => (id ? suppliers.find((s) => s.id === id)?.name : undefined)
  type Ev = { t: number; run: () => void }
  const events: Ev[] = []
  const ledger: LedgerRecord[] = []
  const ctxAt = (iso: string) => ({ book, at: iso, ledger })

  receipts.forEach((r) => {
    if (r.status !== 'DaDuyet') return
    const reversalOf = r.reversalOfId ? issues.find((i) => i.id === r.reversalOfId) : undefined
    const desc = receiptDescription(r, reversalOf?.code, supName(r.supplierId))
    events.push({ t: Date.parse(r.approvedAt!), run: () => postReceipt(r, ctxAt(r.approvedAt!), desc) })
  })
  issues.forEach((x) => {
    if (x.status !== 'DaDuyet') return
    events.push({
      t: Date.parse(x.approvedAt!),
      run: () => {
        const reversalOf = x.reversalOfId ? receipts.find((r) => r.id === x.reversalOfId) : undefined
        postIssue(x, ctxAt(x.approvedAt!), issueDescription(x, reversalOf?.code, supName(x.supplierId)))
      },
    })
  })
  transfers.forEach((t) => {
    if (!t.approvedAt || t.status === 'DaHuy') return
    const to = whName(t.toWarehouseId)
    const from = whName(t.fromWarehouseId)
    events.push({
      t: Date.parse(t.approvedAt),
      run: () => postTransferOut(t, ctxAt(t.approvedAt!), `Chuyển đến ${to.code} – ${to.name}`),
    })
    if (t.receivedAt) {
      const src = data.transfers.find((s) => seedIds.transfer(s.id) === t.id)!
      const shorts = (src.re?.[2] ?? []) as [number, number][]
      events.push({
        t: Date.parse(t.receivedAt),
        run: () => {
          const received: Record<string, number> = {}
          t.lines.forEach((l, i) => {
            const s = shorts.find((x) => x[0] === i)
            received[l.id] = l.baseQuantity - (s ? s[1] : 0)
          })
          postTransferIn(t, ctxAt(t.receivedAt!), received, `Nhận từ ${from.code} – ${from.name}`)
        },
      })
    }
  })
  data.stocktakes.forEach((k, i) => {
    const doc = stocktakes[i]
    if (!doc.approvedAt) return
    events.push({
      t: Date.parse(doc.approvedAt),
      run: () => {
        buildStocktakeLines(k, doc)
        postStocktake(doc, ctxAt(doc.approvedAt!))
      },
    })
  })
  events.sort((a, b) => a.t - b.t)
  for (const e of events) e.run()
  // Kiểm kê chưa duyệt: chốt theo tồn cuối
  data.stocktakes.forEach((k, i) => {
    if (!stocktakes[i].approvedAt) buildStocktakeLines(k, stocktakes[i])
  })

  const split = <T extends { status: string }>(docs: T[], finished: string[]) => ({
    open: docs.filter((d) => !finished.includes(d.status)),
    done: docs.filter((d) => finished.includes(d.status)),
  })
  const r = split(receipts, FINISHED_DOC)
  const i = split(issues, FINISHED_DOC)
  const t = split(transfers, FINISHED_TRANSFER)
  const k = split(stocktakes, ['DaCanBang', 'DaHuy'])

  return {
    groups,
    warehouses,
    suppliers,
    products,
    levels: [...book.levels.values()],
    open: { receipts: r.open, issues: i.open, transfers: t.open, stocktakes: k.open },
    history: { receipts: r.done, issues: i.done, transfers: t.done, stocktakes: k.done, ledger },
  }
}

/** Diễn giải thẻ kho của phiếu xuất (07 §3.10) */
export function issueDescription(
  x: Pick<GoodsIssueRecord, 'type' | 'recipientName' | 'reason'>,
  reversalOfCode?: string,
  supplierName?: string
): string {
  if (x.type === 'XuatDieuChinh' && reversalOfCode) return `Xuất điều chỉnh – phiếu ngược của ${reversalOfCode}`
  const partner =
    x.type === 'XuatBan' ? x.recipientName : x.type === 'TraNhaCungCap' ? (supplierName ?? x.reason) : x.reason
  return [issueTypeLabels[x.type], partner].filter(Boolean).join(' – ')
}

/** Diễn giải thẻ kho của phiếu nhập (07 §3.10) */
export function receiptDescription(
  r: Pick<GoodsReceiptRecord, 'type' | 'delivererName' | 'note'>,
  reversalOfCode?: string,
  supplierName?: string
): string {
  if (r.type === 'NhapDieuChinh' && reversalOfCode) return `Nhập điều chỉnh – phiếu ngược của ${reversalOfCode}`
  return [receiptTypeLabels[r.type], supplierName ?? r.delivererName ?? r.note].filter(Boolean).join(' – ')
}
