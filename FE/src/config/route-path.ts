/** Đường dẫn FE (kebab-case). Không gõ đường dẫn trực tiếp trong component. */
export const routePath = {
  root: '/',
  login: '/login',
  forbidden: '/forbidden',
  profile: '/profile',

  dashboard: '/dashboard',

  // Chứng từ (FE-Phiếu)
  goodsReceipts: '/goods-receipts',
  goodsReceiptNew: '/goods-receipts/new',
  goodsIssues: '/goods-issues',
  goodsIssueNew: '/goods-issues/new',
  transfers: '/transfers',
  transferNew: '/transfers/new',
  approvals: '/approvals',
  stocktakes: '/stocktakes',
  stocktakeNew: '/stocktakes/new',

  // Danh mục, tồn kho, báo cáo (FE-Danh mục & Báo cáo)
  products: '/products',
  warehouses: '/warehouses',
  suppliers: '/suppliers',
  stock: '/stock',
  reports: '/reports',

  // Bản in (route group app/(print), không sidebar)
  printRoot: '/print',

  settingsUsers: '/settings/users',
  settingsRoles: '/settings/roles',
  settingsGeneral: '/settings/general',
  settingsAuditLogs: '/settings/audit-logs',
} as const

export type RoutePath = (typeof routePath)[keyof typeof routePath]

/**
 * Đường dẫn có tham số. Tách khỏi `routePath` để `RoutePath` vẫn là hợp các chuỗi.
 * Mở chi tiết theo loại chứng từ: dùng `docPath(kind, id)` của features/inventory/lib/links.ts.
 */
export const routeTo = {
  goodsReceipt: (id: string) => `/goods-receipts/${id}`,
  goodsIssue: (id: string) => `/goods-issues/${id}`,
  transfer: (id: string) => `/transfers/${id}`,
  stocktake: (id: string) => `/stocktakes/${id}`,
  /** Thẻ kho; query `warehouseId` (trống = mọi kho), `from`, `to` (yyyy-MM-dd) */
  stockCard: (productId: string) => `/stock/${productId}`,
  printGoodsReceipt: (id: string) => `/print/goods-receipts/${id}`,
  printGoodsIssue: (id: string) => `/print/goods-issues/${id}`,
  printTransfer: (id: string) => `/print/transfers/${id}`,
  printStocktake: (id: string) => `/print/stocktakes/${id}`,
  /** Bản in thẻ kho; query như thẻ kho */
  printStockCard: (productId: string) => `/print/stock-card/${productId}`,
} as const
