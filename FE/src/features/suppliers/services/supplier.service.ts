import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  SaveSupplierRequest,
  SetActiveRequest,
  SupplierDto,
  SupplierOption,
  SupplierQuery,
} from '@/types/inventory'
import { supplierMock } from '../mock/supplier.mock'

/** Nhà cung cấp (07 §2.2, SCR-03, FR-06). */
export const supplierService = {
  getList: (query: SupplierQuery): Promise<PaginatedResult<SupplierDto>> =>
    isMockMode()
      ? supplierMock.getList(query)
      : apiCall.get<PaginatedResult<SupplierDto>>(apiRoutes.suppliers.list, { params: query }),

  getOptions: (): Promise<SupplierOption[]> =>
    isMockMode() ? supplierMock.getOptions() : apiCall.get<SupplierOption[]>(apiRoutes.suppliers.options),

  getById: (id: string): Promise<SupplierDto> =>
    isMockMode() ? supplierMock.getById(id) : apiCall.get<SupplierDto>(apiRoutes.suppliers.detail(id)),

  create: (input: SaveSupplierRequest): Promise<SupplierDto> =>
    isMockMode() ? supplierMock.create(input) : apiCall.post<SupplierDto>(apiRoutes.suppliers.list, input),

  update: (id: string, input: SaveSupplierRequest): Promise<SupplierDto> =>
    isMockMode()
      ? supplierMock.update(id, input)
      : apiCall.put<SupplierDto>(apiRoutes.suppliers.detail(id), input),

  setStatus: (id: string, input: SetActiveRequest): Promise<SupplierDto> =>
    isMockMode()
      ? supplierMock.setStatus(id, input)
      : apiCall.patch<SupplierDto>(apiRoutes.suppliers.status(id), input),

  remove: (id: string): Promise<void> =>
    isMockMode() ? supplierMock.remove(id) : apiCall.delete(apiRoutes.suppliers.detail(id)),
}
