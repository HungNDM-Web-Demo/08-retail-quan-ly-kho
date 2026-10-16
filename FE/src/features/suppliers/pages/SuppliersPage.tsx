'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Ban, CirclePlay, MoreHorizontal, Pencil, Plus, SearchX, Trash2, Truck, X } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
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
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { getErrorMessage } from '@/lib/api-error'
import { formatDate, formatNumber, formatPhone } from '@/lib/format'
import type { SupplierDto } from '@/types/inventory'
import { SupplierFormDialog } from '../components/SupplierFormDialog'
import { useDeleteSupplier, useSetSupplierStatus, useSuppliers } from '../hooks/use-suppliers'

type Filters = { isActive: boolean }

/** SCR-03 Nhà cung cấp (UC-02 1a, FR-06, BR-24). */
export function SuppliersPage() {
  const { can } = usePermissions()
  const canCreate = can(permissions.suppliers.create)
  const canUpdate = can(permissions.suppliers.update)
  const canDelete = can(permissions.suppliers.delete)

  const table = useTableQuery<Filters>({ pageSize: 20 })
  const suppliers = useSuppliers(table.query)
  const setStatus = useSetSupplierStatus()
  const remove = useDeleteSupplier()

  const [form, setForm] = useState<{ open: boolean; supplier: SupplierDto | null }>({ open: false, supplier: null })
  const [statusTarget, setStatusTarget] = useState<SupplierDto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SupplierDto | null>(null)
  const [searchKey, setSearchKey] = useState(0)
  const hasFilters = !!table.state.search || table.state.isActive !== undefined
  const clearFilters = () => {
    table.resetFilters()
    setSearchKey((k) => k + 1)
  }

  const columns = useMemo<ColumnDef<SupplierDto>[]>(() => {
    const list: ColumnDef<SupplierDto>[] = [
      {
        id: 'code',
        header: 'Mã',
        enableSorting: true,
        meta: { className: 'w-28' },
        cell: ({ row }) => <span className="font-mono text-sm font-medium">{row.original.code}</span>,
      },
      {
        id: 'name',
        header: 'Nhà cung cấp',
        enableSorting: true,
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-medium">{row.original.name}</div>
            {row.original.address && (
              <div className="text-muted-foreground line-clamp-1 text-xs">{row.original.address}</div>
            )}
          </div>
        ),
      },
      {
        id: 'contact',
        header: 'Liên hệ',
        cell: ({ row }) => (
          <div className="text-sm leading-tight">
            <div>{row.original.contactName || <span className="text-muted-foreground">—</span>}</div>
            <div className="text-muted-foreground mt-0.5 tabular-nums">{formatPhone(row.original.phone, '')}</div>
          </div>
        ),
      },
      {
        id: 'taxCode',
        header: 'Mã số thuế',
        cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.taxCode ?? '—'}</span>,
      },
      {
        id: 'receiptCount',
        header: 'Phiếu nhập đã duyệt',
        // Số phiếu tính từ phiếu nhập, không phải cột của bảng nhà cung cấp: API không sắp theo cột này
        enableSorting: false,
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => (
          <div className="text-right text-sm leading-tight">
            <div className="font-medium tabular-nums">{formatNumber(row.original.receiptCount, 0)}</div>
            {row.original.lastReceiptAt && (
              <div className="text-muted-foreground text-xs">Gần nhất {formatDate(row.original.lastReceiptAt)}</div>
            )}
          </div>
        ),
      },
      {
        id: 'isActive',
        header: 'Trạng thái',
        cell: ({ row }) =>
          row.original.isActive ? (
            <StatusBadge tone="success">Đang giao dịch</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Ngừng giao dịch</StatusBadge>
          ),
      },
    ]
    if (canUpdate || canDelete) {
      list.push({
        id: 'actions',
        header: () => <span className="sr-only">Thao tác</span>,
        meta: { className: 'w-14 text-right', headerClassName: 'w-14' },
        cell: ({ row }) => {
          const s = row.original
          return (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Thao tác với ${s.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-muted-foreground truncate text-xs font-normal">{s.name}</DropdownMenuLabel>
                {canUpdate && (
                  <>
                    <DropdownMenuItem className="h-9" onSelect={() => setForm({ open: true, supplier: s })}>
                      <Pencil aria-hidden="true" /> Sửa thông tin
                    </DropdownMenuItem>
                    <DropdownMenuItem className="h-9" onSelect={() => setStatusTarget(s)}>
                      {s.isActive ? <Ban aria-hidden="true" /> : <CirclePlay aria-hidden="true" />}
                      {s.isActive ? 'Ngừng giao dịch' : 'Giao dịch lại'}
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      className="h-9"
                      disabled={s.hasDocuments}
                      onSelect={() => setDeleteTarget(s)}
                    >
                      <Trash2 aria-hidden="true" /> Xóa nhà cung cấp
                    </DropdownMenuItem>
                    {s.hasDocuments && (
                      <p className="bg-muted/60 text-muted-foreground mt-1 rounded-sm px-2 py-1.5 text-xs leading-snug">
                        Đã có chứng từ, không xóa được. Hãy dùng Ngừng giao dịch.
                      </p>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      })
    }
    return list
  }, [canUpdate, canDelete])

  const confirmStatus = async () => {
    if (!statusTarget) return
    const isActive = !statusTarget.isActive
    try {
      await setStatus.mutateAsync({ id: statusTarget.id, isActive })
      toast.success(isActive ? `${statusTarget.code} giao dịch lại` : `${statusTarget.code} đã ngừng giao dịch`)
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

  const data = suppliers.data

  return (
    <PermissionGuard permission={permissions.suppliers.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Nhà cung cấp"
          icon={Truck}
          description="Nhà cung cấp hàng cho các kho. Ngừng giao dịch thì không chọn được vào phiếu mới, lịch sử vẫn giữ."
          actions={
            canCreate && (
              <Button onClick={() => setForm({ open: true, supplier: null })}>
                <Plus aria-hidden="true" />
                Thêm nhà cung cấp
              </Button>
            )
          }
        />
        <DataTable
          columns={columns}
          data={data?.items}
          getRowId={(s) => s.id}
          isLoading={suppliers.isLoading}
          isFetching={suppliers.isFetching}
          error={suppliers.error}
          onRetry={() => void suppliers.refetch()}
          minWidth={980}
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
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <SearchInput
                key={searchKey}
                value={table.state.search}
                onSearch={table.setSearch}
                placeholder="Tìm mã, tên, mã số thuế, số điện thoại"
                className="sm:max-w-sm"
              />
              <Select
                value={table.state.isActive === undefined ? 'all' : table.state.isActive ? 'active' : 'inactive'}
                onValueChange={(v) => table.setFilter('isActive', v === 'all' ? undefined : v === 'active')}
              >
                <SelectTrigger className="sm:w-48" aria-label="Lọc theo trạng thái">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mọi trạng thái</SelectItem>
                  <SelectItem value="active">Đang giao dịch</SelectItem>
                  <SelectItem value="inactive">Ngừng giao dịch</SelectItem>
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground sm:ml-auto">
                  <X aria-hidden="true" />
                  Xóa lọc
                </Button>
              )}
            </div>
          }
          emptyState={
            hasFilters ? (
              <EmptyState
                icon={SearchX}
                title="Không tìm thấy nhà cung cấp phù hợp"
                description="Thử từ khóa khác hoặc bỏ bớt bộ lọc."
                action={
                  <Button variant="outline" onClick={clearFilters}>
                    Xóa bộ lọc
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={Truck} title="Chưa có nhà cung cấp" description="Thêm nhà cung cấp để lập phiếu nhập mua hàng." />
            )
          }
        />
      </div>

      <SupplierFormDialog
        key={form.supplier?.id ?? 'new'}
        open={form.open}
        onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
        supplier={form.supplier}
      />
      <ConfirmDialog
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        variant={statusTarget?.isActive ? 'destructive' : 'default'}
        icon={statusTarget?.isActive ? Ban : CirclePlay}
        title={statusTarget?.isActive ? 'Ngừng giao dịch nhà cung cấp này?' : 'Giao dịch lại với nhà cung cấp này?'}
        description={
          statusTarget?.isActive
            ? `${statusTarget?.name} sẽ không chọn được vào phiếu nhập mới. Phiếu cũ, báo cáo vẫn giữ nguyên.`
            : `${statusTarget?.name} chọn lại được khi lập phiếu.`
        }
        confirmText={statusTarget?.isActive ? 'Ngừng giao dịch' : 'Giao dịch lại'}
        loading={setStatus.isPending}
        onConfirm={confirmStatus}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title="Xóa nhà cung cấp này?"
        description={`${deleteTarget?.code} – ${deleteTarget?.name} chưa có chứng từ nào và sẽ bị xóa khỏi danh mục.`}
        confirmText="Xóa"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </PermissionGuard>
  )
}
