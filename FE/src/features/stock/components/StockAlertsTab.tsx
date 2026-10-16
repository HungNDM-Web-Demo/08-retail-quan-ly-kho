'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeftRight, BellOff } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { stockStatusBadge, stockStatusLabels } from '@/config/inventory-labels'
import { permissions } from '@/config/permissions'
import { QuantityReading } from '@/features/inventory/components/QuantityReading'
import { buildTransferDraftUrl } from '@/features/inventory/lib/links'
import { largestUnit } from '@/features/inventory/lib/uom'
import { usePermissions } from '@/hooks/use-permissions'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductGroupDto, StockAlertDto, StockStatus } from '@/types/inventory'
import { useStockAlerts } from '../hooks/use-stock'
import { stockCardHref } from './StockLevelsTab'

type AlertStatus = Exclude<StockStatus, 'BinhThuong'>
const ALERT_STATUSES: AlertStatus[] = ['HetHang', 'DuoiToiThieu', 'VuotToiDa']

/**
 * Số lượng của phiếu chuyển nháp từ kho nguồn (07 §3.9): min(đề xuất ?? hệ số lớn nhất, khả dụng kho nguồn).
 */
export function transferQuantity(alert: StockAlertDto, sourceAvailable: number): number {
  const f = largestUnit(alert.units)?.factor ?? 1
  return Math.min(alert.suggestedQuantity ?? f, sourceAvailable)
}

/**
 * Tab Cảnh báo (UC-10, FR-26, BR-18, BR-19): hết hàng, dưới tối thiểu, vượt tối đa theo kho (chỉ dòng có ngưỡng),
 * số đề xuất nhập, kho khác còn hàng và "Tạo phiếu chuyển" (TC-25).
 */
