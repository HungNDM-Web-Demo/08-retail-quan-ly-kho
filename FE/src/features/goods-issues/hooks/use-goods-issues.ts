'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DocActionRequest, GoodsIssueDto, GoodsIssueQuery, RejectRequest, SaveGoodsIssueRequest } from '@/types/inventory'
import { invalidateInventoryQueries } from '@/features/inventory/hooks/use-inventory'
import { goodsIssueService } from '../services/goods-issue.service'

export const goodsIssueKeys = {
  list: (query: GoodsIssueQuery) => ['goods-issues', query] as const,
  detail: (id: string) => ['goods-issue', id] as const,
}

export function useGoodsIssues(query: GoodsIssueQuery, enabled = true) {
  return useQuery({
    queryKey: goodsIssueKeys.list(query),
    queryFn: () => goodsIssueService.getList(query),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useGoodsIssue(id: string | null | undefined) {
  return useQuery({
    queryKey: goodsIssueKeys.detail(id ?? ''),
    queryFn: () => goodsIssueService.getById(id!),
    enabled: !!id,
  })
}

type Action = 'submit' | 'withdraw' | 'approve' | 'cancel'

export function useGoodsIssueMutations() {
  const queryClient = useQueryClient()
  const done = (doc: GoodsIssueDto) => {
    queryClient.setQueryData(goodsIssueKeys.detail(doc.id), doc)
    void invalidateInventoryQueries(queryClient)
  }
  return {
    save: useMutation({
      mutationFn: ({ id, input }: { id?: string; input: SaveGoodsIssueRequest }) =>
        id ? goodsIssueService.update(id, input) : goodsIssueService.create(input),
      onSuccess: done,
    }),
    action: useMutation({
      mutationFn: ({ id, action, input }: { id: string; action: Action; input: DocActionRequest }) =>
        goodsIssueService[action](id, input),
      onSuccess: done,
    }),
    reject: useMutation({
      mutationFn: ({ id, input }: { id: string; input: RejectRequest }) => goodsIssueService.reject(id, input),
      onSuccess: done,
    }),
    reverse: useMutation({
      mutationFn: ({ id, input }: { id: string; input: DocActionRequest }) => goodsIssueService.reverse(id, input),
      onSuccess: () => void invalidateInventoryQueries(queryClient),
    }),
  }
}
