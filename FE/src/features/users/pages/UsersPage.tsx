'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { KeyRound, Lock, LockOpen, MoreHorizontal, Pencil, Plus, SearchX, Trash2, UserPlus, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { UserAvatar } from '@/components/shared/UserAvatar'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { permissions } from '@/config/permissions'
import { useRoles } from '@/features/roles/hooks/use-roles'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { getErrorMessage } from '@/lib/api-error'
import { formatDate, formatDateTime, formatPhone, formatRelativeTime } from '@/lib/format'
import { ResetPasswordDialog } from '../components/ResetPasswordDialog'
import { UserFormDialog } from '../components/UserFormDialog'
import { useDeleteUser, useLockUser, useUsers } from '../hooks/use-users'
import type { UserDto } from '../types/user.types'

type Filters = { roleId: string; isActive: boolean }
type FormState = { open: boolean; user: UserDto | null }

/** BR-SYS-05, BR-SYS-10: lý do không được khóa/xóa/đặt lại mật khẩu (null là được). */
function protectedReason(user: UserDto, currentUserId?: string): string | null {
  if (user.isDemoAccount) return 'Tài khoản demo không được khóa, xóa hay đặt lại mật khẩu.'
  if (user.id === currentUserId) return 'Không thể tự khóa, xóa hay đặt lại mật khẩu của chính mình. Đổi mật khẩu ở Hồ sơ cá nhân.'
  return null
}

