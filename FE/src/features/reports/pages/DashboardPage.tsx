'use client'

import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { permissions } from '@/config/permissions'
import { usePermissions } from '@/hooks/use-permissions'
import { ManagerDashboard } from '../components/ManagerDashboard'
import { StaffTodoView } from '../components/StaffTodoView'

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * `/dashboard` (SCR-01, 07 §4.1, quyết định 2): gắn `dashboard.view`; có `reports.view` → Tổng quan quản lý,
 * không có → Việc cần làm của thủ kho.
 */
export function DashboardPage() {
  const { can, user } = usePermissions()
  const manager = can(permissions.reports.view)
  const header = (
    <div>
      <p className="text-muted-foreground text-sm">{capitalize(format(new Date(), "EEEE, 'ngày' dd/MM/yyyy", { locale: vi }))}</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        {manager ? 'Tổng quan kho' : `Việc cần làm${user ? ` của ${user.fullName.split(' ').slice(-2).join(' ')}` : ''}`}
      </h1>
    </div>
  )
  return (
    <PermissionGuard permission={[permissions.dashboard.view, permissions.reports.view]} redirect>
      {manager ? <ManagerDashboard header={header} /> : <StaffTodoView header={header} />}
    </PermissionGuard>
  )
}
