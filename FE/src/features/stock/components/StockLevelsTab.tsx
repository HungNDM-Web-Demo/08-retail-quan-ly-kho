'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { Boxes, SearchX, X } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { stockStatusBadge, stockStatusLabels } from '@/config/inventory-labels'
import { routeTo } from '@/config/route-path'
import { ProductThumb } from '@/features/inventory/components/ProductThumb'
import { QuantityReading } from '@/features/inventory/components/QuantityReading'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductGroupDto, StockQuery, StockRowDto, StockStatus, WarehouseOption } from '@/types/inventory'
import { useStockLevels } from '../hooks/use-stock'
import { ReservationsSheet, type ReservationTarget } from './ReservationsSheet'

const STATUSES: StockStatus[] = ['HetHang', 'DuoiToiThieu', 'VuotToiDa', 'BinhThuong']

export type StockFilters = {
  warehouseId?: string
  groupId?: string
  status?: StockStatus
  inStockOnly?: boolean
}

/** Đường dẫn thẻ kho giữ kho đang chọn (UC-09 bước 1) */
export const stockCardHref = (productId: string, warehouseId?: string) =>
  warehouseId ? `${routeTo.stockCard(productId)}?warehouseId=${warehouseId}` : routeTo.stockCard(productId)

/**
 * Tab Tồn kho (UC-08, FR-24): một kho hoặc tất cả kho; tồn thực kèm cách đọc, chờ xuất (bấm xem phiếu giữ chỗ),
 * khả dụng, giá vốn, giá trị (chỉ `canViewValues`, BR-25), trạng thái; dòng tổng giá trị đầu bảng.
 */
