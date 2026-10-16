'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeftRight, ArrowRight } from 'lucide-react'
import { transferStatusLabels } from '@/config/inventory-labels'
import { permissions } from '@/config/permissions'
import { routePath, routeTo } from '@/config/route-path'
import { DocStatusBadge } from '@/features/inventory/components/DocStatusBadge'
import { DocListShell } from '@/features/inventory/components/doc/DocListShell'
import { usePermissions } from '@/hooks/use-permissions'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import type { TransferListItem, TransferStatus } from '@/types/inventory'
import { useTransfers } from '../hooks/use-transfers'

const STATUSES: TransferStatus[] = ['Nhap', 'ChoDuyet', 'TuChoi', 'DangChuyen', 'DaNhan', 'DaHuy']

/** SCR-09: danh sách phiếu chuyển kho; lọc kho là kho đi hoặc kho đến */
export function TransfersPage() {
  const { can } = usePermissions()
  const columns = useMemo<ColumnDef<TransferListItem>[]>(
    () => [
      {
        id: 'code',
        header: 'Mã phiếu',
        cell: ({ row }) => (
          <div className="leading-tight">
            <p className="font-medium tabular-nums">{row.original.code ?? <span className="text-muted-foreground">Nháp chưa gửi</span>}</p>
            <p className="text-muted-foreground text-xs">
              {formatDateTime(row.original.receivedAt ?? row.original.approvedAt ?? row.original.submittedAt ?? row.original.createdAt)}
            </p>
          </div>
        ),
      },
      {
        id: 'route',
        header: 'Tuyến',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 font-medium">
            {row.original.fromWarehouseCode}
            <ArrowRight className="text-muted-foreground size-3.5" aria-label="tới" />
            {row.original.toWarehouseCode}
          </span>
        ),
      },
      { id: 'note', header: 'Ghi chú', cell: ({ row }) => <span className="text-muted-foreground line-clamp-1 max-w-64 text-sm">{row.original.note}</span> },
      {
        id: 'lineCount',
        header: 'Số dòng',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.lineCount, 0)}</span>,
      },
      {
        id: 'totalValue',
        header: 'Giá trị chuyển',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) =>
          row.original.canViewValues && row.original.totalValue != null ? (
            <div className="leading-tight tabular-nums">
              <p className="font-medium">{formatVnd(row.original.totalValue)}</p>
              {(row.original.shortageValue ?? 0) > 0 && (
                <p className="text-destructive text-xs">Hao hụt {formatVnd(row.original.shortageValue)}</p>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      { id: 'createdBy', header: 'Người lập', cell: ({ row }) => <span className="text-sm">{row.original.createdByName}</span> },
      {
        id: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => <DocStatusBadge kind="transfer" status={row.original.status} isLate={row.original.isLate} />,
      },
    ],
    []
  )
  return (
    <DocListShell
      title="Chuyển kho"
      description="Chuyển hàng giữa các kho: duyệt trừ kho đi, kho đến xác nhận số thực nhận; thiếu ghi hao hụt vận chuyển."
      icon={ArrowLeftRight}
      newHref={can(permissions.transfers.create) ? routePath.transferNew : null}
      newLabel="Lập phiếu chuyển"
      statuses={STATUSES.map((s) => ({ value: s, label: transferStatusLabels[s] }))}
      useList={useTransfers as never}
      columns={columns}
      rowHref={(row) => routeTo.transfer(row.id)}
      searchPlaceholder="Mã phiếu, mã kho, ghi chú…"
    />
  )
}