export function StockAlertsTab({
  warehouseId,
  status,
  groupId,
  onFiltersChange,
  groups,
  warehouseSelect,
}: {
  warehouseId?: string
  status?: AlertStatus
  groupId?: string
  onFiltersChange: (patch: { status?: AlertStatus; groupId?: string }) => void
  groups: ProductGroupDto[] | undefined
  warehouseSelect: React.ReactNode
}) {
  const router = useRouter()
  const { can } = usePermissions()
  const canTransfer = can(permissions.transfers.create)
  // Tải đủ mọi trạng thái một lần, lọc trạng thái tại máy để hiện số đếm trên nút lọc
  const alerts = useStockAlerts({ warehouseId, groupId })
  const all = useMemo(() => alerts.data ?? [], [alerts.data])
  const counts = useMemo(() => {
    const c: Record<AlertStatus, number> = { HetHang: 0, DuoiToiThieu: 0, VuotToiDa: 0 }
    for (const a of all) c[a.status] += 1
    return c
  }, [all])
  const rows = status ? all.filter((a) => a.status === status) : all

  const columns = useMemo<ColumnDef<StockAlertDto>[]>(() => {
    const right = { className: 'text-right', headerClassName: 'text-right' }
    return [
      {
        id: 'product',
        header: 'Mặt hàng',
        meta: { className: 'max-w-60' },
        cell: ({ row }) => {
          const a = row.original
          return (
            <div className="min-w-0">
              <Link
                href={stockCardHref(a.productId, a.warehouseId)}
                className="hover:text-primary line-clamp-1 font-medium underline-offset-4 hover:underline"
              >
                {a.productName}
              </Link>
              <div className="text-muted-foreground text-xs">
                <span className="font-mono">{a.productCode}</span> · {a.groupName}
              </div>
            </div>
          )
        },
      },
      {
        id: 'status',
        header: 'Kho · cảnh báo',
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-1">
            <span className="font-mono text-sm font-medium">{row.original.warehouseCode}</span>
            <StatusBadge tone={stockStatusBadge[row.original.status]}>{stockStatusLabels[row.original.status]}</StatusBadge>
          </div>
        ),
      },
      {
        id: 'onHand',
        header: 'Tồn thực',
        meta: right,
        cell: ({ row }) => (
          <QuantityReading quantity={row.original.onHand} baseUnit={row.original.baseUnit} units={row.original.units} className="items-end" />
        ),
      },
      {
        id: 'available',
        header: 'Khả dụng',
        meta: right,
        cell: ({ row }) => <span className="font-medium tabular-nums">{formatNumber(row.original.available, 0)}</span>,
      },
      {
        id: 'threshold',
        header: () => <span title="Tồn tối thiểu / tồn tối đa">Ngưỡng</span>,
        meta: right,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm tabular-nums">
            {row.original.minQty != null ? formatNumber(row.original.minQty, 0) : '—'} /{' '}
            {row.original.maxQty != null ? formatNumber(row.original.maxQty, 0) : '—'}
          </span>
        ),
      },
      {
        id: 'suggested',
        header: 'Đề xuất nhập',
        meta: right,
        cell: ({ row }) => {
          const a = row.original
          if (a.status === 'VuotToiDa') {
            return (
              <span className="text-info text-sm tabular-nums">
                Thừa {formatNumber(a.onHand - (a.maxQty ?? a.onHand), 0)}
              </span>
            )
          }
          if (a.suggestedQuantity == null) return <span className="text-muted-foreground text-xs">Chưa đặt tồn tối đa</span>
          return (
            <span className="inline-flex flex-col items-end leading-tight">
              <span className="font-semibold tabular-nums">
                {formatNumber(a.suggestedQuantity, 0)} {a.baseUnit.toLowerCase()}
              </span>
              {a.suggestedReading && <span className="text-muted-foreground text-xs">{a.suggestedReading}</span>}
            </span>
          )
        },
      },
      {
        id: 'sources',
        header: () => <span title="Bấm kho để tạo phiếu chuyển nháp tới kho thiếu">Tạo phiếu chuyển từ</span>,
        cell: ({ row }) => {
          const a = row.original
          if (a.status === 'VuotToiDa') return <span className="text-muted-foreground text-xs">—</span>
          if (!a.sources.length) return <span className="text-muted-foreground text-xs">Không kho nào còn hàng, cần nhập mua</span>
          return (
            <ul className="space-y-1.5">
              {a.sources.map((s) => {
                const q = transferQuantity(a, s.available)
                return (
                  <li key={s.warehouseId}>
                    {canTransfer ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5"
                        onClick={() =>
                          router.push(
                            buildTransferDraftUrl({
                              fromWarehouseId: s.warehouseId,
                              toWarehouseId: a.warehouseId,
                              lines: [{ productId: a.productId, baseQuantity: q }],
                            })
                          )
                        }
                        title={`Tạo phiếu chuyển ${formatNumber(q, 0)} ${a.baseUnit.toLowerCase()} từ ${s.warehouseCode} tới ${a.warehouseCode}`}
                        aria-label={`Tạo phiếu chuyển ${formatNumber(q, 0)} ${a.baseUnit.toLowerCase()} ${a.productName} từ ${s.warehouseCode} tới ${a.warehouseCode}`}
                      >
                        <ArrowLeftRight aria-hidden="true" />
                        <span className="font-mono font-semibold">{s.warehouseCode}</span>
                        <span className="text-muted-foreground font-normal tabular-nums">còn {formatNumber(s.available, 0)}</span>
                      </Button>
                    ) : (
                      <span className="text-sm whitespace-nowrap">
                        <span className="font-mono font-medium">{s.warehouseCode}</span>
                        <span className="text-muted-foreground"> còn </span>
                        <span className="tabular-nums">{formatNumber(s.available, 0)}</span>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )
        },
      },
    ]
  }, [canTransfer, router])

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(a) => `${a.warehouseId}-${a.productId}`}
      isLoading={alerts.isLoading}
      isFetching={alerts.isFetching}
      error={alerts.error}
      onRetry={() => void alerts.refetch()}
      minWidth={1040}
      toolbar={
        <div className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
            {warehouseSelect}
            <Select value={groupId ?? 'all'} onValueChange={(v) => onFiltersChange({ groupId: v === 'all' ? undefined : v })}>
              <SelectTrigger className="sm:w-52" aria-label="Lọc theo nhóm hàng">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mọi nhóm hàng</SelectItem>
                {(groups ?? []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} aria-hidden="true" />
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Lọc loại cảnh báo">
            {[undefined, ...ALERT_STATUSES].map((s) => {
              const active = status === s
              const count = s ? counts[s] : all.length
              return (
                <button
                  key={s ?? 'all'}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onFiltersChange({ status: s })}
                  className={cn(
                    'focus-visible:ring-ring/50 inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3',
                    active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
                  )}
                >
                  {s ? stockStatusLabels[s] : 'Tất cả cảnh báo'}
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-xs tabular-nums',
                      active ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {alerts.data ? count : '…'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      }
      emptyState={
        <EmptyState
          icon={BellOff}
          title={status ? `Không có mặt hàng ${stockStatusLabels[status].toLowerCase()}` : 'Không có cảnh báo tồn'}
          description="Chỉ mặt hàng đã đặt tồn tối thiểu hoặc tối đa tại kho mới được cảnh báo."
        />
      }
    />
  )
}
