import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { getSettingsMap } from '@/mock/system-data'
import type {
  AvailabilityRow,
  CatalogProduct,
  ProductGroupDto,
  StoreProfile,
  WarehouseOption,
} from '@/types/inventory'
import { liveGroups, liveProducts, liveWarehouses, toCatalogProduct } from './catalog.store'
import { inventoryContext } from './context'
import { availability } from './documents.store'

/**
 * Handler mock của lõi (07 §4.9): catalog, `warehouses/my`, `stock-levels/available`, `store-profile`,
 * và `product-groups` (đọc thẳng store cho tới khi FE-Danh mục có handler riêng).
 * Catalog, khả dụng không trễ giả: màn quét mã cần nhanh (NFR-02).
 */
export const inventoryMock = {
  /** GET /api/products/catalog */
  async getCatalog(): Promise<CatalogProduct[]> {
    inventoryContext(
      permissions.products.view,
      permissions.goodsReceipts.create,
      permissions.goodsIssues.create,
      permissions.transfers.create,
      permissions.stocktakes.count
    )
    return liveProducts()
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(toCatalogProduct)
  },

  /** GET /api/warehouses/my */
  async getMyWarehouses(): Promise<WarehouseOption[]> {
    const ctx = inventoryContext()
    const scope = new Set(ctx.scopeIds)
    return liveWarehouses()
      .filter((w) => scope.has(w.id))
      .map((w) => ({ id: w.id, code: w.code, name: w.name, isActive: w.isActive }))
  },

  /** GET /api/warehouses/options: mọi kho đang hoạt động, không theo phạm vi (ô "Kho đến", 07 §5 #46) */
  async getWarehouseOptions(): Promise<WarehouseOption[]> {
    inventoryContext(permissions.transfers.view)
    return liveWarehouses()
      .filter((w) => w.isActive)
      .map((w) => ({ id: w.id, code: w.code, name: w.name, isActive: w.isActive }))
  },

  /** GET /api/stock-levels/available?warehouseId */
  async getAvailability(warehouseId: string): Promise<AvailabilityRow[]> {
    const ctx = inventoryContext(
      permissions.goodsIssues.create,
      permissions.transfers.create,
      permissions.stockLevels.view
    )
    if (!ctx.inScope(warehouseId)) return []
    return availability(warehouseId)
  },

  /** GET /api/store-profile */
  async getStoreProfile(): Promise<StoreProfile> {
    inventoryContext()
    await mockDelay(50, 120)
    const s = getSettingsMap()
    return {
      name: s['Store.Name'] ?? '',
      address: s['Store.Address'] ?? '',
      phone: s['Store.Phone'] ?? '',
      taxCode: s['Store.TaxCode'] ?? '',
      directorName: s['Store.DirectorName'] ?? '',
      chiefAccountantName: s['Store.ChiefAccountantName'] ?? '',
      logoUrl: s['Brand.LogoUrl'] ?? '',
    }
  },

  /** GET /api/product-groups */
  async getProductGroups(): Promise<ProductGroupDto[]> {
    inventoryContext()
    const products = liveProducts()
    return liveGroups().map((g) => ({
      id: g.id,
      code: g.code,
      name: g.name,
      color: g.color,
      isActive: g.isActive,
      sortOrder: g.sortOrder,
      productCount: products.filter((p) => p.groupId === g.id).length,
    }))
  },
}
