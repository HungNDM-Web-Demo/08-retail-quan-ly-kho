import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  DocActionRequest,
  ReceiveTransferRequest,
  RejectRequest,
  SaveTransferRequest,
  TransferDto,
  TransferListItem,
  TransferQuery,
} from '@/types/inventory'
import { transferMock } from '../mock/transfer.mock'

const R = apiRoutes.transfers

/** Chuyển kho (07 §2.6) */
export const transferService = {
  getList: (query: TransferQuery): Promise<PaginatedResult<TransferListItem>> =>
    isMockMode() ? transferMock.getList(query) : apiCall.get(R.list, { params: query }),
  getById: (id: string): Promise<TransferDto> => (isMockMode() ? transferMock.getById(id) : apiCall.get(R.detail(id))),
  create: (input: SaveTransferRequest): Promise<TransferDto> =>
    isMockMode() ? transferMock.create(input) : apiCall.post(R.list, input),
  update: (id: string, input: SaveTransferRequest): Promise<TransferDto> =>
    isMockMode() ? transferMock.update(id, input) : apiCall.put(R.detail(id), input),
  submit: (id: string, input: DocActionRequest): Promise<TransferDto> =>
    isMockMode() ? transferMock.submit(id, input) : apiCall.patch(R.submit(id), input),
  withdraw: (id: string, input: DocActionRequest): Promise<TransferDto> =>
    isMockMode() ? transferMock.withdraw(id, input) : apiCall.patch(R.withdraw(id), input),
  approve: (id: string, input: DocActionRequest): Promise<TransferDto> =>
    isMockMode() ? transferMock.approve(id, input) : apiCall.patch(R.approve(id), input),
  reject: (id: string, input: RejectRequest): Promise<TransferDto> =>
    isMockMode() ? transferMock.reject(id, input) : apiCall.patch(R.reject(id), input),
  cancel: (id: string, input: DocActionRequest): Promise<TransferDto> =>
    isMockMode() ? transferMock.cancel(id, input) : apiCall.patch(R.cancel(id), input),
  receive: (id: string, input: ReceiveTransferRequest): Promise<TransferDto> =>
    isMockMode() ? transferMock.receive(id, input) : apiCall.patch(R.receive(id), input),
}
