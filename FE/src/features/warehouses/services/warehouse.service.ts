import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type {
  AssignKeepersRequest,
  KeeperCandidate,
  SaveWarehouseRequest,
  SetActiveRequest,
  WarehouseDto,
} from '@/types/inventory'
import { warehouseMock } from '../mock/warehouse.mock'

/**
 * Kho, thủ kho phụ trách (07 §2.1, SCR-04, FR-04, FR-05). `GET /api/warehouses/my` (ô chọn kho) thuộc lõi
 * `features/inventory` (`useMyWarehouses`).
 */
export const warehouseService = {
  getList: (): Promise<WarehouseDto[]> =>
    isMockMode() ? warehouseMock.getList() : apiCall.get<WarehouseDto[]>(apiRoutes.warehouses.list),

  getKeeperCandidates: (): Promise<KeeperCandidate[]> =>
    isMockMode()
      ? warehouseMock.getKeeperCandidates()
      : apiCall.get<KeeperCandidate[]>(apiRoutes.warehouses.keeperCandidates),

  getById: (id: string): Promise<WarehouseDto> =>
    isMockMode() ? warehouseMock.getById(id) : apiCall.get<WarehouseDto>(apiRoutes.warehouses.detail(id)),

  create: (input: SaveWarehouseRequest): Promise<WarehouseDto> =>
    isMockMode() ? warehouseMock.create(input) : apiCall.post<WarehouseDto>(apiRoutes.warehouses.list, input),

  update: (id: string, input: SaveWarehouseRequest): Promise<WarehouseDto> =>
    isMockMode()
      ? warehouseMock.update(id, input)
      : apiCall.put<WarehouseDto>(apiRoutes.warehouses.detail(id), input),

  setStatus: (id: string, input: SetActiveRequest): Promise<WarehouseDto> =>
    isMockMode()
      ? warehouseMock.setStatus(id, input)
      : apiCall.patch<WarehouseDto>(apiRoutes.warehouses.status(id), input),

  assignKeepers: (id: string, input: AssignKeepersRequest): Promise<WarehouseDto> =>
    isMockMode()
      ? warehouseMock.assignKeepers(id, input)
      : apiCall.put<WarehouseDto>(apiRoutes.warehouses.keepers(id), input),

  remove: (id: string): Promise<void> =>
    isMockMode() ? warehouseMock.remove(id) : apiCall.delete(apiRoutes.warehouses.detail(id)),
}
