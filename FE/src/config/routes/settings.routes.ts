import { History, Palette, ShieldCheck, Users } from 'lucide-react'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavGroup } from './index'

/** Nhóm Cài đặt (SCR-SYS-03 → SCR-SYS-06), chỉ Quản trị viên thấy theo mặc định. */
export const settingsRoutes: NavGroup = {
  id: 'settings',
  label: 'Cài đặt',
  items: [
    {
      title: 'Tài khoản',
      href: routePath.settingsUsers,
      icon: Users,
      permission: permissions.users.view,
      description: 'Thêm, khóa, phân vai trò cho người dùng',
    },
    {
      title: 'Vai trò',
      href: routePath.settingsRoles,
      icon: ShieldCheck,
      permission: permissions.roles.view,
      description: 'Vai trò và ma trận phân quyền',
    },
    {
      title: 'Cài đặt chung',
      href: routePath.settingsGeneral,
      icon: Palette,
      permission: permissions.settings.view,
      description: 'Tên, logo, màu thương hiệu, thông tin doanh nghiệp',
    },
    {
      title: 'Nhật ký',
      href: routePath.settingsAuditLogs,
      icon: History,
      permission: permissions.auditLogs.view,
      description: 'Lịch sử thêm, sửa, xóa, đăng nhập',
    },
  ],
}