/** SCR-SYS-03: quản lý tài khoản (UC-SYS-05). */
export function UsersPage() {
  const { can, user: me } = usePermissions()
  const canCreate = can(permissions.users.create)
  const canUpdate = can(permissions.users.update)
  const canDelete = can(permissions.users.delete)

  const table = useTableQuery<Filters>({ pageSize: 10 })
  const users = useUsers(table.query)
  const roles = useRoles({ enabled: can(permissions.roles.view) })
  const lockUser = useLockUser()
  const deleteUser = useDeleteUser()

  const [form, setForm] = useState<FormState>({ open: false, user: null })
  const [resetTarget, setResetTarget] = useState<UserDto | null>(null)
  const [lockTarget, setLockTarget] = useState<UserDto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserDto | null>(null)
  const [searchKey, setSearchKey] = useState(0)

  const hasFilters = !!table.state.search || !!table.state.roleId || table.state.isActive !== undefined

  const clearFilters = () => {
    table.resetFilters()
    setSearchKey((k) => k + 1)
  }

  const columns = useMemo<ColumnDef<UserDto>[]>(() => {
    const list: ColumnDef<UserDto>[] = [
      {
        id: 'fullName',
        header: 'Tài khoản',
        enableSorting: true,
        cell: ({ row }) => {
          const u = row.original
          return (
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar name={u.fullName} avatarUrl={u.avatarUrl} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate font-medium">{u.fullName}</span>
                  {u.id === me?.id && <StatusBadge tone="primary" dot={false}>Bạn</StatusBadge>}
                  {u.isDemoAccount && <StatusBadge tone="warning" dot={false}>Demo</StatusBadge>}
                </div>
                <span className="text-muted-foreground text-xs">@{u.username}</span>
              </div>
            </div>
          )
        },
      },
      {
        id: 'contact',
        header: 'Liên hệ',
        cell: ({ row }) => (
          <div className="text-sm leading-tight">
            <div className="truncate">{row.original.email || <span className="text-muted-foreground">Chưa có email</span>}</div>
            <div className="text-muted-foreground mt-0.5 tabular-nums">{formatPhone(row.original.phone, '')}</div>
          </div>
        ),
      },
      {
        id: 'roles',
        header: 'Vai trò',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.roles.map((r) => (
              <Badge key={r.id} variant="outline" className="h-6 font-normal">
                {r.name}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: 'isActive',
        header: 'Trạng thái',
        cell: ({ row }) =>
          row.original.isActive ? (
            <StatusBadge tone="success">Đang hoạt động</StatusBadge>
          ) : (
            <StatusBadge tone="danger">Đã khóa</StatusBadge>
          ),
      },
      {
        id: 'lastLoginAt',
        header: 'Đăng nhập gần nhất',
        enableSorting: true,
        cell: ({ row }) =>
          row.original.lastLoginAt ? (
            <span className="text-sm" title={formatDateTime(row.original.lastLoginAt)}>
              {formatRelativeTime(row.original.lastLoginAt)}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">Chưa đăng nhập</span>
          ),
      },
      {
        id: 'createdAt',
        header: 'Ngày tạo',
        enableSorting: true,
        cell: ({ row }) => <span className="text-sm tabular-nums">{formatDate(row.original.createdAt)}</span>,
      },
    ]

    if (canUpdate || canDelete) {
      list.push({
        id: 'actions',
        header: () => <span className="sr-only">Thao tác</span>,
        meta: { className: 'w-14 text-right', headerClassName: 'w-14' },
        cell: ({ row }) => {
          const u = row.original
          const reason = protectedReason(u, me?.id)
          return (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Thao tác với ${u.fullName}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-muted-foreground truncate text-xs font-normal">{u.fullName}</DropdownMenuLabel>
                {canUpdate && (
                  <>
                    <DropdownMenuItem className="h-9" onSelect={() => setForm({ open: true, user: u })}>
                      <Pencil aria-hidden="true" /> Sửa thông tin, vai trò
                    </DropdownMenuItem>
                    <DropdownMenuItem className="h-9" disabled={!!reason} onSelect={() => setLockTarget(u)}>
                      {u.isActive ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
                      {u.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="h-9" disabled={!!reason} onSelect={() => setResetTarget(u)}>
                      <KeyRound aria-hidden="true" /> Đặt lại mật khẩu
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      className="h-9"
                      disabled={!!reason}
                      onSelect={() => setDeleteTarget(u)}
                    >
                      <Trash2 aria-hidden="true" /> Xóa tài khoản
                    </DropdownMenuItem>
                  </>
                )}
                {reason && (
                  <p className="bg-muted/60 text-muted-foreground mt-1 rounded-sm px-2 py-1.5 text-xs leading-snug">{reason}</p>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      })
    }
    return list
  }, [canUpdate, canDelete, me?.id])

  const confirmLock = async () => {
    if (!lockTarget) return
    const isActive = !lockTarget.isActive
    try {
      await lockUser.mutateAsync({ id: lockTarget.id, isActive })
      toast.success(isActive ? `Đã mở khóa ${lockTarget.username}` : `Đã khóa ${lockTarget.username}`)
    } catch (error) {
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteUser.mutateAsync(deleteTarget.id)
      toast.success(`Đã xóa tài khoản ${deleteTarget.username}`)
    } catch (error) {
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  const roleOptions = roles.data ?? []

  return (
    <PermissionGuard permission={permissions.users.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Tài khoản"
          icon={Users}
          description="Quản lý người dùng đăng nhập hệ thống, vai trò và trạng thái hoạt động."
          actions={
            canCreate && (
              <Button onClick={() => setForm({ open: true, user: null })}>
                <Plus aria-hidden="true" />
                Thêm tài khoản
              </Button>
            )
          }
        />

        <DataTable
          columns={columns}
          data={users.data?.items}
          getRowId={(u) => u.id}
          isLoading={users.isLoading}
          isFetching={users.isFetching}
          error={users.error}
          onRetry={() => void users.refetch()}
          minWidth={960}
          sorting={{ sortBy: table.state.sortBy, sortDir: table.state.sortDir, onSortChange: table.setSort }}
          pagination={
            users.data && {
              page: users.data.page,
              pageSize: users.data.pageSize,
              totalCount: users.data.totalCount,
              totalPages: users.data.totalPages,
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
                placeholder="Tìm tên, tên đăng nhập, email, SĐT"
                className="sm:max-w-sm"
              />
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Select
                  value={table.state.roleId ?? 'all'}
                  onValueChange={(v) => table.setFilter('roleId', v === 'all' ? undefined : v)}
                  disabled={!roleOptions.length}
                >
                  <SelectTrigger className="sm:w-44" aria-label="Lọc theo vai trò">
                    <SelectValue placeholder="Vai trò" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả vai trò</SelectItem>
                    {roleOptions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={table.state.isActive === undefined ? 'all' : table.state.isActive ? 'active' : 'locked'}
                  onValueChange={(v) => table.setFilter('isActive', v === 'all' ? undefined : v === 'active')}
                >
                  <SelectTrigger className="sm:w-44" aria-label="Lọc theo trạng thái">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Mọi trạng thái</SelectItem>
                    <SelectItem value="active">Đang hoạt động</SelectItem>
                    <SelectItem value="locked">Đã khóa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                title="Không tìm thấy tài khoản phù hợp"
                description="Thử từ khóa khác hoặc bỏ bớt bộ lọc."
                action={
                  <Button variant="outline" onClick={clearFilters}>
                    Xóa bộ lọc
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={UserPlus}
                title="Chưa có tài khoản nào"
                description="Thêm tài khoản để nhân viên đăng nhập và làm việc."
                action={
                  canCreate && (
                    <Button onClick={() => setForm({ open: true, user: null })}>
                      <Plus aria-hidden="true" />
                      Thêm tài khoản
                    </Button>
                  )
                }
              />
            )
          }
        />
      </div>

      <UserFormDialog
        key={form.user?.id ?? 'new'}
        open={form.open}
        onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
        user={form.user}
        roles={roleOptions}
        rolesLoading={roles.isLoading}
      />
      <ResetPasswordDialog user={resetTarget} onOpenChange={(open) => !open && setResetTarget(null)} />
      <ConfirmDialog
        open={!!lockTarget}
        onOpenChange={(open) => !open && setLockTarget(null)}
        variant={lockTarget?.isActive ? 'destructive' : 'default'}
        icon={lockTarget?.isActive ? Lock : LockOpen}
        title={lockTarget?.isActive ? 'Khóa tài khoản này?' : 'Mở khóa tài khoản này?'}
        description={
          lockTarget?.isActive
            ? `${lockTarget?.fullName} sẽ không đăng nhập được nữa; phiên đang mở bị thu hồi ở lần gia hạn kế tiếp.`
            : `${lockTarget?.fullName} sẽ đăng nhập lại được bình thường.`
        }
        confirmText={lockTarget?.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
        loading={lockUser.isPending}
        onConfirm={confirmLock}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        variant="destructive"
        icon={Trash2}
        title="Xóa tài khoản này?"
        description={`Tài khoản ${deleteTarget?.fullName} (@${deleteTarget?.username}) sẽ bị xóa và không đăng nhập được nữa.`}
        confirmText="Xóa tài khoản"
        loading={deleteUser.isPending}
        onConfirm={confirmDelete}
      />
    </PermissionGuard>
  )
}
