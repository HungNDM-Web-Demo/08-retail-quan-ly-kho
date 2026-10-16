import { mockDb } from '@/mock/mock-db'
import type { SeedAnchorRecord } from './records'
import { demoDataFile, loadSeed, type SeedResult } from './seed-loader'

/**
 * Mốc nạp seed và kho lịch sử trong bộ nhớ (07 §4.8, quyết định 35).
 * - `inventory-anchor` (mock-db): thời điểm nạp seed; mọi collection và kho lịch sử tính theo cùng mốc này nên
 *   tồn trong mock-db luôn khớp thẻ kho dựng lại mỗi lần tải trang.
 * - Kho lịch sử (phiếu đã kết thúc, 3.484 dòng thẻ kho của seed) dựng lại một lần mỗi lần tải trang, không ghi
 *   localStorage, **chỉ đọc**: không sửa trực tiếp bản ghi trả về (muốn đổi thì chép sang mock-db cùng id).
 */

// Sửa demo-data.json là trình duyệt tự bỏ dữ liệu mẫu cũ (MockDb.registerSeed)
mockDb.registerSeed('demo-data', demoDataFile)

const floorMinute = (ms: number) => Math.floor(ms / 60_000) * 60_000

export const seedAnchorDb = mockDb.collection<SeedAnchorRecord>('inventory-anchor', () => [
  { id: 'anchor', now: floorMinute(Date.now()) },
])

let cache: { now: number; result: SeedResult } | null = null

/** Mốc nạp seed hiện tại (ms) */
export function seedAnchor(): number {
  return seedAnchorDb.get('anchor')?.now ?? floorMinute(Date.now())
}

/** Kết quả nạp seed theo mốc hiện tại (tính một lần, khoảng 30 ms) */
export function seedData(): SeedResult {
  const now = seedAnchor()
  if (!cache || cache.now !== now) cache = { now, result: loadSeed(now) }
  return cache.result
}

/** Phiếu đã kết thúc của seed (chỉ đọc) */
export function historyDocs() {
  const { receipts, issues, transfers, stocktakes } = seedData().history
  return { receipts, issues, transfers, stocktakes }
}

/** Dòng thẻ kho của seed (chỉ đọc) */
export function historyLedger() {
  return seedData().history.ledger
}

mockDb.onReset(() => {
  cache = null
})
