import { Boxes, ChartColumn } from 'lucide-react'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavGroup } from './index'

/** Nhóm Tồn kho và báo cáo (FE-Danh mục & Báo cáo). Thẻ kho `/stock/[productId]` khớp mục Tồn kho. */
export const stockRoutes: NavGroup = {
  id: 'stock',
  label: 'Tồn kho',
  items: [
    {
      title: 'Tồn kho',
      href: routePath.stock,
      icon: Boxes,
      permission: permissions.stockLevels.view,
      description: 'Tồn thực, tồn khả dụng, cảnh báo tối thiểu, thẻ kho',
    },
    {
      title: 'Báo cáo',
      href: routePath.reports,
      icon: ChartColumn,
      permission: permissions.reports.view,
      description: 'Xuất nhập tồn, chậm luân chuyển, nhập theo nhà cung cấp',
    },
  ],
}
