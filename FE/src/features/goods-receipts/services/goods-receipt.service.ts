import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  DocActionRequest,
  GoodsIssueDto,
  GoodsReceiptDto,
  GoodsReceiptListItem,
  GoodsReceiptQuery,
  RejectRequest,
  SaveGoodsReceiptRequest,
} from '@/types/inventory'
import { goodsReceiptMock } from '../mock/goods-receipt.mock'

const R = apiRoutes.goodsReceipts

/** Phiếu nhập (07 §2.4) */
export const goodsReceiptService = {
  getList: (query: GoodsReceiptQuery): Promise<PaginatedResult<GoodsReceiptListItem>> =>
    isMockMode() ? goodsReceiptMock.getList(query) : apiCall.get(R.list, { params: query }),
  getById: (id: string): Promise<GoodsReceiptDto> =>
    isMockMode() ? goodsReceiptMock.getById(id) : apiCall.get(R.detail(id)),
  create: (input: SaveGoodsReceiptRequest): Promise<GoodsReceiptDto> =>
    isMockMode() ? goodsReceiptMock.create(input) : apiCall.post(R.list, input),
  update: (id: string, input: SaveGoodsReceiptRequest): Promise<GoodsReceiptDto> =>
    isMockMode() ? goodsReceiptMock.update(id, input) : apiCall.put(R.detail(id), input),
  submit: (id: string, input: DocActionRequest): Promise<GoodsReceiptDto> =>
    isMockMode() ? goodsReceiptMock.submit(id, input) : apiCall.patch(R.submit(id), input),
  withdraw: (id: string, input: DocActionRequest): Promise<GoodsReceiptDto> =>
    isMockMode() ? goodsReceiptMock.withdraw(id, input) : apiCall.patch(R.withdraw(id), input),
  approve: (id: string, input: DocActionRequest): Promise<GoodsReceiptDto> =>
    isMockMode() ? goodsReceiptMock.approve(id, input) : apiCall.patch(R.approve(id), input),
  reject: (id: string, input: RejectRequest): Promise<GoodsReceiptDto> =>
    isMockMode() ? goodsReceiptMock.reject(id, input) : apiCall.patch(R.reject(id), input),
  cancel: (id: string, input: DocActionRequest): Promise<GoodsReceiptDto> =>
    isMockMode() ? goodsReceiptMock.cancel(id, input) : apiCall.patch(R.cancel(id), input),
  /** Phiếu ngược → phiếu xuất nháp Xuất điều chỉnh */
  reverse: (id: string, input: DocActionRequest): Promise<GoodsIssueDto> =>
    isMockMode() ? goodsReceiptMock.reverse(id, input) : apiCall.post(R.reverse(id), input),
}
