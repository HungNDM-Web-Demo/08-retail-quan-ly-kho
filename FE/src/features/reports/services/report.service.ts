import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type {
  DashboardReport,
  IssueTypeRow,
  MovementQuery,
  MovementReport,
  ReportPeriodQuery,
  SlowMovingQuery,
  SlowMovingRow,
  StaffTodo,
  StocktakeVarianceRow,
  SupplierReceiptRow,
  TransferLossQuery,
  TransferLossRow,
} from '@/types/inventory'
import { reportMock } from '../mock/report.mock'

/** Tổng quan, Việc cần làm, báo cáo (07 §2.10; SCR-01, SCR-16). Excel dựng ở FE từ các DTO này. */
export const reportService = {
  getDashboard: (): Promise<DashboardReport> =>
    isMockMode() ? reportMock.getDashboard() : apiCall.get<DashboardReport>(apiRoutes.reports.dashboard),

  getStaffTodo: (): Promise<StaffTodo> =>
    isMockMode() ? reportMock.getStaffTodo() : apiCall.get<StaffTodo>(apiRoutes.reports.staffTodo),

  getMovement: (query: MovementQuery): Promise<MovementReport> =>
    isMockMode()
      ? reportMock.getMovement(query)
      : apiCall.get<MovementReport>(apiRoutes.reports.inventoryMovement, { params: query }),

  getSlowMoving: (query: SlowMovingQuery): Promise<SlowMovingRow[]> =>
    isMockMode()
      ? reportMock.getSlowMoving(query)
      : apiCall.get<SlowMovingRow[]>(apiRoutes.reports.slowMoving, { params: query }),

  getReceiptsBySupplier: (query: ReportPeriodQuery): Promise<SupplierReceiptRow[]> =>
    isMockMode()
      ? reportMock.getReceiptsBySupplier(query)
      : apiCall.get<SupplierReceiptRow[]>(apiRoutes.reports.receiptsBySupplier, { params: query }),

  getIssuesByType: (query: ReportPeriodQuery): Promise<IssueTypeRow[]> =>
    isMockMode()
      ? reportMock.getIssuesByType(query)
      : apiCall.get<IssueTypeRow[]>(apiRoutes.reports.issuesByType, { params: query }),

  getStocktakeVariances: (query: ReportPeriodQuery): Promise<StocktakeVarianceRow[]> =>
    isMockMode()
      ? reportMock.getStocktakeVariances(query)
      : apiCall.get<StocktakeVarianceRow[]>(apiRoutes.reports.stocktakeVariances, { params: query }),

  getTransferLosses: (query: TransferLossQuery): Promise<TransferLossRow[]> =>
    isMockMode()
      ? reportMock.getTransferLosses(query)
      : apiCall.get<TransferLossRow[]>(apiRoutes.reports.transferLosses, { params: query }),
}
