import { issueTypeLabels, receiptTypeLabels } from '@/config/inventory-labels'
import { goodsIssueService } from '@/features/goods-issues/services/goods-issue.service'
import { goodsReceiptService } from '@/features/goods-receipts/services/goods-receipt.service'
import { vnDdMmYyyy } from '@/features/inventory/lib/vn-time'
import type { GoodsIssueDto, GoodsReceiptDto } from '@/types/inventory'
import { displayDateKey, type DateRange } from './date-range'
import { excelSheet, type ExcelColumn, type ExcelSheet } from './export-excel'

/**
 * "Xuất dữ liệu kế toán" giả lập (SRS §2.4, P3; 07 §4.6): hai trang Phiếu nhập, Phiếu xuất đã duyệt trong kỳ, mỗi
 * dòng phiếu một dòng (mã, ngày ghi sổ, kho, loại, đối tác, mã hàng, tên, ĐVT, số lượng, đơn giá, thành tiền).
 * Lấy từ `GET /api/goods-receipts`, `GET /api/goods-issues` (lặp trang 100) và chi tiết phiếu. Không gửi đi đâu.
 */

const PAGE = 100
const CONCURRENCY = 12

async function allPages<T>(fetch: (page: number) => Promise<{ items: T[]; hasNextPage: boolean }>): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; page < 200; page++) {
    const res = await fetch(page)
    out.push(...res.items)
    if (!res.hasNextPage) break
  }
  return out
}

async function mapLimited<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const result: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        result[i] = await fn(items[i])
      }
    })
  )
  return result
}

type Line = {
  code: string
  postedAt: string
  warehouse: string
  type: string
  partner: string
  productCode: string
  productName: string
  unit: string
  quantity: number
  unitPrice?: number
  amount?: number
}

const COLUMNS: ExcelColumn<Line>[] = [
  { header: 'Số phiếu', value: (l) => l.code, width: 14 },
  { header: 'Ngày ghi sổ', value: (l) => l.postedAt, width: 12 },
  { header: 'Kho', value: (l) => l.warehouse, width: 8 },
  { header: 'Loại', value: (l) => l.type, width: 18 },
  { header: 'Đối tác', value: (l) => l.partner, width: 32 },
  { header: 'Mã hàng', value: (l) => l.productCode, width: 14 },
  { header: 'Tên hàng', value: (l) => l.productName, width: 40 },
  { header: 'ĐVT', value: (l) => l.unit, width: 10 },
  { header: 'Số lượng', value: (l) => l.quantity, width: 10 },
  { header: 'Đơn giá', value: (l) => l.unitPrice, width: 14 },
  { header: 'Thành tiền', value: (l) => l.amount, width: 16 },
]

function receiptLines(r: GoodsReceiptDto): Line[] {
  return r.lines.map((l) => ({
    code: r.code ?? '',
    postedAt: r.approvedAt ? vnDdMmYyyy(r.approvedAt) : '',
    warehouse: r.warehouseCode,
    type: receiptTypeLabels[r.type],
    partner: r.supplierName ?? r.delivererName ?? '',
    productCode: l.productCode,
    productName: l.productName,
    unit: l.unitName,
    quantity: l.quantity,
    unitPrice: l.landedUnitPrice,
    amount: l.value,
  }))
}

function issueLines(i: GoodsIssueDto): Line[] {
  return i.lines.map((l) => ({
    code: i.code ?? '',
    postedAt: i.approvedAt ? vnDdMmYyyy(i.approvedAt) : '',
    warehouse: i.warehouseCode,
    type: issueTypeLabels[i.type],
    partner: i.recipientName ?? i.supplierName ?? i.reason ?? '',
    productCode: l.productCode,
    productName: l.productName,
    unit: l.unitName,
    quantity: l.quantity,
    unitPrice: l.unitCost !== undefined && l.unitCost !== null ? l.unitCost * l.factor : undefined,
    amount: l.value,
  }))
}

export async function buildAccountingSheets(range: DateRange, warehouseId: string | undefined, scopeText: string): Promise<ExcelSheet[]> {
  const base = { status: 'DaDuyet' as const, from: range.from, to: range.to, warehouseId, pageSize: PAGE }
  const [receipts, issues] = await Promise.all([
    allPages((page) => goodsReceiptService.getList({ ...base, page })),
    allPages((page) => goodsIssueService.getList({ ...base, page })),
  ])
  const [rDetails, iDetails] = await Promise.all([
    mapLimited(receipts, (r) => goodsReceiptService.getById(r.id)),
    mapLimited(issues, (i) => goodsIssueService.getById(i.id)),
  ])
  const byPosted = <T extends { approvedAt?: string; code?: string }>(a: T, b: T) =>
    (a.approvedAt ?? '').localeCompare(b.approvedAt ?? '') || (a.code ?? '').localeCompare(b.code ?? '')
  const filters = `Kỳ ${displayDateKey(range.from)} – ${displayDateKey(range.to)} · ${scopeText} · Tệp mẫu để nhập vào phần mềm kế toán, không gửi đi đâu`
  return [
    excelSheet('Phiếu nhập', 'PHIẾU NHẬP ĐÃ DUYỆT', filters, COLUMNS, rDetails.sort(byPosted).flatMap(receiptLines)),
    excelSheet('Phiếu xuất', 'PHIẾU XUẤT ĐÃ DUYỆT', filters, COLUMNS, iDetails.sort(byPosted).flatMap(issueLines)),
  ]
}
