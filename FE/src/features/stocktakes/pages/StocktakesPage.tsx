'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ClipboardList, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { stocktakeStatusLabels } from '@/config/inventory-labels'
import { permissions } from '@/config/permissions'
import { routeTo } from '@/config/route-path'
import { DocStatusBadge } from '@/features/inventory/components/DocStatusBadge'
import { DocListShell } from '@/features/inventory/components/doc/DocListShell'
import { usePermissions } from '@/hooks/use-permissions'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import type { StocktakeListItem, StocktakeStatus } from '@/types/inventory'
import { CreateStocktakeDialog } from '../components/CreateStocktakeDialog'
import { useStocktakes } from '../hooks/use-stocktakes'

const STATUSES: StocktakeStatus[] = ['DangKiem', 'ChoDuyet', 'DaCanBang', 'DaHuy']

/** SCR-14: danh sách phiếu kiểm kê (UC-11) */
export function StocktakesPage() {
  const { can } = usePermissions()
  const [createOpen, setCreateOpen] = useState(false)
  const columns = useMemo<ColumnDef<StocktakeListItem>[]>(
    () => [
      {
        id: 'code',
        header: 'Mã phiếu',
        cell: ({ row }) => (
          <div className="leading-tight">
            <p className="font-medium tabular-nums">{row.original.code}</p>
            <p className="text-muted-foreground text-xs">Chốt sổ {formatDateTime(row.original.snapshotAt)}</p>
          </div>
        ),
      },
      {
        id: 'scope',
        header: 'Kho · Phạm vi',
        cell: ({ row }) => (
          <div className="max-w-72 leading-tight">
            <p className="font-medium">{row.original.warehouseCode}</p>
            <p className="text-muted-foreground truncate text-xs">
              {row.original.scopeAll ? 'Toàn kho' : row.original.groups.map((g) => g.name).join(', ')}
            </p>
          </div>
        ),
      },
      { id: 'counter', header: 'Người đếm', cell: ({ row }) => <span className="text-sm">{row.original.counterName}</span> },
      {
        id: 'progress',
        header: 'Đã đếm',
        cell: ({ row }) => {
          const { countedLines, totalLines } = row.original
          return (
            <div className="w-36 space-y-1">
              <p className="text-xs tabular-nums">
                {formatNumber(countedLines, 0)}/{formatNumber(totalLines, 0)} dòng
              </p>
              <Progress value={totalLines ? (countedLines * 100) / totalLines : 0} className="h-1.5" aria-label="Tiến độ đếm" />
            </div>
          )
        },
      },
      {
        id: 'variance',
        header: 'Thừa / thiếu',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) =>
          row.original.canViewValues && row.original.surplusValue != null && row.original.status !== 'DangKiem' ? (
            <div className="text-xs leading-tight tabular-nums">
              <p className="text-success">+{formatVnd(row.original.surplusValue)}</p>
              <p className="text-destructive">−{formatVnd(row.original.shortageValue)}</p>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      { id: 'status', header: 'Trạng thái', cell: ({ row }) => <DocStatusBadge kind="stocktake" status={row.original.status} /> },
    ],
    []
  )
  return (
    <>
      <DocListShell
        title="Kiểm kê"
        description="Chốt sổ sách, đếm thực tế (quét mã trên tablet), duyệt để cân bằng tồn theo số đếm."
        icon={ClipboardList}
        actions={
          can(permissions.stocktakes.create) && (
            <Button size="lg" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" /> Tạo phiếu kiểm kê
            </Button>
          )
        }
        statuses={STATUSES.map((s) => ({ value: s, label: stocktakeStatusLabels[s] }))}
        useList={useStocktakes as never}
        columns={columns}
        rowHref={(row) => routeTo.stocktake(row.id)}
        searchPlaceholder="Mã phiếu, kho, người đếm…"
      />
      <CreateStocktakeDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
