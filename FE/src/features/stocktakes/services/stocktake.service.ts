import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import type {
  CreateStocktakeRequest,
  DocActionRequest,
  ReturnStocktakeRequest,
  StocktakeDto,
  StocktakeListItem,
  StocktakeQuery,
  SubmitCountsRequest,
  SubmitStocktakeRequest,
} from '@/types/inventory'
import { stocktakeMock } from '../mock/stocktake.mock'

const R = apiRoutes.stocktakes

/** Kiểm kê (07 §2.9) */
export const stocktakeService = {
  getList: (query: StocktakeQuery): Promise<PaginatedResult<StocktakeListItem>> =>
    isMockMode() ? stocktakeMock.getList(query) : apiCall.get(R.list, { params: query }),
  getById: (id: string): Promise<StocktakeDto> => (isMockMode() ? stocktakeMock.getById(id) : apiCall.get(R.detail(id))),
  create: (input: CreateStocktakeRequest): Promise<StocktakeDto> =>
    isMockMode() ? stocktakeMock.create(input) : apiCall.post(R.list, input),
  submitCounts: (id: string, input: SubmitCountsRequest): Promise<StocktakeDto> =>
    isMockMode() ? stocktakeMock.submitCounts(id, input) : apiCall.post(R.counts(id), input),
  fillUncounted: (id: string, input: DocActionRequest): Promise<StocktakeDto> =>
    isMockMode() ? stocktakeMock.fillUncounted(id, input) : apiCall.patch(R.fillUncounted(id), input),
  submit: (id: string, input: SubmitStocktakeRequest): Promise<StocktakeDto> =>
    isMockMode() ? stocktakeMock.submit(id, input) : apiCall.patch(R.submit(id), input),
  approve: (id: string, input: DocActionRequest): Promise<StocktakeDto> =>
    isMockMode() ? stocktakeMock.approve(id, input) : apiCall.patch(R.approve(id), input),
  returnForRecount: (id: string, input: ReturnStocktakeRequest): Promise<StocktakeDto> =>
    isMockMode() ? stocktakeMock.returnForRecount(id, input) : apiCall.patch(R.returnForRecount(id), input),
  cancel: (id: string, input: DocActionRequest): Promise<StocktakeDto> =>
    isMockMode() ? stocktakeMock.cancel(id, input) : apiCall.patch(R.cancel(id), input),
}
