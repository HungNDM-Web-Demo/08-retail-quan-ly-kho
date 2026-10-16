import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  DocActionRequest,
  GoodsIssueDto,
  GoodsIssueListItem,
  GoodsIssueQuery,
  GoodsReceiptDto,
  RejectRequest,
  SaveGoodsIssueRequest,
} from '@/types/inventory'
import { goodsIssueMock } from '../mock/goods-issue.mock'

const R = apiRoutes.goodsIssues

/** Phiếu xuất (07 §2.5) */
export const goodsIssueService = {
  getList: (query: GoodsIssueQuery): Promise<PaginatedResult<GoodsIssueListItem>> =>
    isMockMode() ? goodsIssueMock.getList(query) : apiCall.get(R.list, { params: query }),
  getById: (id: string): Promise<GoodsIssueDto> =>
    isMockMode() ? goodsIssueMock.getById(id) : apiCall.get(R.detail(id)),
  create: (input: SaveGoodsIssueRequest): Promise<GoodsIssueDto> =>
    isMockMode() ? goodsIssueMock.create(input) : apiCall.post(R.list, input),
  update: (id: string, input: SaveGoodsIssueRequest): Promise<GoodsIssueDto> =>
    isMockMode() ? goodsIssueMock.update(id, input) : apiCall.put(R.detail(id), input),
  submit: (id: string, input: DocActionRequest): Promise<GoodsIssueDto> =>
    isMockMode() ? goodsIssueMock.submit(id, input) : apiCall.patch(R.submit(id), input),
  withdraw: (id: string, input: DocActionRequest): Promise<GoodsIssueDto> =>
    isMockMode() ? goodsIssueMock.withdraw(id, input) : apiCall.patch(R.withdraw(id), input),
  approve: (id: string, input: DocActionRequest): Promise<GoodsIssueDto> =>
    isMockMode() ? goodsIssueMock.approve(id, input) : apiCall.patch(R.approve(id), input),
  reject: (id: string, input: RejectRequest): Promise<GoodsIssueDto> =>
    isMockMode() ? goodsIssueMock.reject(id, input) : apiCall.patch(R.reject(id), input),
  cancel: (id: string, input: DocActionRequest): Promise<GoodsIssueDto> =>
    isMockMode() ? goodsIssueMock.cancel(id, input) : apiCall.patch(R.cancel(id), input),
  /** Phiếu ngược → phiếu nhập nháp Nhập điều chỉnh */
  reverse: (id: string, input: DocActionRequest): Promise<GoodsReceiptDto> =>
    isMockMode() ? goodsIssueMock.reverse(id, input) : apiCall.post(R.reverse(id), input),
}
