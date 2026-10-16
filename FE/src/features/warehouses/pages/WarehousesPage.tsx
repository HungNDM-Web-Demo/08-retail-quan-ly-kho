'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Ban,
  CirclePlay,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserRoundCog,
  Warehouse,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { formatNumber, formatPhone, formatVnd } from '@/lib/format'
import type { WarehouseDto } from '@/types/inventory'
import { WarehouseFormDialog } from '../components/WarehouseFormDialog'
import { useDeleteWarehouse, useSetWarehouseStatus, useWarehouses } from '../hooks/use-warehouses'

type FormState = { open: boolean; warehouse: WarehouseDto | null; mode: 'full' | 'keepers' }

/** SCR-04 Kho và thủ kho phụ trách (UC-02, FR-04, FR-05, BR-23, BR-24). */
export function WarehousesPage() {
  const { can } = usePermissions()
  const canCreate = can(permissions.warehouses.create)
  const canUpdate = can(permissions.warehouses.update)
  const canDelete = can(permissions.warehouses.delete)
  const canAssign = can(permissions.warehouses.assign)
  const canViewValues = can(permissions.stockValues.view)

  const warehouses = useWarehouses()
  const setStatus = useSetWarehouseStatus()
  const remove = useDeleteWarehouse()
  const [form, setForm] = useState<FormState>({ open: false, warehouse: null, mode: 'full' })
  const [statusTarget, setStatusTarget] = useState<WarehouseDto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WarehouseDto | null>(null)

  const rows = warehouses.data
  const activeRows = rows?.filter((w) => w.isActive) ?? []
  const totalValue = activeRows.reduce((sum, w) => sum + (w.stockValue ?? 0), 0)

  const columns = useMemo<ColumnDef<WarehouseDto>[]>(() => {
    const list: ColumnDef<WarehouseDto>[] = [
      {
        id: 'name',
        header: 'Kho',
        cell: ({ row }) => {
          const w = row.original
          return (
            <div className="flex min-w-0 items-start gap-3">
              <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg font-mono text-[0.7rem] font-semibold">
                {w.code}
              </span>
              <div className="min-w-0">
                <div className="font-medium">{w.name}</div>
                {w.address && (
                  <div className="text-muted-foreground flex items-start gap-1 text-xs">
                    <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                    <span className="line-clamp-1">{w.address}</span>
                  </div>
                )}
                {w.phone && (
                  <div className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
                    <Phone className="size-3 shrink-0" aria-hidden="true" />
                    {formatPhone(w.phone)}
                  </div>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: 'keepers',
        header: 'Thủ kho phụ trách',
        cell: ({ row }) =>
          row.original.keepers.length ? (
            <div className="flex flex-wrap gap-1">
              {row.original.keepers.map((k) => (
                <Badge key={k.id} variant="outline" className="h-6 font-normal" title={`@${k.username}`}>
                  {k.fullName}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-warning text-sm">Chưa gán thủ kho</span>
          ),
      },
      {
        id: 'stockedProductCount',
        header: 'Mặt hàng còn tồn',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => (
          <Link
            href={`${routePath.stock}?warehouseId=${row.original.id}&inStockOnly=1`}
            className="text-primary font-medium tabular-nums underline-offset-4 hover:underline"
          >
            {formatNumber(row.original.stockedProductCount, 0)}
          </Link>
        ),
      },
    ]
    if (canViewValues) {
      list.push({
        id: 'stockValue',
        header: 'Giá trị tồn',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className="font-medium tabular-nums">{formatVnd(row.original.stockValue)}</span>,
      })
    }
    list.push(
      {
        id: 'openDocumentCount',
        header: 'Phiếu chưa kết thúc',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatNumber(row.original.openDocumentCount, 0)}</span>
        ),
      },
      {
        id: 'isActive',
        header: 'Trạng thái',
        cell: ({ row }) =>
          row.original.isActive ? (
            <StatusBadge tone="success">Đang hoạt động</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Ngừng hoạt động</StatusBadge>
          ),
      }
    )
    if (canUpdate || canDelete || canAssign) {
      list.push({
        id: 'actions',
        header: () => <span className="sr-only">Thao tác</span>,
        meta: { className: 'w-14 text-right', headerClassName: 'w-14' },
        cell: ({ row }) => {
          const w = row.original
          return (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Thao tác với ${w.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-muted-foreground truncate text-xs font-normal">
                  {w.code} · {w.name}
                </DropdownMenuLabel>
                {canUpdate && (
                  <DropdownMenuItem className="h-9" onSelect={() => setForm({ open: true, warehouse: w, mode: 'full' })}>
                    <Pencil aria-hidden="true" /> Sửa thông tin
                  </DropdownMenuItem>
                )}
                {canAssign && (
                  <DropdownMenuItem className="h-9" onSelect={() => setForm({ open: true, warehouse: w, mode: 'keepers' })}>
                    <UserRoundCog aria-hidden="true" /> Thủ kho phụ trách
                  </DropdownMenuItem>
                )}
                {canUpdate && (
                  <DropdownMenuItem className="h-9" onSelect={() => setStatusTarget(w)}>
                    {w.isActive ? <Ban aria-hidden="true" /> : <CirclePlay aria-hidden="true" />}
                    {w.isActive ? 'Ngừng hoạt động' : 'Hoạt động lại'}
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      className="h-9"
                      disabled={w.hasDocuments}
                      onSelect={() => setDeleteTarget(w)}
                    >
                      <Trash2 aria-hidden="true" /> Xóa kho
                    </DropdownMenuItem>
                    {w.hasDocuments && (
                      <p className="bg-muted/60 text-muted-foreground mt-1 rounded-sm px-2 py-1.5 text-xs leading-snug">
                        Kho đã có chứng từ, không xóa được. Hãy dùng Ngừng hoạt động.
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
  }, [canUpdate, canDelete, canAssign, canViewValues])

  const confirmStatus = async () => {
    if (!statusTarget) return
    const isActive = !statusTarget.isActive
    try {
      await setStatus.mutateAsync({ id: statusTarget.id, isActive })
      toast.success(isActive ? `Kho ${statusTarget.code} hoạt động lại` : `Kho ${statusTarget.code} đã ngừng hoạt động`)
    } catch (error) {
      // KhoConTon (TC-05): hiện nguyên câu của BE, kho vẫn hoạt động
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove.mutateAsync(deleteTarget.id)
      toast.success(`Đã xóa kho ${deleteTarget.code}`)
    } catch (error) {
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  return (
    <PermissionGuard permission={permissions.warehouses.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Kho"
          icon={Warehouse}
          description={
            canViewValues && rows
              ? `${activeRows.length} kho đang hoạt động · tổng giá trị tồn ${formatVnd(totalValue)}`
              : 'Kho, địa chỉ in trên phiếu và thủ kho phụ trách từng kho.'
          }
          actions={
            canCreate && (
              <Button onClick={() => setForm({ open: true, warehouse: null, mode: 'full' })}>
                <Plus aria-hidden="true" />
                Thêm kho
              </Button>
            )
          }
        />
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(w) => w.id}
          isLoading={warehouses.isLoading}
          isFetching={warehouses.isFetching}
          error={warehouses.error}
          onRetry={() => void warehouses.refetch()}
          minWidth={980}
          emptyState={<EmptyState icon={Warehouse} title="Chưa có kho" description="Thêm kho đầu tiên để bắt đầu nhập hàng." />}
        />
      </div>

      <WarehouseFormDialog
        key={`${form.warehouse?.id ?? 'new'}-${form.mode}`}
        open={form.open}
        onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
        warehouse={form.warehouse}
        canAssign={canAssign}
        mode={form.mode}
      />
      <ConfirmDialog
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        variant={statusTarget?.isActive ? 'destructive' : 'default'}
        icon={statusTarget?.isActive ? Ban : CirclePlay}
        title={statusTarget?.isActive ? `Ngừng hoạt động kho ${statusTarget.code}?` : `Cho kho ${statusTarget?.code} hoạt động lại?`}
        description={
          statusTarget?.isActive
            ? 'Kho ngừng hoạt động không chọn được vào phiếu mới. Chỉ ngừng được khi kho không còn tồn và không còn phiếu chưa kết thúc.'
            : 'Kho chọn lại được khi lập phiếu.'
        }
        confirmText={statusTarget?.isActive ? 'Ngừng hoạt động' : 'Hoạt động lại'}
        loading={setStatus.isPending}
        onConfirm={confirmStatus}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title={`Xóa kho ${deleteTarget?.code}?`}
        description={`${deleteTarget?.name} chưa có chứng từ, tồn và sẽ bị xóa khỏi danh mục.`}
        confirmText="Xóa kho"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </PermissionGuard>
  )
}
