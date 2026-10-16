import { routePath, routeTo } from '@/config/route-path'
import type { DocKind } from '@/types/inventory'

/** Đường dẫn chi tiết phiếu theo loại (Phiếu chờ duyệt, Việc cần làm, thẻ kho) */
export function docPath(kind: DocKind, id: string): string {
  switch (kind) {
    case 'GoodsReceipt':
      return routeTo.goodsReceipt(id)
    case 'GoodsIssue':
      return routeTo.goodsIssue(id)
    case 'Transfer':
      return routeTo.transfer(id)
    case 'Stocktake':
      return routeTo.stocktake(id)
  }
}

/** Đường dẫn bản in theo loại; `autoPrint` thêm `?print=1` để tự mở hộp in (07 §2.11) */
export function printPath(kind: DocKind, id: string, autoPrint = true): string {
  const path = {
    GoodsReceipt: routeTo.printGoodsReceipt,
    GoodsIssue: routeTo.printGoodsIssue,
    Transfer: routeTo.printTransfer,
    Stocktake: routeTo.printStocktake,
  }[kind](id)
  return autoPrint ? `${path}?print=1` : path
}

export type TransferDraftLine = { productId: string; baseQuantity: number }
export type TransferDraftParams = {
  fromWarehouseId: string
  toWarehouseId: string
  lines: TransferDraftLine[]
  /** clientRequestId của lần tạo; bỏ trống thì sinh mới (tải lại trang không tạo trùng) */
  rid?: string
}

const newRid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/**
 * `/transfers/new?fromWarehouseId&toWarehouseId&lines={productId}:{baseQuantity},…&rid={uuid}` (07 §4.3, TC-25):
 * trang tự tạo phiếu nháp rồi chuyển tới chi tiết.
 */
export function buildTransferDraftUrl({ fromWarehouseId, toWarehouseId, lines, rid }: TransferDraftParams): string {
  const params = new URLSearchParams({
    fromWarehouseId,
    toWarehouseId,
    lines: lines.map((l) => `${l.productId}:${l.baseQuantity}`).join(','),
    rid: rid ?? newRid(),
  })
  return `${routePath.transferNew}?${params.toString()}`
}

/** Đọc lại tham số do `buildTransferDraftUrl` dựng; thiếu kho hoặc dòng thì null */
export function parseTransferDraftParams(search: URLSearchParams): TransferDraftParams | null {
  const fromWarehouseId = search.get('fromWarehouseId')
  const toWarehouseId = search.get('toWarehouseId')
  const raw = search.get('lines')
  if (!fromWarehouseId || !toWarehouseId || !raw) return null
  const lines = raw
    .split(',')
    .map((part) => {
      const [productId, qty] = part.split(':')
      return { productId, baseQuantity: Number(qty) }
    })
    .filter((l) => l.productId && Number.isInteger(l.baseQuantity) && l.baseQuantity > 0)
  if (!lines.length) return null
  return { fromWarehouseId, toWarehouseId, lines, rid: search.get('rid') ?? undefined }
}
