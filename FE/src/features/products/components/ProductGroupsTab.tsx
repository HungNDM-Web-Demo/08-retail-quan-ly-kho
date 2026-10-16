'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Ban, CirclePlay, FolderTree, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
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
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { formatNumber } from '@/lib/format'
import type { ProductGroupDto } from '@/types/inventory'
import { useDeleteProductGroup, useSetProductGroupStatus } from '../hooks/use-products'
import { ProductGroupFormDialog } from './ProductGroupFormDialog'

/** Tab Nhóm hàng (UC-01 1a): thêm, đổi tên, ngừng sử dụng; xóa khi không còn mặt hàng (NhomConHang). */
export function ProductGroupsTab({
  groups,
  isLoading,
  error,
  onRetry,
}: {
  groups: ProductGroupDto[] | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
}) {
  const { can } = usePermissions()
  const canCreate = can(permissions.products.create)
  const canUpdate = can(permissions.products.update)
  const canDelete = can(permissions.products.delete)
  const setStatus = useSetProductGroupStatus()
  const remove = useDeleteProductGroup()
  const [form, setForm] = useState<{ open: boolean; group: ProductGroupDto | null }>({ open: false, group: null })
  const [statusTarget, setStatusTarget] = useState<ProductGroupDto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProductGroupDto | null>(null)

  const columns = useMemo<ColumnDef<ProductGroupDto>[]>(() => {
    const list: ColumnDef<ProductGroupDto>[] = [
      {
        id: 'name',
        header: 'Nhóm hàng',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="size-4 shrink-0 rounded-full" style={{ backgroundColor: row.original.color }} aria-hidden="true" />
            <div>
              <div className="font-medium">{row.original.name}</div>
              <div className="text-muted-foreground font-mono text-xs">{row.original.code}</div>
            </div>
          </div>
        ),
      },
      {
        id: 'productCount',
        header: 'Số mặt hàng',
        meta: { className: 'text-right', headerClassName: 'text-right' },
        cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.productCount, 0)}</span>,
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
    ]
    if (canUpdate || canDelete) {
      list.push({
        id: 'actions',
        header: () => <span className="sr-only">Thao tác</span>,
        meta: { className: 'w-14 text-right', headerClassName: 'w-14' },
        cell: ({ row }) => {
          const g = row.original
          return (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Thao tác với nhóm ${g.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-muted-foreground truncate text-xs font-normal">{g.name}</DropdownMenuLabel>
                {canUpdate && (
                  <>
                    <DropdownMenuItem className="h-9" onSelect={() => setForm({ open: true, group: g })}>
                      <Pencil aria-hidden="true" /> Đổi tên, màu
                    </DropdownMenuItem>
                    <DropdownMenuItem className="h-9" onSelect={() => setStatusTarget(g)}>
                      {g.isActive ? <Ban aria-hidden="true" /> : <CirclePlay aria-hidden="true" />}
                      {g.isActive ? 'Ngừng sử dụng' : 'Sử dụng lại'}
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      className="h-9"
                      disabled={g.productCount > 0}
                      onSelect={() => setDeleteTarget(g)}
                    >
                      <Trash2 aria-hidden="true" /> Xóa nhóm
                    </DropdownMenuItem>
                    {g.productCount > 0 && (
                      <p className="bg-muted/60 text-muted-foreground mt-1 rounded-sm px-2 py-1.5 text-xs leading-snug">
                        Nhóm đang có {formatNumber(g.productCount, 0)} mặt hàng, chuyển mặt hàng sang nhóm khác trước.
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
      toast.success(isActive ? `Nhóm ${statusTarget.name} sử dụng lại` : `Nhóm ${statusTarget.name} đã ngừng sử dụng`)
    } catch (e) {
      toast.error(getErrorMessage(e))
      throw e
    }
  }
  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await remove.mutateAsync(deleteTarget.id)
      toast.success(`Đã xóa nhóm ${deleteTarget.name}`)
    } catch (e) {
      toast.error(getErrorMessage(e))
      throw e
    }
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={groups}
        getRowId={(g) => g.id}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
        minWidth={640}
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              Nhóm ngừng sử dụng không chọn được cho mặt hàng mới, vẫn dùng để lọc.
            </p>
            {canCreate && (
              <Button onClick={() => setForm({ open: true, group: null })}>
                <Plus aria-hidden="true" />
                Thêm nhóm hàng
              </Button>
            )}
          </div>
        }
        emptyState={<EmptyState icon={FolderTree} title="Chưa có nhóm hàng" />}
      />
      <ProductGroupFormDialog
        key={form.group?.id ?? 'new'}
        open={form.open}
        onOpenChange={(o) => setForm((s) => ({ ...s, open: o }))}
        group={form.group}
      />
      <ConfirmDialog
        open={!!statusTarget}
        onOpenChange={(o) => !o && setStatusTarget(null)}
        icon={statusTarget?.isActive ? Ban : CirclePlay}
        variant={statusTarget?.isActive ? 'destructive' : 'default'}
        title={statusTarget?.isActive ? `Ngừng nhóm ${statusTarget.name}?` : `Sử dụng lại nhóm ${statusTarget?.name}?`}
        description={
          statusTarget?.isActive
            ? 'Mặt hàng hiện có trong nhóm giữ nguyên; nhóm không chọn được cho mặt hàng mới.'
            : 'Nhóm chọn lại được khi thêm, sửa mặt hàng.'
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
        title={`Xóa nhóm ${deleteTarget?.name}?`}
        description="Nhóm không còn mặt hàng nào và sẽ bị xóa khỏi danh mục."
        confirmText="Xóa nhóm"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
