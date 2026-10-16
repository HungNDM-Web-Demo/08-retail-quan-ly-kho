import { LayoutDashboard } from 'lucide-react'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavGroup } from './index'

/**
 * Nhóm menu chính. `/dashboard` gắn `dashboard.view` (có ở cả Quản lý và Thủ kho): trang tự chọn Tổng quan
 * quản lý (có `reports.view`) hoặc Việc cần làm của thủ kho (docs/07 §4.1).
 */
export const mainRoutes: NavGroup = {
  id: 'main',
  items: [
    {
      title: 'Tổng quan',
      href: routePath.dashboard,
      icon: LayoutDashboard,
      permission: permissions.dashboard.view,
      description: 'Giá trị tồn, phiếu chờ duyệt, hàng đang chuyển, việc cần làm',
    },
  ],
}
