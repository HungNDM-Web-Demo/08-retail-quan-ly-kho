import { permissions } from '@/config/permissions'

/**
 * Phạm vi kho (BR-23, quyết định 1): có `warehouses.assign` thì thấy mọi kho; không có thì chỉ kho được gán.
 * Nhận danh sách mã quyền hoặc hàm `can` của `usePermissions()`.
 */
export function canSeeAllWarehouses(source: readonly string[] | ((permission: string) => boolean)): boolean {
  return typeof source === 'function'
    ? source(permissions.warehouses.assign)
    : source.includes(permissions.warehouses.assign)
}
