'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PackageMinus } from 'lucide-react'
import { docStatusLabels, issueTypeLabels } from '@/config/inventory-labels'
import { permissions } from '@/config/permissions'
import { routePath, routeTo } from '@/config/route-path'
import { DocStatusBadge } from '@/features/inventory/components/DocStatusBadge'
import { DocListShell } from '@/features/inventory/components/doc/DocListShell'
import { usePermissions } from '@/hooks/use-permissions'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import type { DocStatus, GoodsIssueListItem, IssueType } from '@/types/inventory'
import { useGoodsIssues } from '../hooks/use-goods-issues'

const STATUSES: DocStatus[] = ['Nhap', 'ChoDuyet', 'TuChoi', 'DaDuyet', 'DaHuy']

/** SCR-07: danh sách phiếu xuất (FR-20) */
export function GoodsIssuesPage() {
  const { can } = usePermissions()
  const columns = useMemo<ColumnDef<GoodsIssueListItem>[]>(
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
        header: 'Loại · Người nhận',
        cell: ({ row }) => (
          <div className="max-w-72 leading-tight">
            <p>{issueTypeLabels[row.original.type]}</p>
            <p className="text-muted-foreground truncate text-xs">
              {row.original.recipientName ?? row.original.supplierName ?? row.original.reason ?? ''}
              {row.original.orderRef && ` · ĐH ${row.original.orderRef}`}
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
        header: 'Giá trị xuất',
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
      title="Phiếu xuất"
      description="Xuất bán, trả nhà cung cấp, dùng nội bộ, xuất hủy. Gửi duyệt là giữ chỗ tồn; tồn chỉ giảm khi được duyệt."
      icon={PackageMinus}
      newHref={can(permissions.goodsIssues.create) ? routePath.goodsIssueNew : null}
      newLabel="Lập phiếu xuất"
      statuses={STATUSES.map((s) => ({ value: s, label: docStatusLabels[s] }))}
      types={(Object.keys(issueTypeLabels) as IssueType[]).map((t) => ({ value: t, label: issueTypeLabels[t] }))}
      typeLabel="Loại xuất"
      useList={useGoodsIssues as never}
      columns={columns}
      rowHref={(row) => routeTo.goodsIssue(row.id)}
      searchPlaceholder="Mã phiếu, người nhận, số đơn hàng…"
    />
  )
}