export function StockLevelsTab({
  filters,
  onFiltersChange,
  warehouses,
  groups,
  warehouseSelect,
}: {
  filters: StockFilters
  onFiltersChange: (patch: Partial<StockFilters>) => void
  warehouses: WarehouseOption[]
  groups: ProductGroupDto[] | undefined
  warehouseSelect: React.ReactNode
}) {
  const router = useRouter()
  const table = useTableQuery<{ _?: never }>({ pageSize: 20 })
  const [searchKey, setSearchKey] = useState(0)
  const [reservation, setReservation] = useState<ReservationTarget | null>(null)
  const { setPage } = table

  const filterKey = JSON.stringify(filters)
  useEffect(() => setPage(1), [filterKey, setPage])

  const query: StockQuery = useMemo(
    () =>
      Object.fromEntries(
        Object.entries({ ...table.query, ...filters }).filter(([, v]) => v !== undefined && v !== '' && v !== false)
      ) as StockQuery,
    [table.query, filters]
  )
  const stock = useStockLevels(query)
  const data = stock.data
  const single = !!filters.warehouseId
  const showValues = !!data?.canViewValues
  const wCode = (id: string) => warehouses.find((w) => w.id === id)?.code ?? ''

  const hasFilters = !!table.state.search || !!filters.groupId || !!filters.status || !!filters.inStockOnly
  const clearFilters = () => {
    onFiltersChange({ groupId: undefined, status: undefined, inStockOnly: undefined })
    table.setSearch('')
    setSearchKey((k) => k + 1)
  }

  // Cột tồn từng kho khi xem "Tất cả kho" (UC-08 1a)
  const warehouseCols = useMemo(() => {
    const seen = new Set<string>()
    for (const r of data?.items ?? []) for (const b of r.byWarehouse ?? []) seen.add(b.warehouseId)
    return warehouses.filter((w) => seen.has(w.id)).map((w) => ({ id: w.id, code: w.code }))
  }, [data?.items, warehouses])

  const columns = useMemo<ColumnDef<StockRowDto>[]>(() => {
    const right = { className: 'text-right', headerClassName: 'text-right' }
    const code = (id: string) => warehouses.find((w) => w.id === id)?.code ?? ''
    const openReservations = (row: StockRowDto) => {
      const list = filters.warehouseId
        ? [{ id: filters.warehouseId, code: code(filters.warehouseId) }]
        : (row.byWarehouse ?? [])
            .filter((b) => b.onHand - b.available > 0)
            .map((b) => ({ id: b.warehouseId, code: b.warehouseCode }))
      setReservation({
        productId: row.productId,
        productCode: row.productCode,
        productName: row.productName,
        baseUnit: row.baseUnit,
        units: row.units,
        warehouses: list,
      })
    }

    const list: ColumnDef<StockRowDto>[] = [
      {
        id: 'productCode',
        header: 'Mặt hàng',
        enableSorting: true,
        meta: { className: 'max-w-64' },
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="flex min-w-0 items-center gap-3">
              <ProductThumb name={r.productName} imageUrl={r.imageUrl} groupColor={r.groupColor} />
              <div className="min-w-0">
                <Link
                  href={stockCardHref(r.productId, filters.warehouseId)}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-primary line-clamp-1 font-medium underline-offset-4 hover:underline"
                >
                  {r.productName}
                </Link>
                <div className="text-muted-foreground text-xs">
                  <span className="font-mono">{r.productCode}</span> · {r.groupName}
                </div>
              </div>
            </div>
          )
        },
      },
    ]
    if (!filters.warehouseId) {
      list.push(
        ...warehouseCols.map<ColumnDef<StockRowDto>>((w) => ({
          id: `w-${w.id}`,
          header: w.code,
          meta: right,
          cell: ({ row }) => {
            const b = row.original.byWarehouse?.find((x) => x.warehouseId === w.id)
            if (!b) return <span className="text-muted-foreground">—</span>
            return (
              <span
                className={cn(
                  'tabular-nums',
                  b.status === 'DuoiToiThieu' && 'text-warning font-semibold',
                  b.status === 'VuotToiDa' && 'text-info font-semibold',
                  b.status === 'HetHang' && 'text-muted-foreground'
                )}
                title={`${w.code}: ${stockStatusLabels[b.status]}, khả dụng ${formatNumber(b.available, 0)}`}
              >
                {formatNumber(b.onHand, 0)}
              </span>
            )
          },
        }))
      )
    }
    list.push(
      {
        id: 'onHand',
        header: filters.warehouseId ? 'Tồn thực' : 'Tổng tồn',
        enableSorting: true,
        meta: right,
        cell: ({ row }) => (
          <QuantityReading
            quantity={row.original.onHand}
            baseUnit={row.original.baseUnit}
            units={row.original.units}
            emphasis
            className="items-end"
          />
        ),
      },
      {
        id: 'reserved',
        header: 'Chờ xuất',
        meta: right,
        cell: ({ row }) =>
          row.original.reserved > 0 ? (
            <Button
              variant="link"
              className="h-auto p-0 tabular-nums"
              onClick={(e) => {
                e.stopPropagation()
                openReservations(row.original)
              }}
              aria-label={`Xem phiếu giữ chỗ ${formatNumber(row.original.reserved, 0)} ${row.original.baseUnit.toLowerCase()} của ${row.original.productName}`}
            >
              {formatNumber(row.original.reserved, 0)}
            </Button>
          ) : (
            <span className="text-muted-foreground tabular-nums">0</span>
          ),
      },
      {
        id: 'available',
        header: 'Khả dụng',
        enableSorting: true,
        meta: right,
        cell: ({ row }) => <span className="font-medium tabular-nums">{formatNumber(row.original.available, 0)}</span>,
      }
    )
    if (filters.warehouseId) {
      list.push({
        id: 'threshold',
        header: () => <span title="Tồn tối thiểu / tồn tối đa">Ngưỡng</span>,
        meta: right,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm tabular-nums">
            {row.original.minQty != null ? formatNumber(row.original.minQty, 0) : '—'} /{' '}
            {row.original.maxQty != null ? formatNumber(row.original.maxQty, 0) : '—'}
          </span>
        ),
      })
    }
    if (showValues) {
      if (filters.warehouseId) {
        list.push({
          id: 'avgCost',
          header: 'Giá vốn',
          meta: right,
          cell: ({ row }) => <span className="tabular-nums">{formatVnd(row.original.avgCost)}</span>,
        })
      }
      list.push({
        id: 'stockValue',
        header: 'Giá trị tồn',
        enableSorting: true,
        meta: right,
        cell: ({ row }) => <span className="font-medium tabular-nums">{formatVnd(row.original.stockValue)}</span>,
      })
    }
    if (filters.warehouseId) {
      list.push({
        id: 'status',
        header: 'Trạng thái',
        cell: ({ row }) =>
          row.original.status ? (
            <StatusBadge tone={stockStatusBadge[row.original.status]}>{stockStatusLabels[row.original.status]}</StatusBadge>
          ) : null,
      })
    }
    return list
  }, [showValues, warehouseCols, filters.warehouseId, warehouses])

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.items}
        getRowId={(r) => r.productId}
        onRowClick={(r) => router.push(stockCardHref(r.productId, filters.warehouseId))}
        isLoading={stock.isLoading}
        isFetching={stock.isFetching}
        error={stock.error}
        onRetry={() => void stock.refetch()}
        minWidth={single ? 1000 : 820 + warehouseCols.length * 80}
        sorting={{ sortBy: table.state.sortBy, sortDir: table.state.sortDir, onSortChange: table.setSort }}
        pagination={
          data && {
            page: data.page,
            pageSize: data.pageSize,
            totalCount: data.totalCount,
            totalPages: data.totalPages,
            onPageChange: table.setPage,
            onPageSizeChange: table.setPageSize,
          }
        }
        toolbar={
          <div className="space-y-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
              {warehouseSelect}
              <SearchInput
                key={searchKey}
                value={table.state.search}
                onSearch={table.setSearch}
                placeholder="Tìm mã, tên, mã vạch"
                className="lg:max-w-xs"
              />
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Select value={filters.groupId ?? 'all'} onValueChange={(v) => onFiltersChange({ groupId: v === 'all' ? undefined : v })}>
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
                <Select
                  value={filters.status ?? 'all'}
                  onValueChange={(v) => onFiltersChange({ status: v === 'all' ? undefined : (v as StockStatus) })}
                >
                  <SelectTrigger className="sm:w-44" aria-label="Lọc theo trạng thái tồn">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Mọi trạng thái</SelectItem>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {stockStatusLabels[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-h-9 items-center gap-2">
                <Switch
                  id="in-stock-only"
                  checked={!!filters.inStockOnly}
                  onCheckedChange={(v) => onFiltersChange({ inStockOnly: v || undefined })}
                />
                <Label htmlFor="in-stock-only" className="text-sm font-normal">
                  Chỉ hàng còn tồn
                </Label>
              </div>
              {hasFilters && (
                <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                  <X aria-hidden="true" />
                  Xóa lọc
                </Button>
              )}
            </div>
            {data && (
              <div className="bg-muted/50 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg px-3 py-2 text-sm" role="status">
                <span>
                  <span className="text-muted-foreground">Số mặt hàng: </span>
                  <span className="font-semibold tabular-nums">{formatNumber(data.totalCount, 0)}</span>
                </span>
                {data.canViewValues && (
                  <span>
                    <span className="text-muted-foreground">Tổng giá trị tồn: </span>
                    <span className="font-semibold tabular-nums">{formatVnd(data.totalValue)}</span>
                  </span>
                )}
                <span className="text-muted-foreground">
                  {single ? `Kho ${wCode(filters.warehouseId!)}` : `Tất cả ${warehouses.length} kho bạn được xem`}
                </span>
              </div>
            )}
          </div>
        }
        emptyState={
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="Không có mặt hàng thỏa bộ lọc"
              description="Thử bỏ bớt bộ lọc nhóm, trạng thái hoặc từ khóa."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Boxes} title="Kho chưa có hàng" description="Tồn xuất hiện sau khi phiếu nhập được duyệt." />
          )
        }
      />
      <ReservationsSheet target={reservation} onClose={() => setReservation(null)} />
    </>
  )
}
