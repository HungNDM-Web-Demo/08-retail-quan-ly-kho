import { LayoutDashboard } from 'lucide-react'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavGroup } from './index'

/** Nhóm menu chính. Dự án thêm mục nghiệp vụ vào đây hoặc tạo nhóm mới. */
export const mainRoutes: NavGroup = {
  id: 'main',
  items: [
    {
      title: 'Tổng quan',
      href: routePath.dashboard,
      icon: LayoutDashboard,
      permission: permissions.dashboard.view,
      description: 'Số liệu chính và lối tắt',
    },
  ],
}
