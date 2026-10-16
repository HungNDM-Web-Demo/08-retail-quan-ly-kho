import { varianceReasonLabels } from '@/config/inventory-labels'
import { stableId } from '@/mock/mock-helpers'
import type { LedgerDocType } from '@/types/inventory'
import { applyAdjust, applyIn, applyOut } from '../lib/costing'
import { baseUnitWord } from '../lib/uom'
import type {
  GoodsIssueRecord,
  GoodsReceiptRecord,
  LedgerRecord,
  StockLevelRecord,
  StocktakeRecord,
  TransferRecord,
} from './records'

/**
 * Ghi sổ (BR-11, 06 §3 "Ghi sổ"): chỗ duy nhất đổi tồn ở chế độ mock, dùng cho cả nạp seed (06 §5.5) và duyệt
 * phiếu lúc chạy. Áp đúng 07 §3.3–3.7 cho từng dòng theo `lineNo`; mỗi dòng sinh một dòng thẻ kho.
 * Hàm sửa trực tiếp phiếu (giá vốn, giá trị dòng, tổng) và dòng tồn lấy từ `book`; người gọi tự lưu.
 * Không kiểm quy tắc (tồn thực, khóa kiểm kê): handler kiểm cả phiếu trước khi gọi.
 */

/** Sổ dòng tồn đang làm việc: trả bản có thể sửa, tạo mới (tồn 0) nếu chưa có */
export interface LevelBook {
  get(warehouseId: string, productId: string): StockLevelRecord
}

export type PostingContext = {
  book: LevelBook
  /** Thời điểm ghi sổ (ISO) */
  at: string
  /** Nơi nhận dòng thẻ kho mới */
  ledger: LedgerRecord[]
}

export const levelId = (warehouseId: string, productId: string) => stableId('stock-level', warehouseId, productId)

/** Dòng tồn rỗng khi mặt hàng lần đầu có phát sinh tại kho (06 §4 Inventory_StockLevels) */
export function emptyLevel(warehouseId: string, productId: string, id = levelId(warehouseId, productId)): StockLevelRecord {
  return {
    id,
    warehouseId,
    productId,
    onHand: 0,
    stockValue: 0,
    avgCost: 0,
    minQty: null,
    maxQty: null,
    lastIssueAt: null,
    firstReceiptAt: null,
    version: 1,
  }
}

/** Sổ trong bộ nhớ (nạp seed, thử trước khi ghi) */
export function createMemoryBook(levels: StockLevelRecord[]): LevelBook & { levels: Map<string, StockLevelRecord> } {
  const levels$ = new Map(levels.map((l) => [`${l.warehouseId}|${l.productId}`, l]))
  return {
    levels: levels$,
    get(warehouseId, productId) {
      const key = `${warehouseId}|${productId}`
      let level = levels$.get(key)
      if (!level) {
        level = emptyLevel(warehouseId, productId)
        levels$.set(key, level)
      }
      return level
    },
  }
}

type LedgerSeed = Pick<
  LedgerRecord,
  'warehouseId' | 'productId' | 'seq' | 'docType' | 'docKind' | 'docId' | 'docCode' | 'docLineId' | 'description'
> &
  Partial<Pick<LedgerRecord, 'subType' | 'counterpartWarehouseId'>>

function pushLedger(
  ctx: PostingContext,
  level: StockLevelRecord,
  seed: LedgerSeed,
  move: { inQuantity: number; outQuantity: number; unitCost: number; inValue: number; outValue: number }
) {
  ctx.ledger.push({
    id: stableId('ledger', seed.docId, seed.docType, seed.seq),
    postedAt: ctx.at,
    subType: null,
    counterpartWarehouseId: null,
    ...seed,
    ...move,
    balanceQuantity: level.onHand,
    balanceValue: level.stockValue,
    avgCostAfter: level.avgCost,
  })
}

function touch(level: StockLevelRecord) {
  level.version += 1
}

/** Duyệt phiếu nhập (BR-09): dòng đã có `value` (gồm chi phí phân bổ, BR-08) */
export function postReceipt(doc: GoodsReceiptRecord, ctx: PostingContext, description: string) {
  for (const line of [...doc.lines].sort((a, b) => a.lineNo - b.lineNo)) {
    const level = ctx.book.get(doc.warehouseId, line.productId)
    const r = applyIn(level, line.baseQuantity, line.value)
    level.firstReceiptAt ??= ctx.at
    touch(level)
    pushLedger(
      ctx,
      level,
      {
        warehouseId: doc.warehouseId,
        productId: line.productId,
        seq: line.lineNo,
        docType: 'PhieuNhap',
        docKind: 'GoodsReceipt',
        docId: doc.id,
        docCode: doc.code ?? '',
        docLineId: line.id,
        description,
        subType: doc.type,
      },
      { inQuantity: line.baseQuantity, outQuantity: 0, unitCost: r.unitCost, inValue: line.value, outValue: 0 }
    )
  }
}

