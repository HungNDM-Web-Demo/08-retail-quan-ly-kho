'use client'

import { useState } from 'react'
import { Info, Loader2, Pencil, Plus, Save, ShieldCheck, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { permissions, roleCodes } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { PermissionMatrix } from '../components/PermissionMatrix'
import { RoleFormDialog } from '../components/RoleFormDialog'
import { RoleList } from '../components/RoleList'
import { useDeleteRole, usePermissionGroups, useRoles, useUpdateRolePermissions } from '../hooks/use-roles'
import type { RoleDto } from '../types/role.types'

type Draft = { roleId: string; codes: string[] }

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

/** Lý do không xóa được vai trò (BR-SYS-06, BR-SYS-07); null là xóa được. */
function deleteBlockedReason(role: RoleDto): string | null {
  if (role.isSystem) return 'Vai trò hệ thống không xóa được.'
  if (role.userCount > 0) return `Đang gán cho ${role.userCount} tài khoản, đổi vai trò các tài khoản đó trước khi xóa.`
  return null
}

/** SCR-SYS-04: vai trò và ma trận quyền (UC-SYS-06). */
export function RolesPage() {
  const { can } = usePermissions()
  const canCreate = can(permissions.roles.create)
  const canUpdate = can(permissions.roles.update)
  const canDelete = can(permissions.roles.delete)

  const roles = useRoles()
  const groups = usePermissionGroups()
  const savePermissions = useUpdateRolePermissions()
  const deleteRole = useDeleteRole()

  const [selectedId, setSelectedId] = useState<string>()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pendingSelect, setPendingSelect] = useState<RoleDto | null>(null)
  const [form, setForm] = useState<{ open: boolean; role: RoleDto | null }>({ open: false, role: null })
  const [deleteOpen, setDeleteOpen] = useState(false)

  const list = roles.data ?? []
  const selected = list.find((r) => r.id === selectedId) ?? list[0]
  const isAdminRole = selected?.code === roleCodes.admin
  const readOnly = !canUpdate || isAdminRole
  const current = draft && draft.roleId === selected?.id ? draft.codes : (selected?.permissions ?? [])
  const dirty = !!selected && !!draft && draft.roleId === selected.id && !sameSet(draft.codes, selected.permissions)
  const changeCount = selected
    ? current.filter((c) => !selected.permissions.includes(c)).length +
      selected.permissions.filter((c) => !current.includes(c)).length
    : 0

  const select = (role: RoleDto) => {
    if (role.id === selected?.id) return
    if (dirty) {
      setPendingSelect(role)
      return
    }
    setDraft(null)
    setSelectedId(role.id)
  }

  const handleSave = () => {
    if (!selected) return
    savePermissions.mutate(
      { id: selected.id, permissions: current },
      {
        onSuccess: (saved) => {
          setDraft(null)
          toast.success(`Đã lưu phân quyền cho ${saved.name}`, {
            description: 'Người dùng thuộc vai trò này thấy thay đổi ở lần tải trang kế tiếp.',
          })
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  }

  const confirmDelete = async () => {
    if (!selected) return
    try {
      await deleteRole.mutateAsync(selected.id)
      toast.success(`Đã xóa vai trò ${selected.name}`)
      setDraft(null)
      setSelectedId(undefined)
    } catch (error) {
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  const blockedReason = selected ? deleteBlockedReason(selected) : null

  return (
    <PermissionGuard permission={permissions.roles.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Vai trò và phân quyền"
          icon={ShieldCheck}
          description="Mỗi vai trò là một bộ quyền; tài khoản được gán vai trò nào thì thấy menu và nút của vai trò đó."
          actions={
            canCreate && (
              <Button onClick={() => setForm({ open: true, role: null })}>
                <Plus aria-hidden="true" />
                Thêm vai trò
              </Button>
            )
          }
        />

        {roles.error ? (
          <div className="bg-card rounded-xl border">
            <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
            <RoleList roles={roles.data} isLoading={roles.isLoading} selectedId={selected?.id} onSelect={select} />

            <section aria-label="Phân quyền vai trò" className="bg-card min-w-0 overflow-hidden rounded-xl border shadow-xs">
              {!selected ? (
                roles.isLoading ? (
                  <div className="space-y-4 p-6">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-64 w-full" />
                  </div>
                ) : (
                  <EmptyState title="Chưa có vai trò" description="Thêm vai trò để bắt đầu phân quyền." />
                )
              ) : (
                <>
                  <header className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{selected.name}</h2>
                        <StatusBadge tone="neutral" dot={false} className="font-mono">
                          {selected.code}
                        </StatusBadge>
                        {selected.isSystem && <StatusBadge tone="info">Hệ thống</StatusBadge>}
                      </div>
                      {selected.description && <p className="text-muted-foreground text-sm">{selected.description}</p>}
                      <p className="text-muted-foreground text-xs">
                        {selected.userCount} tài khoản · {current.length} quyền
                      </p>
                    </div>
                    {(canUpdate || canDelete) && (
                      <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end">
                        <div className="flex gap-2">
                          {canUpdate && (
                            <Button variant="outline" size="sm" onClick={() => setForm({ open: true, role: selected })}>
                              <Pencil aria-hidden="true" />
                              Sửa
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="destructive" size="sm" disabled={!!blockedReason} onClick={() => setDeleteOpen(true)}>
                              <Trash2 aria-hidden="true" />
                              Xóa
                            </Button>
                          )}
                        </div>
                        {canDelete && blockedReason && (
                          <p className="text-muted-foreground max-w-64 text-xs sm:text-right">{blockedReason}</p>
                        )}
                      </div>
                    )}
                  </header>

                  {(isAdminRole || !canUpdate) && (
                    <div className="bg-info/8 text-info flex items-start gap-2 border-b px-4 py-3 text-sm sm:px-5" role="note">
                      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      {isAdminRole
                        ? 'Quản trị viên luôn có toàn bộ quyền (BR-SYS-06), không cần phân quyền.'
                        : 'Bạn chỉ có quyền xem phân quyền, không chỉnh sửa được.'}
                    </div>
                  )}

                  {groups.isLoading ? (
                    <div className="space-y-3 p-5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : groups.error ? (
                    <ErrorState error={groups.error} onRetry={() => void groups.refetch()} />
                  ) : (
                    <PermissionMatrix
                      groups={groups.data ?? []}
                      value={current}
                      readOnly={readOnly || savePermissions.isPending}
                      onChange={(codes) => setDraft({ roleId: selected.id, codes })}
                    />
                  )}

                  {!readOnly && (
                    <footer className="bg-muted/30 flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <p className="text-muted-foreground text-sm" aria-live="polite">
                        {dirty ? (
                          <span className="text-foreground font-medium">Có {changeCount} thay đổi chưa lưu</span>
                        ) : (
                          'Tick hoặc bỏ tick quyền rồi bấm Lưu.'
                        )}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" disabled={!dirty || savePermissions.isPending} onClick={() => setDraft(null)}>
                          <Undo2 aria-hidden="true" />
                          Hoàn tác
                        </Button>
                        <Button disabled={!dirty || savePermissions.isPending} onClick={handleSave}>
                          {savePermissions.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                          Lưu phân quyền
                        </Button>
                      </div>
                    </footer>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>

      <RoleFormDialog
        key={form.role?.id ?? 'new'}
        open={form.open}
        onOpenChange={(open) => setForm((s) => ({ ...s, open }))}
        role={form.role}
        roles={list}
        onSaved={(saved) => {
          if (!form.role) {
            setDraft(null)
            setSelectedId(saved.id)
          }
        }}
      />
      <ConfirmDialog
        open={!!pendingSelect}
        onOpenChange={(open) => !open && setPendingSelect(null)}
        title="Bỏ thay đổi chưa lưu?"
        description={`Phân quyền của ${selected?.name} còn ${changeCount} thay đổi chưa lưu. Chuyển sang vai trò khác sẽ bỏ các thay đổi này.`}
        confirmText="Bỏ thay đổi"
        variant="destructive"
        onConfirm={() => {
          setDraft(null)
          if (pendingSelect) setSelectedId(pendingSelect.id)
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        variant="destructive"
        icon={Trash2}
        title={`Xóa vai trò ${selected?.name ?? ''}?`}
        description="Vai trò và toàn bộ phân quyền của nó sẽ bị xóa."
        confirmText="Xóa vai trò"
        loading={deleteRole.isPending}
        onConfirm={confirmDelete}
      />
    </PermissionGuard>
  )
}
