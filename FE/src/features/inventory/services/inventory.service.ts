import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type {
  AvailabilityRow,
  CatalogProduct,
  ProductGroupDto,
  StoreProfile,
  WarehouseOption,
} from '@/types/inventory'
import { inventoryMock } from '../mock/inventory.mock'

/** Dữ liệu dùng chung của lõi kho: danh mục quét mã, kho của tôi, khả dụng, đơn vị in, nhóm hàng */
export const inventoryService = {
  getCatalog: (): Promise<CatalogProduct[]> =>
    isMockMode() ? inventoryMock.getCatalog() : apiCall.get<CatalogProduct[]>(apiRoutes.products.catalog),

  getMyWarehouses: (): Promise<WarehouseOption[]> =>
    isMockMode() ? inventoryMock.getMyWarehouses() : apiCall.get<WarehouseOption[]>(apiRoutes.warehouses.my),

  getWarehouseOptions: (): Promise<WarehouseOption[]> =>
    isMockMode()
      ? inventoryMock.getWarehouseOptions()
      : apiCall.get<WarehouseOption[]>(apiRoutes.warehouses.options),

  getAvailability: (warehouseId: string): Promise<AvailabilityRow[]> =>
    isMockMode()
      ? inventoryMock.getAvailability(warehouseId)
      : apiCall.get<AvailabilityRow[]>(apiRoutes.stockLevels.available, { params: { warehouseId } }),

  getStoreProfile: (): Promise<StoreProfile> =>
    isMockMode() ? inventoryMock.getStoreProfile() : apiCall.get<StoreProfile>(apiRoutes.storeProfile.get),

  getProductGroups: (): Promise<ProductGroupDto[]> =>
    isMockMode()
      ? inventoryMock.getProductGroups()
      : apiCall.get<ProductGroupDto[]>(apiRoutes.productGroups.list),
}
