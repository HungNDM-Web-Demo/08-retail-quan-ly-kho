'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ChevronRight, History, SearchX, X } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { permissions } from '@/config/permissions'
import { useRoles } from '@/features/roles/hooks/use-roles'
import { useUsers } from '@/features/users/hooks/use-users'
import { usePermissions } from '@/hooks/use-permissions'
import { useTableQuery } from '@/hooks/use-table-query'
import { formatDateTime, formatRelativeTime } from '@/lib/format'
import { auditActionLabels, auditEntityLabels, entityLabel, fieldLabel } from '../audit-labels'
import { AuditLogDetailDialog, type AuditValueFormatters } from '../components/AuditLogDetailDialog'
import { useAuditLogs } from '../hooks/use-audit-logs'
import type { AuditAction, AuditLogDto } from '../types/audit-log.types'

type Filters = { userId: string; entityName: string; action: AuditAction; fromDate: string; toDate: string }

function changedFields(log: AuditLogDto): string[] {
  try {
    const source = log.newValues ?? log.oldValues
    return source ? Object.keys(JSON.parse(source) as object) : []
  } catch {
    return []
  }
}

/** SCR-SYS-06: nhật ký thao tác (UC-SYS-08). */
export function AuditLogsPage() {
  const { can } = usePermissions()
  const table = useTableQuery<Filters>({ pageSize: 20 })
  const logs = useAuditLogs(table.query)
  const users = useUsers(
    { page: 1, pageSize: 100, sortBy: 'fullName', sortDir: 'asc' },
    { enabled: can(permissions.users.view) }
  )
  const roles = useRoles({ enabled: can(permissions.roles.view) })
  const [selected, setSelected] = useState<AuditLogDto | null>(null)

  const { state } = table
  const hasFilters = !!(state.userId || state.entityName || state.action || state.fromDate || state.toDate)

  const formatters = useMemo<AuditValueFormatters>(
    () => ({
      roleIds: (value) =>
        Array.isArray(value)
          ? value.map((id) => roles.data?.find((r) => r.id === id)?.name ?? String(id)).join(', ')
          : String(value),
    }),
    [roles.data]
  )

  const columns = useMemo<ColumnDef<AuditLogDto>[]>(
    () => [
      {
        id: 'createdAt',
        header: 'Thời gian',
        enableSorting: true,
        cell: ({ row }) => (
          <div className="leading-tight">
            <div className="text-sm tabular-nums">{formatDateTime(row.original.createdAt)}</div>
            <div className="text-muted-foreground text-xs">{formatRelativeTime(row.original.createdAt)}</div>
          </div>
        ),
      },
      {
        id: 'username',
        header: 'Người thực hiện',
        cell: ({ row }) =>
          row.original.username ? (
            <span className="font-medium">{row.original.username}</span>
          ) : (
            <span className="text-muted-foreground">Hệ thống</span>
          ),
      },
      {
        id: 'action',
        header: 'Hành động',
        cell: ({ row }) => {
          const action = auditActionLabels[row.original.action]
          return <StatusBadge tone={action?.tone}>{action?.label ?? row.original.action}</StatusBadge>
        },
      },
      {
        id: 'entityName',
        header: 'Đối tượng',
        cell: ({ row }) => (
          <div className="leading-tight">
            <div className="font-medium">{entityLabel(row.original.entityName)}</div>
            {row.original.entityId && (
              <div className="text-muted-foreground font-mono text-xs">{row.original.entityId.slice(0, 8)}</div>
            )}
          </div>
        ),
      },
      {
        id: 'changes',
        header: 'Nội dung',
        cell: ({ row }) => {
          const fields = changedFields(row.original)
          if (row.original.action === 'Login') return <span className="text-muted-foreground text-sm">Đăng nhập hệ thống</span>
          if (!fields.length) return <span className="text-muted-foreground text-sm">—</span>
          const shown = fields.slice(0, 3).map(fieldLabel).join(', ')
          return (
            <span className="text-sm">
              {shown}
              {fields.length > 3 && <span className="text-muted-foreground"> và {fields.length - 3} trường khác</span>}
            </span>
          )
        },
      },
      {
        id: 'open',
        header: () => <span className="sr-only">Xem chi tiết</span>,
        meta: { className: 'w-10 text-right' },
        cell: () => <ChevronRight className="text-muted-foreground ml-auto size-4" aria-hidden="true" />,
      },
    ],
    []
  )

  const clear = () => table.resetFilters()

  return (
    <PermissionGuard permission={permissions.auditLogs.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Nhật ký thao tác"
          icon={History}
          description="Ai đã thêm, sửa, xóa gì và khi nào. Bấm vào một dòng để xem giá trị trước và sau khi sửa."
        />

        <DataTable
          columns={columns}
          data={logs.data?.items}
          getRowId={(log) => log.id}
          onRowClick={setSelected}
          isLoading={logs.isLoading}
          isFetching={logs.isFetching}
          error={logs.error}
          onRetry={() => void logs.refetch()}
          minWidth={880}
          sorting={{ sortBy: state.sortBy, sortDir: state.sortDir, onSortChange: table.setSort }}
          pagination={
            logs.data && {
              page: logs.data.page,
              pageSize: logs.data.pageSize,
              totalCount: logs.data.totalCount,
              totalPages: logs.data.totalPages,
              onPageChange: table.setPage,
              onPageSizeChange: table.setPageSize,
            }
          }
          toolbar={
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end">
              <div className="grid gap-1.5">
                <Label htmlFor="filter-user" className="text-muted-foreground text-xs">Người thực hiện</Label>
                <Select
                  value={state.userId ?? 'all'}
                  onValueChange={(v) => table.setFilter('userId', v === 'all' ? undefined : v)}
                  disabled={!users.data}
                >
                  <SelectTrigger id="filter-user">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    {users.data?.items.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName} (@{u.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="filter-entity" className="text-muted-foreground text-xs">Đối tượng</Label>
                <Select value={state.entityName ?? 'all'} onValueChange={(v) => table.setFilter('entityName', v === 'all' ? undefined : v)}>
                  <SelectTrigger id="filter-entity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    {Object.entries(auditEntityLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="filter-action" className="text-muted-foreground text-xs">Hành động</Label>
                <Select
                  value={state.action ?? 'all'}
                  onValueChange={(v) => table.setFilter('action', v === 'all' ? undefined : (v as AuditAction))}
                >
                  <SelectTrigger id="filter-action">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    {Object.entries(auditActionLabels).map(([value, { label }]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="filter-from" className="text-muted-foreground text-xs">Từ ngày</Label>
                <Input
                  id="filter-from"
                  type="date"
                  value={state.fromDate ?? ''}
                  max={state.toDate}
                  onChange={(e) => table.setFilter('fromDate', e.target.value || undefined)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="filter-to" className="text-muted-foreground text-xs">Đến ngày</Label>
                <Input
                  id="filter-to"
                  type="date"
                  value={state.toDate ?? ''}
                  min={state.fromDate}
                  onChange={(e) => table.setFilter('toDate', e.target.value || undefined)}
                />
              </div>
              <Button variant="ghost" onClick={clear} disabled={!hasFilters} className="text-muted-foreground">
                <X aria-hidden="true" />
                Xóa lọc
              </Button>
            </div>
          }
          emptyState={
            hasFilters ? (
              <EmptyState
                icon={SearchX}
                title="Không có nhật ký phù hợp"
                description="Thử mở rộng khoảng thời gian hoặc bỏ bớt bộ lọc."
                action={
                  <Button variant="outline" onClick={clear}>
                    Xóa bộ lọc
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={History}
                title="Chưa có nhật ký"
                description="Mỗi lần đăng nhập, thêm, sửa, xóa dữ liệu sẽ được ghi lại tại đây."
              />
            )
          }
        />
      </div>
      <AuditLogDetailDialog log={selected} onOpenChange={(open) => !open && setSelected(null)} formatters={formatters} />
    </PermissionGuard>
  )
}
