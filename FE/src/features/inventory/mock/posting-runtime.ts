import { mockDb } from '@/mock/mock-db'
import { stockLevelsDb } from './catalog.store'
import { ledgerDb } from './documents.store'
import { emptyLevel, levelId, type LevelBook, type PostingContext } from './posting'
import type { LedgerRecord, StockLevelRecord } from './records'

/**
 * Ghi sổ lúc chạy (07 §4.8 "postDocument"): mở sổ dòng tồn trên mock-db, chạy hàm ghi sổ, rồi lưu dòng tồn đã đổi
 * và dòng thẻ kho mới trong một `mockDb.batch` (cùng lần lưu với việc đổi phiếu do người gọi làm trong `fn`).
 */
export function withPosting<T>(at: string, fn: (ctx: PostingContext) => T): T {
  return mockDb.batch(() => {
    const working = new Map<string, StockLevelRecord>()
    const book: LevelBook = {
      get(warehouseId, productId) {
        const id = levelId(warehouseId, productId)
        let level = working.get(id)
        if (!level) {
          level = stockLevelsDb.get(id) ?? emptyLevel(warehouseId, productId, id)
          working.set(id, level)
        }
        return level
      },
    }
    const ledger: LedgerRecord[] = []
    const result = fn({ book, at, ledger })
    for (const level of working.values()) {
      if (stockLevelsDb.get(level.id)) stockLevelsDb.update(level.id, level)
      else stockLevelsDb.insert(level)
    }
    if (ledger.length) ledgerDb.insertMany(ledger)
    return result
  })
}
