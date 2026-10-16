'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowRight, ClipboardCheck, Lock, UserRoundCog } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { docKindLabels } from '@/config/inventory-labels'
import { roleCodes } from '@/config/permissions'
import { WarehouseSelect } from '@/features/inventory/components/WarehouseSelect'
import { useDemoRoleShortcut } from '@/features/inventory/components/doc/DocParts'
import { formatDateTime, formatNumber, formatRelativeTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ApprovalItem, DocKind } from '@/types/inventory'
import { ApprovalDrawer } from '../components/ApprovalDrawer'
import { useApprovals } from '../hooks/use-approvals'

const KINDS: DocKind[] = ['GoodsReceipt', 'GoodsIssue', 'Transfer', 'Stocktake']

/** SCR-11: Phiếu chờ duyệt (UC-05): gửi trước lên trước, lọc loại, kho, người lập; bấm dòng mở ngăn kéo duyệt */
export function ApprovalsPage() {
  const params = useSearchParams()
  const [kind, setKind] = useState<DocKind | undefined>((params.get('kind') as DocKind) || undefined)
  const [warehouseId, setWarehouseId] = useState('')
  const [createdById, setCreatedById] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const all = useApprovals({ warehouseId: warehouseId || undefined })
  const shortcut = useDemoRoleShortcut()

  const rows = useMemo(
    () => (all.data ?? []).filter((i) => (!kind || i.kind === kind) && (!createdById || i.createdById === createdById)),
    [all.data, kind, createdById]
  )
  const creators = useMemo(() => {
    const map = new Map<string, string>()
    for (const i of all.data ?? []) map.set(i.createdById, i.createdByName)
    return [...map]
  }, [all.data])
  const selected = rows.find((r) => r.id === selectedId) ?? (all.data ?? []).find((r) => r.id === selectedId) ?? null

  const columns = useMemo<ColumnDef<ApprovalItem>[]>(
    () => [
      {
        id: 'code',
        header: 'Phiếu',
        cell: ({ row }) => (
          <div className="leading-tight">
            <p className="font-medium tabular-nums">{row.original.code}</p>
            <p className="text-muted-foreground text-xs">{docKindLabels[row.original.kind]}</p>
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Nội dung',
        cell: ({ row }) => (
          <div className="leading-tight">
            <p>{row.original.typeText}</p>
            <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              {row.original.warehouseCode}
              {row.original.toWarehouseCode && (
                <>
                  <ArrowRight className="size-3" aria-hidden="true" /> {row.original.toWarehouseCode}
                </>
              )}
            </p>
          </div>
        ),
      },
      {
        id: 'createdBy',
        header: 'Người lập',
        cell: ({ row }) => <span className="text-sm">{row.original.createdByName}</span>,
      },
      {
        id: 'submittedAt',
        header: 'Gửi lúc',
        cell: ({ row }) => (
          <span className="text-sm" title={formatDateTime(row.original.submittedAt)}>
            {formatRelativeTime(row.original.submittedAt)}
          </span>
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
        header: 'Giá trị',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className="font-medium tabular-nums">{formatVnd(row.original.totalValue)}</span>,
      },
      {
        id: 'canApprove',
        header: '',
        cell: ({ row }) =>
          row.original.canApprove ? (
            <StatusBadge tone="warning">Chờ duyệt</StatusBadge>
          ) : (
            <StatusBadge tone="neutral" icon={<Lock className="size-3" aria-hidden="true" />}>
              {row.original.blockedReason}
            </StatusBadge>
          ),
      },
    ],
    []
  )

  const counts = useMemo(() => {
    const c = new Map<DocKind | 'all', number>([['all', all.data?.length ?? 0]])
    for (const i of all.data ?? []) c.set(i.kind, (c.get(i.kind) ?? 0) + 1)
    return c
  }, [all.data])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Phiếu chờ duyệt"
        description="Phiếu gửi trước nằm trên. Duyệt là ghi sổ ngay; người duyệt phải khác người lập."
        icon={ClipboardCheck}
      />
      <div role="tablist" aria-label="Lọc theo loại phiếu" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {[undefined, ...KINDS].map((k) => {
          const active = kind === k
          return (
            <button
              key={k ?? 'all'}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setKind(k)}
              className={cn(
                'focus-visible:ring-ring/50 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3',
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {k ? docKindLabels[k] : 'Tất cả'}
              <span className={cn('min-w-6 rounded-full px-1.5 text-xs tabular-nums', active ? 'bg-primary-foreground/20' : 'bg-muted')}>
                {counts.get(k ?? 'all') ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={all.isLoading}
        isFetching={all.isFetching}
        error={all.error}
        onRetry={() => void all.refetch()}
        getRowId={(r) => r.id}
        onRowClick={(r) => setSelectedId(r.id)}
        minWidth={900}
        toolbar={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <WarehouseSelect value={warehouseId} onChange={setWarehouseId} allLabel="Tất cả kho" className="h-10 sm:w-56" />
            <select
              value={createdById}
              onChange={(e) => setCreatedById(e.target.value)}
              aria-label="Người lập"
              className="border-input bg-background focus-visible:ring-ring/50 h-10 rounded-md border px-3 text-sm outline-none focus-visible:ring-3 sm:w-56"
            >
              <option value="">Mọi người lập</option>
              {creators.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        }
        emptyState={
          <EmptyState
            icon={ClipboardCheck}
            title="Chưa có phiếu chờ duyệt"
            description={shortcut.enabled ? 'Đổi sang Thủ kho để lập phiếu' : 'Phiếu thủ kho gửi duyệt sẽ hiện ở đây.'}
            action={
              shortcut.enabled && (
                <Button variant="outline" onClick={() => shortcut.switchTo(roleCodes.staff, 'Thủ kho', '/goods-receipts/new')}>
                  <UserRoundCog aria-hidden="true" /> Đổi sang Thủ kho
                </Button>
              )
            }
          />
        }
      />
      <ApprovalDrawer item={selected} onClose={() => setSelectedId(null)} />
    </div>
  )
}
