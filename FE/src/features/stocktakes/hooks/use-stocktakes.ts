'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateStocktakeRequest,
  DocActionRequest,
  ReturnStocktakeRequest,
  StocktakeDto,
  StocktakeQuery,
  SubmitCountsRequest,
  SubmitStocktakeRequest,
} from '@/types/inventory'
import { invalidateInventoryQueries } from '@/features/inventory/hooks/use-inventory'
import { stocktakeService } from '../services/stocktake.service'

export const stocktakeKeys = {
  list: (query: StocktakeQuery) => ['stocktakes', query] as const,
  detail: (id: string) => ['stocktake', id] as const,
}

export function useStocktakes(query: StocktakeQuery, enabled = true) {
  return useQuery({
    queryKey: stocktakeKeys.list(query),
    queryFn: () => stocktakeService.getList(query),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useStocktake(id: string | null | undefined) {
  return useQuery({
    queryKey: stocktakeKeys.detail(id ?? ''),
    queryFn: () => stocktakeService.getById(id!),
    enabled: !!id,
  })
}

type Action = 'fillUncounted' | 'approve' | 'cancel'

export function useStocktakeMutations() {
  const queryClient = useQueryClient()
  const done = (doc: StocktakeDto) => {
    queryClient.setQueryData(stocktakeKeys.detail(doc.id), doc)
    void invalidateInventoryQueries(queryClient)
  }
  return {
    create: useMutation({
      mutationFn: (input: CreateStocktakeRequest) => stocktakeService.create(input),
      onSuccess: done,
    }),
    /** Lượt đếm: chỉ thay cache chi tiết (không làm mới tồn, gửi rất thường xuyên) */
    counts: useMutation({
      mutationFn: ({ id, input }: { id: string; input: SubmitCountsRequest }) => stocktakeService.submitCounts(id, input),
      onSuccess: (doc) => queryClient.setQueryData(stocktakeKeys.detail(doc.id), doc),
    }),
    action: useMutation({
      mutationFn: ({ id, action, input }: { id: string; action: Action; input: DocActionRequest }) =>
        stocktakeService[action](id, input),
      onSuccess: done,
    }),
    submit: useMutation({
      mutationFn: ({ id, input }: { id: string; input: SubmitStocktakeRequest }) => stocktakeService.submit(id, input),
      onSuccess: done,
    }),
    returnForRecount: useMutation({
      mutationFn: ({ id, input }: { id: string; input: ReturnStocktakeRequest }) => stocktakeService.returnForRecount(id, input),
      onSuccess: done,
    }),
  }
}
