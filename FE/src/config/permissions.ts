/**
 * Mã quyền, khai báo giống hệt BE `Application/Constants/Permissions.cs`
 * và danh sách seed `src/mock/seed/system.json` (+ project.json).
 * Định dạng `{resource}.{action}`. Không gõ chuỗi mã quyền trực tiếp trong component.
 */
export const permissions = {
  dashboard: {
    view: 'dashboard.view',
  },
  users: {
    view: 'users.view',
    create: 'users.create',
    update: 'users.update',
    delete: 'users.delete',
  },
  roles: {
    view: 'roles.view',
    create: 'roles.create',
    update: 'roles.update',
    delete: 'roles.delete',
  },
  settings: {
    view: 'settings.view',
    update: 'settings.update',
  },
  auditLogs: {
    view: 'audit-logs.view',
  },

  // ---------------- Nghiệp vụ Quản lý Kho (docs/07-DANH-SACH-API.md §1, khớp project.json) ----------------
  products: {
    view: 'products.view',
    create: 'products.create',
    update: 'products.update',
    delete: 'products.delete',
  },
  warehouses: {
    view: 'warehouses.view',
    create: 'warehouses.create',
    update: 'warehouses.update',
    delete: 'warehouses.delete',
    assign: 'warehouses.assign',
  },
  suppliers: {
    view: 'suppliers.view',
    create: 'suppliers.create',
    update: 'suppliers.update',
    delete: 'suppliers.delete',
  },
  goodsReceipts: {
    view: 'goods-receipts.view',
    create: 'goods-receipts.create',
    update: 'goods-receipts.update',
    delete: 'goods-receipts.delete',
    approve: 'goods-receipts.approve',
    reverse: 'goods-receipts.reverse',
  },
  goodsIssues: {
    view: 'goods-issues.view',
    create: 'goods-issues.create',
    update: 'goods-issues.update',
    delete: 'goods-issues.delete',
    approve: 'goods-issues.approve',
    reverse: 'goods-issues.reverse',
  },
  transfers: {
    view: 'transfers.view',
    create: 'transfers.create',
    update: 'transfers.update',
    delete: 'transfers.delete',
    approve: 'transfers.approve',
    receive: 'transfers.receive',
  },
  stockLevels: {
    view: 'stock-levels.view',
  },
  stockValues: {
    view: 'stock-values.view',
  },
  stocktakes: {
    view: 'stocktakes.view',
    create: 'stocktakes.create',
    count: 'stocktakes.count',
    approve: 'stocktakes.approve',
    cancel: 'stocktakes.cancel',
  },
  reports: {
    view: 'reports.view',
  },
} as const

/** Có một trong các quyền này thì vào được Phiếu chờ duyệt (/approvals) */
export const approvalPermissions = [
  permissions.goodsReceipts.approve,
  permissions.goodsIssues.approve,
  permissions.transfers.approve,
  permissions.stocktakes.approve,
] as const

/** Mã vai trò hệ thống (BR-SYS-06). */
export const roleCodes = {
  admin: 'ADMIN',
  manager: 'MANAGER',
  staff: 'STAFF',
} as const

type Leaves<T> = T extends string ? T : { [K in keyof T]: Leaves<T[K]> }[keyof T]
export type PermissionCode = Leaves<typeof permissions>
