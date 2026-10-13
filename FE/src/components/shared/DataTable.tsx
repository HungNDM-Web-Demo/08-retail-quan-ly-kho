'use client'

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { SortDir } from '@/types/api'
import { DataTablePagination, type PaginationProps } from './DataTablePagination'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'

type SortingProps = {
  sortBy?: string
  sortDir?: SortDir
  onSortChange: (sortBy?: string, sortDir?: SortDir) => void
}

type DataTableProps<TData> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cột có kiểu giá trị khác nhau
  columns: ColumnDef<TData, any>[]
  data: TData[] | undefined
  /** Lần tải đầu: hiện khung xương */
  isLoading?: boolean
  /** Đang tải lại (đổi trang, lọc): làm mờ nhẹ bảng */
  isFetching?: boolean
  error?: unknown
  onRetry?: () => void
  /** Thanh công cụ phía trên bảng (tìm kiếm, bộ lọc) */
  toolbar?: React.ReactNode
  pagination?: PaginationProps
  /** Sắp xếp phía máy chủ; cột bật `enableSorting: true` mới sắp xếp được */
  sorting?: SortingProps
  emptyState?: React.ReactNode
  getRowId?: (row: TData) => string
  onRowClick?: (row: TData) => void
  /** Độ rộng tối thiểu của bảng; màn hình hẹp hơn thì cuộn ngang trong khung bảng */
  minWidth?: number
  className?: string
}

/**
 * Bảng danh sách dùng chung (TanStack Table, phân trang/sắp xếp phía máy chủ).
 * Có sẵn khung xương khi tải, trạng thái trống, lỗi kèm thử lại, cuộn ngang trên điện thoại.
 */
export function DataTable<TData>({
  columns,
  data,
  isLoading,
  isFetching,
  error,
  onRetry,
  toolbar,
  pagination,
  sorting,
  emptyState,
  getRowId,
  onRowClick,
  minWidth = 720,
  className,
}: DataTableProps<TData>) {
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table chưa hỗ trợ React Compiler
  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    manualPagination: true,
    manualSorting: true,
    enableSorting: !!sorting,
    enableSortingRemoval: true,
  })

  const skeletonRows = Math.min(pagination?.pageSize ?? 8, 8)
  const rows = table.getRowModel().rows
  const showEmpty = !isLoading && !error && rows.length === 0

  const toggleSort = (key: string) => {
    if (!sorting) return
    if (sorting.sortBy !== key) sorting.onSortChange(key, 'asc')
    else if (sorting.sortDir === 'asc') sorting.onSortChange(key, 'desc')
    else sorting.onSortChange(undefined, undefined)
  }

  const handleRowKey = (event: React.KeyboardEvent, row: Row<TData>) => {
    if (!onRowClick) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onRowClick(row.original)
    }
  }

  return (
    <div className={cn('bg-card text-card-foreground overflow-hidden rounded-xl border shadow-xs', className)}>
      {toolbar && <div className="border-b p-3 sm:p-4">{toolbar}</div>}

      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        <div
          className={cn('relative overflow-x-auto transition-opacity duration-200', isFetching && !isLoading && 'opacity-60')}
          aria-busy={isLoading || isFetching}
        >
          <Table style={{ minWidth }}>
            <TableHeader className="bg-muted/50">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {group.headers.map((header) => {
                    const meta = header.column.columnDef.meta
                    const sortKey = meta?.sortKey ?? header.column.id
                    const canSort = !!sorting && header.column.columnDef.enableSorting === true
                    const active = canSort && sorting?.sortBy === sortKey
                    const ariaSort = active ? (sorting?.sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                    const label = header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())
                    return (
                      <TableHead
                        key={header.id}
                        aria-sort={ariaSort}
                        className={cn('text-muted-foreground h-11 px-4 text-xs font-semibold tracking-wide uppercase', meta?.headerClassName)}
                      >
                        {canSort ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(sortKey)}
                            className={cn(
                              'hover:text-foreground focus-visible:ring-ring/50 -mx-1.5 inline-flex h-8 items-center gap-1.5 rounded-md px-1.5 uppercase transition-colors outline-none focus-visible:ring-3',
                              active && 'text-foreground'
                            )}
                          >
                            {label}
                            {active ? (
                              sorting?.sortDir === 'asc' ? (
                                <ArrowUp className="size-3.5" aria-hidden="true" />
                              ) : (
                                <ArrowDown className="size-3.5" aria-hidden="true" />
                              )
                            ) : (
                              <ArrowUpDown className="size-3.5 opacity-50" aria-hidden="true" />
                            )}
                          </button>
                        ) : (
                          label
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: skeletonRows }, (_, i) => (
                    <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                      {columns.map((_, j) => (
                        <TableCell key={j} className="h-14 px-4">
                          <Skeleton className={cn('h-4', j === 0 ? 'w-40' : 'w-24')} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.map((row) => (
                    <TableRow
                      key={row.id}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                      onKeyDown={onRowClick ? (e) => handleRowKey(e, row) : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      className={cn(
                        'hover:bg-muted/40 transition-colors duration-150',
                        onRowClick && 'focus-visible:bg-muted/60 cursor-pointer outline-none'
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cn('h-14 px-4 py-2', cell.column.columnDef.meta?.className)}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          {showEmpty && (emptyState ?? <EmptyState title="Chưa có dữ liệu" description="Dữ liệu sẽ hiện ở đây khi có bản ghi." />)}
        </div>
      )}

      {pagination && !error && pagination.totalCount > 0 && (
        <div className="border-t">
          <DataTablePagination {...pagination} />
        </div>
      )}
    </div>
  )
}
