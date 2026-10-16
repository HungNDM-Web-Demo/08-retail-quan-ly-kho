'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { UseQueryResult } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { FilterX, Plus, SearchX, type LucideIcon } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PaginatedResult } from '@/types/api'
import { WarehouseSelect } from '../WarehouseSelect'

export type DocListFilters = {
  status: string
  warehouseId: string
  type: string
  from: string
  to: string
  isLate: boolean
}

type ListHook<T> = (query: Record<string, unknown>, enabled?: boolean) => UseQueryResult<PaginatedResult<T>>

const ALL = '__all__'

/** Một tab trạng thái có số đếm (gọi danh sách `pageSize = 1` để lấy tổng) */
function useStatusCount<T>(useList: ListHook<T>, base: Record<string, unknown>, status: string) {
  const q = useList({ ...base, status: status || undefined, page: 1, pageSize: 1 })
  return q.data?.totalCount
}

function StatusTab<T>({
  useList,
  base,
  value,
  label,
  active,
  onSelect,
}: {
  useList: ListHook<T>
  base: Record<string, unknown>
  value: string
  label: string
  active: boolean
  onSelect: () => void
}) {
  const count = useStatusCount(useList, base, value)
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        'focus-visible:ring-ring/50 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {label}
      <span
        className={cn(
          'min-w-6 rounded-full px-1.5 text-xs tabular-nums',
          active ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
        )}
      >
        {count === undefined ? '…' : formatNumber(count, 0)}
      </span>
    </button>
  )
}

/**
 * Khung danh sách phiếu dùng chung (SCR-05, 07, 09, 14): tab trạng thái có số đếm, tìm kiếm, lọc kho, loại, khoảng
 * ngày chứng từ; bấm dòng mở chi tiết. Đọc `status`, `warehouseId`, `isLate` ban đầu từ URL (liên kết từ Tổng quan).
 */
export function DocListShell<T extends { id: string }>({
  title,
  description,
  icon,
  newHref,
  newLabel,
  actions,
  statuses,
  types,
  typeLabel = 'Loại',
  useList,
  columns,
  rowHref,
  searchPlaceholder,
  minWidth = 960,
}: {
  title: string
  description: string
  icon: LucideIcon
  newHref?: string | null
  newLabel?: string
  /** Nút đầu trang thay cho liên kết "Lập phiếu" (vd mở hộp tạo kiểm kê) */
  actions?: React.ReactNode
  statuses: { value: string; label: string }[]
  types?: { value: string; label: string }[]
  typeLabel?: string
  useList: ListHook<T>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cột có kiểu giá trị khác nhau
  columns: ColumnDef<T, any>[]
  rowHref: (row: T) => string
  searchPlaceholder: string
  minWidth?: number
}) {
  const router = useRouter()
  const params = useSearchParams()
  const table = useTableQuery<DocListFilters>({
    pageSize: 20,
    status: params.get('status') ?? undefined,
    warehouseId: params.get('warehouseId') ?? undefined,
    isLate: params.get('isLate') === 'true' ? true : undefined,
  })
  const [searchKey, setSearchKey] = useState(0)
  const list = useList(table.query as Record<string, unknown>)

  // Bộ lọc chung cho số đếm của tab (không gồm trạng thái, trang)
  const countBase = useMemo(() => {
    const rest: Record<string, unknown> = { ...table.query }
    for (const key of ['status', 'page', 'pageSize', 'sortBy', 'sortDir']) delete rest[key]
    return rest
  }, [table.query])

  const hasFilters =
    !!table.state.search || !!table.state.warehouseId || !!table.state.type || !!table.state.from || !!table.state.to || !!table.state.isLate

  const clear = () => {
    table.resetFilters()
    setSearchKey((k) => k + 1)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={description}
        icon={icon}
        actions={
          actions ??
          (newHref && (
            <Button asChild size="lg">
              <Link href={newHref}>
                <Plus aria-hidden="true" /> {newLabel}
              </Link>
            </Button>
          ))
        }
      />

      <div role="tablist" aria-label="Lọc theo trạng thái" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {[{ value: '', label: 'Tất cả' }, ...statuses].map((s) => (
          <StatusTab
            key={s.value || 'all'}
            useList={useList}
            base={countBase}
            value={s.value}
            label={s.label}
            active={(table.state.status ?? '') === s.value}
            onSelect={() => table.setFilter('status', s.value || undefined)}
          />
        ))}
      </div>

      <DataTable
        columns={columns}
        data={list.data?.items}
        isLoading={list.isLoading}
        isFetching={list.isFetching}
        error={list.error}
        onRetry={() => void list.refetch()}
        getRowId={(row) => row.id}
        onRowClick={(row) => router.push(rowHref(row))}
        minWidth={minWidth}
        toolbar={
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
            <SearchInput
              key={searchKey}
              value={table.state.search}
              onSearch={table.setSearch}
              placeholder={searchPlaceholder}
              className="lg:w-72"
              aria-label="Tìm phiếu"
            />
            <WarehouseSelect
              value={table.state.warehouseId}
              onChange={(v) => table.setFilter('warehouseId', v || undefined)}
              allLabel="Tất cả kho"
              className="h-10 lg:w-56"
            />
            {types && (
              <Select value={table.state.type ?? ALL} onValueChange={(v) => table.setFilter('type', v === ALL ? undefined : v)}>
                <SelectTrigger className="h-10 lg:w-48" aria-label={typeLabel}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{typeLabel}: tất cả</SelectItem>
                  {types.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={table.state.from ?? ''}
                onChange={(e) => table.setFilter('from', e.target.value || undefined)}
                aria-label="Từ ngày"
                className="h-10 w-40"
              />
              <span className="text-muted-foreground text-sm">–</span>
              <Input
                type="date"
                value={table.state.to ?? ''}
                onChange={(e) => table.setFilter('to', e.target.value || undefined)}
                aria-label="Đến ngày"
                className="h-10 w-40"
              />
            </div>
            {hasFilters && (
              <Button variant="ghost" onClick={clear}>
                <FilterX aria-hidden="true" /> Xóa lọc
              </Button>
            )}
          </div>
        }
        pagination={
          list.data && {
            page: list.data.page,
            pageSize: list.data.pageSize,
            totalCount: list.data.totalCount,
            totalPages: list.data.totalPages,
            onPageChange: table.setPage,
            onPageSizeChange: table.setPageSize,
            pageSizeOptions: [20, 50, 100],
          }
        }
        emptyState={
          hasFilters || table.state.status ? (
            <EmptyState icon={SearchX} title="Không có phiếu phù hợp" description="Thử đổi trạng thái hoặc bộ lọc." />
          ) : (
            <EmptyState title="Chưa có phiếu" description="Phiếu mới lập sẽ hiện ở đây." />
          )
        }
      />
    </div>
  )
}
