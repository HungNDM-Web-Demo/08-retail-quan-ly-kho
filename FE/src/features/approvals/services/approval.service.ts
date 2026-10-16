import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { ApprovalItem, ApprovalQuery } from '@/types/inventory'
import { approvalMock } from '../mock/approval.mock'

/** Phiếu chờ duyệt (07 §2.7); duyệt, từ chối gọi service của từng loại phiếu */
export const approvalService = {
  getList: (query: ApprovalQuery): Promise<ApprovalItem[]> =>
    isMockMode() ? approvalMock.getList(query) : apiCall.get(apiRoutes.approvals.list, { params: query }),
}
