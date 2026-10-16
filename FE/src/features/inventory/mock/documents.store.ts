import { mockDb } from '@/mock/mock-db'
import type { AvailabilityRow, DocKind, ReservationDto } from '@/types/inventory'
import { nextDocCode, docPrefixes } from '../lib/doc-codes'
import { vnDateKey } from '../lib/vn-time'
import { liveProducts, stockLevelsDb, warehouseById } from './catalog.store'
import { historyDocs, historyLedger, seedData } from './history.store'
import type {
  GoodsIssueRecord,
  GoodsReceiptRecord,
  LedgerRecord,
  StocktakeRecord,
  TransferRecord,
} from './records'

/**
 * Collection phiếu, thẻ kho (07 §4.8). Mock-db chỉ giữ phiếu chưa kết thúc của seed và mọi thứ tạo/đổi trong phiên
 * demo; lịch sử đã kết thúc ở kho bộ nhớ. Hàm `all*()` trả hợp hai nguồn (mock-db đè bản bộ nhớ cùng id).
 * Bản ghi lịch sử trả về là bản dùng chung: chỉ đọc, muốn sửa thì `structuredClone` rồi ghi vào mock-db.
 */

export const receiptsDb = mockDb.collection<GoodsReceiptRecord>('goods-receipts', () => seedData().open.receipts)
export const issuesDb = mockDb.collection<GoodsIssueRecord>('goods-issues', () => seedData().open.issues)
export const transfersDb = mockDb.collection<TransferRecord>('transfers', () => seedData().open.transfers)
export const stocktakesDb = mockDb.collection<StocktakeRecord>('stocktakes', () => seedData().open.stocktakes)
/** Dòng thẻ kho ghi trong phiên demo (dòng của seed ở kho bộ nhớ) */
export const ledgerDb = mockDb.collection<LedgerRecord>('stock-ledger', () => [])

function union<T extends { id: string }>(history: readonly T[], live: T[]): T[] {
  if (!live.length) return [...history]
  const liveIds = new Set(live.map((x) => x.id))
  return [...history.filter((x) => !liveIds.has(x.id)), ...live]
}

export const allReceipts = (): GoodsReceiptRecord[] => union(historyDocs().receipts, receiptsDb.all())
export const allIssues = (): GoodsIssueRecord[] => union(historyDocs().issues, issuesDb.all())
export const allTransfers = (): TransferRecord[] => union(historyDocs().transfers, transfersDb.all())
export const allStocktakes = (): StocktakeRecord[] => union(historyDocs().stocktakes, stocktakesDb.all())
/** Mọi dòng thẻ kho (seed + phiên demo), chưa sắp xếp */
export const allLedger = (): LedgerRecord[] => [...historyLedger(), ...ledgerDb.all()]

/** Tìm phiếu theo id ở mock-db rồi kho lịch sử */
export const findReceipt = (id: string) => receiptsDb.get(id) ?? historyDocs().receipts.find((x) => x.id === id)
export const findIssue = (id: string) => issuesDb.get(id) ?? historyDocs().issues.find((x) => x.id === id)
export const findTransfer = (id: string) => transfersDb.get(id) ?? historyDocs().transfers.find((x) => x.id === id)
export const findStocktake = (id: string) =>
  stocktakesDb.get(id) ?? historyDocs().stocktakes.find((x) => x.id === id)

/** Mã chứng từ kế tiếp (07 §3.12): số lớn nhất trên cả kho lịch sử và mock-db */
export function nextCodeFor(kind: DocKind, at: string | number = Date.now()): string {
  const codes =
    kind === 'GoodsReceipt'
      ? allReceipts().map((x) => x.code)
      : kind === 'GoodsIssue'
        ? allIssues().map((x) => x.code)
        : kind === 'Transfer'
          ? allTransfers().map((x) => x.code)
          : allStocktakes().map((x) => x.code)
  return nextDocCode(docPrefixes[kind], vnDateKey(at), codes)
}

