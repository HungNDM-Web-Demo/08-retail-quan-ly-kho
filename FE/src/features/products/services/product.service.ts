import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  BarcodeMatch,
  ProductDetailDto,
  ProductDto,
  ProductGroupDto,
  ProductQuery,
  SaveProductGroupRequest,
  SaveProductRequest,
  SetActiveRequest,
} from '@/types/inventory'
import { productMock } from '../mock/product.mock'

/**
 * Nhóm hàng, mặt hàng (07 §2.3, SCR-02, FR-07…FR-09). `GET /api/products/catalog` thuộc lõi `features/inventory`.
 */
export const productService = {
  // ---------- Nhóm hàng (danh sách: lõi `inventoryService.getProductGroups`)
  createGroup: (input: SaveProductGroupRequest): Promise<ProductGroupDto> =>
    isMockMode()
      ? productMock.createGroup(input)
      : apiCall.post<ProductGroupDto>(apiRoutes.productGroups.list, input),

  updateGroup: (id: string, input: SaveProductGroupRequest): Promise<ProductGroupDto> =>
    isMockMode()
      ? productMock.updateGroup(id, input)
      : apiCall.put<ProductGroupDto>(apiRoutes.productGroups.detail(id), input),

  setGroupStatus: (id: string, input: SetActiveRequest): Promise<ProductGroupDto> =>
    isMockMode()
      ? productMock.setGroupStatus(id, input)
      : apiCall.patch<ProductGroupDto>(apiRoutes.productGroups.status(id), input),

  removeGroup: (id: string): Promise<void> =>
    isMockMode() ? productMock.removeGroup(id) : apiCall.delete(apiRoutes.productGroups.detail(id)),

  // ---------- Mặt hàng
  getList: (query: ProductQuery): Promise<PaginatedResult<ProductDto>> =>
    isMockMode()
      ? productMock.getList(query)
      : apiCall.get<PaginatedResult<ProductDto>>(apiRoutes.products.list, { params: query }),

  getById: (id: string): Promise<ProductDetailDto> =>
    isMockMode() ? productMock.getById(id) : apiCall.get<ProductDetailDto>(apiRoutes.products.detail(id)),

  byBarcode: (barcode: string): Promise<BarcodeMatch> =>
    isMockMode() ? productMock.byBarcode(barcode) : apiCall.get<BarcodeMatch>(apiRoutes.products.byBarcode(barcode)),

  create: (input: SaveProductRequest): Promise<ProductDetailDto> =>
    isMockMode() ? productMock.create(input) : apiCall.post<ProductDetailDto>(apiRoutes.products.list, input),

  update: (id: string, input: SaveProductRequest): Promise<ProductDetailDto> =>
    isMockMode()
      ? productMock.update(id, input)
      : apiCall.put<ProductDetailDto>(apiRoutes.products.detail(id), input),

  setStatus: (id: string, input: SetActiveRequest): Promise<ProductDto> =>
    isMockMode() ? productMock.setStatus(id, input) : apiCall.patch<ProductDto>(apiRoutes.products.status(id), input),

  remove: (id: string): Promise<void> =>
    isMockMode() ? productMock.remove(id) : apiCall.delete(apiRoutes.products.detail(id)),
}
