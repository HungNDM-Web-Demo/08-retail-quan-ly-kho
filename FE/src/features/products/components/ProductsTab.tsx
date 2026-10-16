'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { Ban, BookOpenText, CirclePlay, Eye, MoreHorizontal, Package, Pencil, Plus, SearchX, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { stockStatusLabels } from '@/config/inventory-labels'
import { permissions } from '@/config/permissions'
import { routeTo } from '@/config/route-path'
import { ProductThumb } from '@/features/inventory/components/ProductThumb'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { getErrorMessage } from '@/lib/api-error'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductDto, ProductGroupDto, ProductStockCell } from '@/types/inventory'
import { useDeleteProduct, useProducts, useSetProductStatus } from '../hooks/use-products'
import { ProductFormSheet } from './ProductFormSheet'

type Filters = { groupId: string; isActive: boolean }

/** Màu chữ ô tồn theo trạng thái (kèm chú thích title, không chỉ dựa vào màu) */
const CELL_TONE: Record<ProductStockCell['status'], string> = {
  BinhThuong: '',
  HetHang: 'text-muted-foreground',
  DuoiToiThieu: 'text-warning font-semibold',
  VuotToiDa: 'text-info font-semibold',
}

/** Tab Mặt hàng (UC-01 bước 1, FR-09): tìm mã, tên không dấu, mã vạch; lọc nhóm, trạng thái; cột tồn từng kho */
export function ProductsTab({ groups }: { groups: ProductGroupDto[] | undefined }) {
  const { can } = usePermissions()
  const canCreate = can(permissions.products.create)
  const canUpdate = can(permissions.products.update)
  const canDelete = can(permissions.products.delete)
  const canStockCard = can(permissions.stockLevels.view)

  const table = useTableQuery<Filters>({ pageSize: 20 })
  const products = useProducts(table.query)
  const setStatus = useSetProductStatus()
  const remove = useDeleteProduct()

  const [sheet, setSheet] = useState<{ open: boolean; id: string | null; readOnly: boolean }>({
    open: false,
    id: null,
    readOnly: false,
  })
  const [statusTarget, setStatusTarget] = useState<ProductDto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProductDto | null>(null)
  const [searchKey, setSearchKey] = useState(0)
  const hasFilters = !!table.state.search || !!table.state.groupId || table.state.isActive !== undefined
  const clearFilters = () => {
    table.resetFilters()
    setSearchKey((k) => k + 1)
  }

  const items = products.data?.items
  // Cột tồn theo kho trong phạm vi người xem (lấy từ `stocks` của dòng đầu, BE trả đủ kho trong phạm vi)
  const warehouseCols = useMemo(() => {
    const seen = new Map<string, string>()
    for (const p of items ?? []) for (const s of p.stocks) if (!seen.has(s.warehouseId)) seen.set(s.warehouseId, s.warehouseCode)
    return [...seen.entries()].map(([id, code]) => ({ id, code }))
  }, [items])

  const open = (p: ProductDto) => setSheet({ open: true, id: p.id, readOnly: !canUpdate })

  const columns = useMemo<ColumnDef<ProductDto>[]>(() => {
    const list: ColumnDef<ProductDto>[] = [
      {
        id: 'code',
        header: 'Mặt hàng',
        enableSorting: true,
        cell: ({ row }) => {
          const p = row.original
          return (
            <div className="flex min-w-0 items-center gap-3">
              <ProductThumb imageUrl={p.imageUrl} name={p.name} groupColor={p.groupColor} />
              <div className="min-w-0">
                <div className="line-clamp-1 font-medium">{p.name}</div>
                <div className="text-muted-foreground text-xs">
                  <span className="font-mono">{p.code}</span>
                  {p.spec && <> · {p.spec}</>}
                </div>
              </div>
            </div>
          )
        },
      },
      {
        id: 'groupName',
        header: 'Nhóm',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.original.groupColor }} aria-hidden="true" />
            {row.original.groupName}
          </span>
        ),
      },
      {
        id: 'units',
        header: 'Đơn vị',
        cell: ({ row }) => (
          <div className="text-sm leading-tight">
            <div>{row.original.baseUnit}</div>
            {row.original.units.length > 0 && (
              <div className="text-muted-foreground text-xs">{row.original.units.map((u) => u.name).join(', ')}</div>
            )}
          </div>
        ),
      },
      ...warehouseCols.map<ColumnDef<ProductDto>>((w) => ({
        id: `stock-${w.id}`,
        header: w.code,
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => {
          const cell = row.original.stocks.find((s) => s.warehouseId === w.id)
          if (!cell) return <span className="text-muted-foreground">—</span>
          return (
            <span
              className={cn('tabular-nums', CELL_TONE[cell.status])}
              title={`${w.code}: ${stockStatusLabels[cell.status]}`}
            >
              {formatNumber(cell.onHand, 0)}
            </span>
          )
        },
      })),
      {
        id: 'totalOnHand',
        header: 'Tổng tồn',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className="font-medium tabular-nums">{formatNumber(row.original.totalOnHand, 0)}</span>,
      },
      {
        id: 'isActive',
        header: 'Trạng thái',
        cell: ({ row }) =>
          row.original.isActive ? (
            <StatusBadge tone="success">Đang sử dụng</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Ngừng sử dụng</StatusBadge>
          ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Thao tác</span>,
        meta: { className: 'w-14 text-right', headerClassName: 'w-14' },
        cell: ({ row }) => {
          const p = row.original
          return (
            <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Thao tác với ${p.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="text-muted-foreground truncate text-xs font-normal">{p.code}</DropdownMenuLabel>
                  <DropdownMenuItem className="h-9" onSelect={() => open(p)}>
                    {canUpdate ? <Pencil aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    {canUpdate ? 'Sửa, đặt ngưỡng tồn' : 'Xem chi tiết'}
                  </DropdownMenuItem>
                  {canStockCard && (
                    <DropdownMenuItem asChild className="h-9">
                      <Link href={routeTo.stockCard(p.id)}>
                        <BookOpenText aria-hidden="true" /> Thẻ kho
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {canUpdate && (
                    <DropdownMenuItem className="h-9" onSelect={() => setStatusTarget(p)}>
                      {p.isActive ? <Ban aria-hidden="true" /> : <CirclePlay aria-hidden="true" />}
                      {p.isActive ? 'Ngừng sử dụng' : 'Sử dụng lại'}
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        className="h-9"
                        disabled={p.hasDocuments}
                        onSelect={() => setDeleteTarget(p)}
                      >
                        <Trash2 aria-hidden="true" /> Xóa mặt hàng
                      </DropdownMenuItem>
                      {p.hasDocuments && (
                        <p className="bg-muted/60 text-muted-foreground mt-1 rounded-sm px-2 py-1.5 text-xs leading-snug">
                          Mặt hàng đã có chứng từ, không xóa được. Hãy dùng Ngừng sử dụng.
                        </p>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ]
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `open` chỉ phụ thuộc canUpdate
  }, [warehouseCols, canUpdate, canDelete, canStockCard])

  const confirmStatus = async () => {
    if (!statusTarget) return
    const isActive = !statusTarget.isActive
    try {
      await setStatus.mutateAsync({ id: statusTarget.id, isActive })
      toast.success(isActive ? `${statusTarget.code} sử dụng lại` : `${statusTarget.code} đã ngừng sử dụng`)
    } catch (error) {
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove.mutateAsync(deleteTarget.id)
      toast.success(`Đã xóa ${deleteTarget.code}`)
    } catch (error) {
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  const data = products.data

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        getRowId={(p) => p.id}
        onRowClick={open}
        isLoading={products.isLoading}
        isFetching={products.isFetching}
        error={products.error}
        onRetry={() => void products.refetch()}
        minWidth={1100}
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
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
            <SearchInput
              key={searchKey}
              value={table.state.search}
              onSearch={table.setSearch}
              placeholder="Tìm mã, tên (gõ không dấu), mã vạch"
              className="lg:max-w-sm"
            />
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Select
                value={table.state.groupId ?? 'all'}
                onValueChange={(v) => table.setFilter('groupId', v === 'all' ? undefined : v)}
              >
                <SelectTrigger className="sm:w-56" aria-label="Lọc theo nhóm hàng">
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
                value={table.state.isActive === undefined ? 'all' : table.state.isActive ? 'active' : 'inactive'}
                onValueChange={(v) => table.setFilter('isActive', v === 'all' ? undefined : v === 'active')}
              >
                <SelectTrigger className="sm:w-44" aria-label="Lọc theo trạng thái">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mọi trạng thái</SelectItem>
                  <SelectItem value="active">Đang sử dụng</SelectItem>
                  <SelectItem value="inactive">Ngừng sử dụng</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasFilters && (
              <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                <X aria-hidden="true" />
                Xóa lọc
              </Button>
            )}
            {canCreate && (
              <Button className="lg:ml-auto" onClick={() => setSheet({ open: true, id: null, readOnly: false })}>
                <Plus aria-hidden="true" />
                Thêm mặt hàng
              </Button>
            )}
          </div>
        }
        emptyState={
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy mặt hàng phù hợp"
              description="Thử từ khóa khác, quét lại mã vạch hoặc bỏ bớt bộ lọc."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Package} title="Chưa có mặt hàng" description="Thêm mặt hàng để lập phiếu nhập, xuất." />
          )
        }
      />

      <ProductFormSheet
        key={sheet.id ?? 'new'}
        open={sheet.open}
        onOpenChange={(o) => setSheet((s) => ({ ...s, open: o }))}
        productId={sheet.id}
        groups={groups}
        readOnly={sheet.readOnly}
      />
      <ConfirmDialog
        open={!!statusTarget}
        onOpenChange={(o) => !o && setStatusTarget(null)}
        variant={statusTarget?.isActive ? 'destructive' : 'default'}
        icon={statusTarget?.isActive ? Ban : CirclePlay}
        title={statusTarget?.isActive ? 'Ngừng sử dụng mặt hàng này?' : 'Sử dụng lại mặt hàng này?'}
        description={
          statusTarget?.isActive
            ? `${statusTarget?.name} không chọn, không quét được vào phiếu mới; vẫn có trong thẻ kho, báo cáo.`
            : `${statusTarget?.name} chọn lại được khi lập phiếu.`
        }
        confirmText={statusTarget?.isActive ? 'Ngừng sử dụng' : 'Sử dụng lại'}
        loading={setStatus.isPending}
        onConfirm={confirmStatus}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title="Xóa mặt hàng này?"
        description={`${deleteTarget?.code} – ${deleteTarget?.name} chưa có chứng từ và sẽ bị xóa khỏi danh mục.`}
        confirmText="Xóa mặt hàng"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