// ───────────────────────── Giữ chỗ, khả dụng (07 §3.6)

type Holder = { kind: 'GoodsIssue' | 'Transfer'; doc: GoodsIssueRecord | TransferRecord }

/** Phiếu xuất, phiếu chuyển Chờ duyệt đang giữ chỗ tại kho (đều ở mock-db) */
function holdersAt(warehouseId: string, excludeDocId?: string): Holder[] {
  const result: Holder[] = []
  for (const doc of issuesDb.filter((x) => x.status === 'ChoDuyet' && x.warehouseId === warehouseId)) {
    if (doc.id !== excludeDocId) result.push({ kind: 'GoodsIssue', doc })
  }
  for (const doc of transfersDb.filter((x) => x.status === 'ChoDuyet' && x.fromWarehouseId === warehouseId)) {
    if (doc.id !== excludeDocId) result.push({ kind: 'Transfer', doc })
  }
  return result
}

/** Số chờ xuất theo mặt hàng tại kho; `excludeDocId` bỏ phần của chính phiếu đang mở */
export function reservedMap(warehouseId: string, excludeDocId?: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const { doc } of holdersAt(warehouseId, excludeDocId)) {
    for (const line of doc.lines) map.set(line.productId, (map.get(line.productId) ?? 0) + line.baseQuantity)
  }
  return map
}

/** Danh sách phiếu giữ chỗ một mặt hàng tại kho (UC-08 bước 4) → ReservationDto[] sắp `submittedAt` */
export function reservations(warehouseId: string, productId?: string): ReservationDto[] {
  const from = warehouseById(warehouseId)
  return holdersAt(warehouseId)
    .map(({ kind, doc }) => {
      const qty = doc.lines
        .filter((l) => !productId || l.productId === productId)
        .reduce((s, l) => s + l.baseQuantity, 0)
      const to = kind === 'Transfer' ? warehouseById((doc as TransferRecord).toWarehouseId) : undefined
      return {
        kind,
        docId: doc.id,
        docCode: doc.code,
        warehouseCode: from?.code ?? '',
        toWarehouseCode: to?.code,
        createdByName: doc.createdByName,
        submittedAt: doc.submittedAt ?? doc.createdAt,
        baseQuantity: qty,
      }
    })
    .filter((r) => r.baseQuantity > 0)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
}

/** Tồn thực, chờ xuất, khả dụng mọi dòng tồn của kho (`GET /api/stock-levels/available`) */
export function availability(warehouseId: string, excludeDocId?: string): AvailabilityRow[] {
  const reserved = reservedMap(warehouseId, excludeDocId)
  return stockLevelsDb
    .filter((l) => l.warehouseId === warehouseId)
    .map((l) => {
      const r = reserved.get(l.productId) ?? 0
      return { productId: l.productId, onHand: l.onHand, reserved: r, available: l.onHand - r }
    })
}

// ───────────────────────── Khóa kiểm kê (BR-14, quyết định 19)

/** Phiếu kiểm kê Đang kiểm / Chờ duyệt của kho (tối đa một) */
export function openStocktakeAt(warehouseId: string): StocktakeRecord | undefined {
  return stocktakesDb.find(
    (s) => s.warehouseId === warehouseId && (s.status === 'DangKiem' || s.status === 'ChoDuyet')
  )
}

/**
 * Phiếu kiểm kê đang khóa mặt hàng tại kho: có phiếu mở ở kho mà (toàn kho, hoặc nhóm hiện tại của mặt hàng thuộc
 * phạm vi, hoặc mặt hàng có dòng trong phiếu). Không khóa → undefined.
 */
export function activeStocktakeLock(warehouseId: string, productId: string): StocktakeRecord | undefined {
  const st = openStocktakeAt(warehouseId)
  if (!st) return undefined
  if (st.scopeAll || st.lines.some((l) => l.productId === productId)) return st
  const product = liveProducts().find((p) => p.id === productId)
  return product && st.groupIds.includes(product.groupId) ? st : undefined
}
