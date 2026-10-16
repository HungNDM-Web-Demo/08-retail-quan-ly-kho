import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type {
  ReservationDto,
  StockAlertDto,
  StockAlertQuery,
  StockCardDto,
  StockCardQuery,
  StockListResult,
  StockQuery,
} from '@/types/inventory'
import { stockMock } from '../mock/stock.mock'

/** Tồn kho, cảnh báo, giữ chỗ, thẻ kho (07 §2.8; SCR-12, SCR-13). Khả dụng cho màn lập phiếu ở lõi. */
export const stockService = {
  getList: (query: StockQuery): Promise<StockListResult> =>
    isMockMode() ? stockMock.getList(query) : apiCall.get<StockListResult>(apiRoutes.stockLevels.list, { params: query }),

  getReservations: (warehouseId: string, productId: string): Promise<ReservationDto[]> =>
    isMockMode()
      ? stockMock.getReservations(warehouseId, productId)
      : apiCall.get<ReservationDto[]>(apiRoutes.stockLevels.reservations, { params: { warehouseId, productId } }),

  getAlerts: (query: StockAlertQuery): Promise<StockAlertDto[]> =>
    isMockMode()
      ? stockMock.getAlerts(query)
      : apiCall.get<StockAlertDto[]>(apiRoutes.stockLevels.alerts, { params: query }),

  getStockCard: (query: StockCardQuery): Promise<StockCardDto> =>
    isMockMode() ? stockMock.getStockCard(query) : apiCall.get<StockCardDto>(apiRoutes.stockCards.get, { params: query }),
}
