'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PackagePlus } from 'lucide-react'
import { docStatusLabels, receiptTypeLabels } from '@/config/inventory-labels'
import { permissions } from '@/config/permissions'
import { routePath, routeTo } from '@/config/route-path'
import { DocStatusBadge } from '@/features/inventory/components/DocStatusBadge'
import { DocListShell } from '@/features/inventory/components/doc/DocListShell'
import { usePermissions } from '@/hooks/use-permissions'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import type { DocStatus, GoodsReceiptListItem, ReceiptType } from '@/types/inventory'
import { useGoodsReceipts } from '../hooks/use-goods-receipts'

const STATUSES: DocStatus[] = ['Nhap', 'ChoDuyet', 'TuChoi', 'DaDuyet', 'DaHuy']

/** SCR-05: danh sách phiếu nhập (FR-20) */
export function GoodsReceiptsPage() {
  const { can } = usePermissions()
  const columns = useMemo<ColumnDef<GoodsReceiptListItem>[]>(
    () => [
      {
        id: 'code',
        header: 'Mã phiếu',
        cell: ({ row }) => (
          <div className="leading-tight">
            <p className="font-medium tabular-nums">{row.original.code ?? <span className="text-muted-foreground">Nháp chưa gửi</span>}</p>
            <p className="text-muted-foreground text-xs">{formatDateTime(row.original.approvedAt ?? row.original.submittedAt ?? row.original.createdAt)}</p>
          </div>
        ),
      },
      { id: 'warehouse', header: 'Kho', cell: ({ row }) => <span className="font-medium">{row.original.warehouseCode}</span> },
      {
        id: 'type',
        header: 'Loại · Nhà cung cấp',
        cell: ({ row }) => (
          <div className="max-w-72 leading-tight">
            <p>{receiptTypeLabels[row.original.type]}</p>
            <p className="text-muted-foreground truncate text-xs">
              {row.original.supplierName ?? row.original.delivererName ?? row.original.note ?? ''}
              {row.original.sourceDocNo && ` · HĐ ${row.original.sourceDocNo}`}
            </p>
          </div>
        ),
      },
      {
        id: 'lineCount',
        header: 'Số dòng',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.lineCount, 0)}</span>,
      },
      {
        id: 'totalValue',
        header: 'Giá trị nhập kho',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) =>
          row.original.canViewValues ? (
            <span className="font-medium tabular-nums">{formatVnd(row.original.totalValue)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      { id: 'createdBy', header: 'Người lập', cell: ({ row }) => <span className="text-sm">{row.original.createdByName}</span> },
      { id: 'status', header: 'Trạng thái', cell: ({ row }) => <DocStatusBadge kind="doc" status={row.original.status} /> },
    ],
    []
  )
  return (
    <DocListShell
      title="Phiếu nhập"
      description="Nhận hàng nhà cung cấp, hàng bán bị trả lại, nhập khác. Tồn chỉ tăng khi phiếu được duyệt."
      icon={PackagePlus}
      newHref={can(permissions.goodsReceipts.create) ? routePath.goodsReceiptNew : null}
      newLabel="Lập phiếu nhập"
      statuses={STATUSES.map((s) => ({ value: s, label: docStatusLabels[s] }))}
      types={(Object.keys(receiptTypeLabels) as ReceiptType[]).map((t) => ({ value: t, label: receiptTypeLabels[t] }))}
      typeLabel="Loại nhập"
      useList={useGoodsReceipts as never}
      columns={columns}
      rowHref={(row) => routeTo.goodsReceipt(row.id)}
      searchPlaceholder="Mã phiếu, số hóa đơn, nhà cung cấp…"
    />
  )
}