/** Duyệt phiếu xuất (BR-10): ghi giá vốn, giá trị vào dòng và tổng phiếu */
export function postIssue(doc: GoodsIssueRecord, ctx: PostingContext, description: string) {
  const countsAsIssue = doc.type === 'XuatBan' || doc.type === 'DungNoiBo'
  let total = 0
  for (const line of [...doc.lines].sort((a, b) => a.lineNo - b.lineNo)) {
    const level = ctx.book.get(doc.warehouseId, line.productId)
    const r = applyOut(level, line.baseQuantity)
    line.unitCost = r.unitCost
    line.value = r.value
    total += r.value
    if (countsAsIssue) level.lastIssueAt = ctx.at
    touch(level)
    pushLedger(
      ctx,
      level,
      {
        warehouseId: doc.warehouseId,
        productId: line.productId,
        seq: line.lineNo,
        docType: 'PhieuXuat',
        docKind: 'GoodsIssue',
        docId: doc.id,
        docCode: doc.code ?? '',
        docLineId: line.id,
        description,
        subType: doc.type,
      },
      { inQuantity: 0, outQuantity: line.baseQuantity, unitCost: r.unitCost, inValue: 0, outValue: r.value }
    )
  }
  doc.totalValue = total
}

/** Duyệt phiếu chuyển (BR-13): xuất khỏi kho đi, ghi giá vốn chuyển */
export function postTransferOut(doc: TransferRecord, ctx: PostingContext, description: string) {
  let total = 0
  for (const line of [...doc.lines].sort((a, b) => a.lineNo - b.lineNo)) {
    const level = ctx.book.get(doc.fromWarehouseId, line.productId)
    const r = applyOut(level, line.baseQuantity)
    line.unitCost = r.unitCost
    line.value = r.value
    total += r.value
    level.lastIssueAt = ctx.at
    touch(level)
    pushLedger(
      ctx,
      level,
      {
        warehouseId: doc.fromWarehouseId,
        productId: line.productId,
        seq: line.lineNo,
        docType: 'ChuyenDi',
        docKind: 'Transfer',
        docId: doc.id,
        docCode: doc.code ?? '',
        docLineId: line.id,
        description,
        counterpartWarehouseId: doc.toWarehouseId,
      },
      { inQuantity: 0, outQuantity: line.baseQuantity, unitCost: r.unitCost, inValue: 0, outValue: r.value }
    )
  }
  doc.totalValue = total
}

/**
 * Nhận hàng chuyển (BR-13): cộng số thực nhận vào kho đến theo giá vốn chuyển; hao hụt ghi ở dòng phiếu,
 * không vào thẻ kho (quyết định 31). `received` theo id dòng, mặc định nhận đủ.
 */
export function postTransferIn(
  doc: TransferRecord,
  ctx: PostingContext,
  received: Record<string, number>,
  description: string
) {
  let shortageTotal = 0
  for (const line of [...doc.lines].sort((a, b) => a.lineNo - b.lineNo)) {
    const r = received[line.id] ?? line.baseQuantity
    const unitCost = line.unitCost ?? 0
    const shortage = line.baseQuantity - r
    line.receivedBaseQuantity = r
    line.shortageQuantity = shortage
    line.shortageValue = shortage * unitCost
    shortageTotal += line.shortageValue
    if (r <= 0) continue
    const level = ctx.book.get(doc.toWarehouseId, line.productId)
    const v = r * unitCost
    applyIn(level, r, v)
    level.firstReceiptAt ??= ctx.at
    touch(level)
    pushLedger(
      ctx,
      level,
      {
        warehouseId: doc.toWarehouseId,
        productId: line.productId,
        seq: line.lineNo,
        docType: 'ChuyenDen',
        docKind: 'Transfer',
        docId: doc.id,
        docCode: doc.code ?? '',
        docLineId: line.id,
        description: shortage > 0 ? `${description} (thiếu ${shortage} ${baseUnitWord(line.baseUnit)})` : description,
        counterpartWarehouseId: doc.fromWarehouseId,
      },
      { inQuantity: r, outQuantity: 0, unitCost, inValue: v, outValue: 0 }
    )
  }
  doc.shortageValue = shortageTotal
}

/**
 * Duyệt kiểm kê (BR-17): dòng chênh ≠ 0 theo `sortOrder`: tồn ← số đếm, giá trị ± |chênh|, giá vốn giữ nguyên;
 * thẻ kho loại Điều chỉnh kiểm kê (thừa ghi nhập, thiếu ghi xuất, đơn giá = giá sổ sách).
 */
export function postStocktake(doc: StocktakeRecord, ctx: PostingContext) {
  for (const line of [...doc.lines].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const diff = (line.countedQuantity ?? line.bookQuantity) - line.bookQuantity
    if (diff === 0) continue
    const level = ctx.book.get(doc.warehouseId, line.productId)
    const value = applyAdjust(level, diff, line.bookCost)
    if (diff > 0) level.firstReceiptAt ??= ctx.at
    touch(level)
    const docType: LedgerDocType = 'KiemKe'
    pushLedger(
      ctx,
      level,
      {
        warehouseId: doc.warehouseId,
        productId: line.productId,
        seq: line.sortOrder,
        docType,
        docKind: 'Stocktake',
        docId: doc.id,
        docCode: doc.code,
        docLineId: line.id,
        description: `Điều chỉnh kiểm kê ${doc.code} – ${
          line.reason ? varianceReasonLabels[line.reason] : 'Chênh lệch kiểm kê'
        }`,
      },
      diff > 0
        ? { inQuantity: diff, outQuantity: 0, unitCost: line.bookCost, inValue: value, outValue: 0 }
        : { inQuantity: 0, outQuantity: -diff, unitCost: line.bookCost, inValue: 0, outValue: value }
    )
  }
}
