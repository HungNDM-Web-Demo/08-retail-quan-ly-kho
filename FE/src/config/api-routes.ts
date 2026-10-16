/** Endpoint BE (QUY-UOC-API §3). Đường dẫn tương đối, lib/axios.ts ghép với NEXT_PUBLIC_API_URL. */
export const apiRoutes = {
  auth: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
    changePassword: '/api/auth/me/password',
  },
  demo: {
    accounts: '/api/demo/accounts',
    loginAs: '/api/demo/login-as',
    reset: '/api/demo/reset',
  },
  users: {
    list: '/api/users',
    detail: (id: string) => `/api/users/${id}`,
    lock: (id: string) => `/api/users/${id}/lock`,
    resetPassword: (id: string) => `/api/users/${id}/reset-password`,
  },
  roles: {
    list: '/api/roles',
    detail: (id: string) => `/api/roles/${id}`,
    permissions: (id: string) => `/api/roles/${id}/permissions`,
  },
  permissions: {
    list: '/api/permissions',
  },
  settings: {
    public: '/api/settings/public',
    list: '/api/settings',
  },
  uploads: {
    images: '/api/uploads/images',
  },
  auditLogs: {
    list: '/api/audit-logs',
  },

  // ---------------- Nghiệp vụ Quản lý Kho (docs/07-DANH-SACH-API.md §2) ----------------
  warehouses: {
    list: '/api/warehouses',
    my: '/api/warehouses/my',
    options: '/api/warehouses/options',
    keeperCandidates: '/api/warehouses/keeper-candidates',
    detail: (id: string) => `/api/warehouses/${id}`,
    status: (id: string) => `/api/warehouses/${id}/status`,
    keepers: (id: string) => `/api/warehouses/${id}/keepers`,
  },
  suppliers: {
    list: '/api/suppliers',
    options: '/api/suppliers/options',
    detail: (id: string) => `/api/suppliers/${id}`,
    status: (id: string) => `/api/suppliers/${id}/status`,
  },
  productGroups: {
    list: '/api/product-groups',
    detail: (id: string) => `/api/product-groups/${id}`,
    status: (id: string) => `/api/product-groups/${id}/status`,
  },
  products: {
    list: '/api/products',
    catalog: '/api/products/catalog',
    byBarcode: (barcode: string) => `/api/products/by-barcode/${encodeURIComponent(barcode)}`,
    detail: (id: string) => `/api/products/${id}`,
    status: (id: string) => `/api/products/${id}/status`,
  },
  goodsReceipts: {
    list: '/api/goods-receipts',
    detail: (id: string) => `/api/goods-receipts/${id}`,
    submit: (id: string) => `/api/goods-receipts/${id}/submit`,
    withdraw: (id: string) => `/api/goods-receipts/${id}/withdraw`,
    approve: (id: string) => `/api/goods-receipts/${id}/approve`,
    reject: (id: string) => `/api/goods-receipts/${id}/reject`,
    cancel: (id: string) => `/api/goods-receipts/${id}/cancel`,
    reverse: (id: string) => `/api/goods-receipts/${id}/reverse`,
  },
  goodsIssues: {
    list: '/api/goods-issues',
    detail: (id: string) => `/api/goods-issues/${id}`,
    submit: (id: string) => `/api/goods-issues/${id}/submit`,
    withdraw: (id: string) => `/api/goods-issues/${id}/withdraw`,
    approve: (id: string) => `/api/goods-issues/${id}/approve`,
    reject: (id: string) => `/api/goods-issues/${id}/reject`,
    cancel: (id: string) => `/api/goods-issues/${id}/cancel`,
    reverse: (id: string) => `/api/goods-issues/${id}/reverse`,
  },
  transfers: {
    list: '/api/transfers',
    detail: (id: string) => `/api/transfers/${id}`,
    submit: (id: string) => `/api/transfers/${id}/submit`,
    withdraw: (id: string) => `/api/transfers/${id}/withdraw`,
    approve: (id: string) => `/api/transfers/${id}/approve`,
    reject: (id: string) => `/api/transfers/${id}/reject`,
    cancel: (id: string) => `/api/transfers/${id}/cancel`,
    receive: (id: string) => `/api/transfers/${id}/receive`,
  },
  approvals: {
    list: '/api/approvals',
  },
  stockLevels: {
    list: '/api/stock-levels',
    available: '/api/stock-levels/available',
    reservations: '/api/stock-levels/reservations',
    alerts: '/api/stock-levels/alerts',
  },
  stockCards: {
    get: '/api/stock-cards',
  },
  stocktakes: {
    list: '/api/stocktakes',
    detail: (id: string) => `/api/stocktakes/${id}`,
    counts: (id: string) => `/api/stocktakes/${id}/counts`,
    fillUncounted: (id: string) => `/api/stocktakes/${id}/fill-uncounted`,
    submit: (id: string) => `/api/stocktakes/${id}/submit`,
    approve: (id: string) => `/api/stocktakes/${id}/approve`,
    returnForRecount: (id: string) => `/api/stocktakes/${id}/return`,
    cancel: (id: string) => `/api/stocktakes/${id}/cancel`,
  },
  reports: {
    dashboard: '/api/reports/dashboard',
    staffTodo: '/api/reports/staff-todo',
    inventoryMovement: '/api/reports/inventory-movement',
    slowMoving: '/api/reports/slow-moving',
    receiptsBySupplier: '/api/reports/receipts-by-supplier',
    issuesByType: '/api/reports/issues-by-type',
    stocktakeVariances: '/api/reports/stocktake-variances',
    transferLosses: '/api/reports/transfer-losses',
  },
  storeProfile: {
    get: '/api/store-profile',
  },
} as const
