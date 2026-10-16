import { Package, Truck, Warehouse } from 'lucide-react'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavGroup } from './index'

/** Nhóm Danh mục (FE-Danh mục & Báo cáo). */
export const catalogRoutes: NavGroup = {
  id: 'catalog',
  label: 'Danh mục',
  items: [
    {
      title: 'Hàng hóa',
      href: routePath.products,
      icon: Package,
      permission: permissions.products.view,
      description: 'Mặt hàng, nhóm hàng, đơn vị quy đổi, ngưỡng tồn',
    },
    {
      title: 'Kho',
      href: routePath.warehouses,
      icon: Warehouse,
      permission: permissions.warehouses.view,
      description: 'Kho và thủ kho phụ trách',
    },
    {
      title: 'Nhà cung cấp',
      href: routePath.suppliers,
      icon: Truck,
      permission: permissions.suppliers.view,
      description: 'Nhà cung cấp, người liên hệ',
    },
  ],
}
