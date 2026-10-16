'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DocActionRequest, GoodsReceiptDto, GoodsReceiptQuery, RejectRequest, SaveGoodsReceiptRequest } from '@/types/inventory'
import { invalidateInventoryQueries } from '@/features/inventory/hooks/use-inventory'
import { goodsReceiptService } from '../services/goods-receipt.service'

export const goodsReceiptKeys = {
  list: (query: GoodsReceiptQuery) => ['goods-receipts', query] as const,
  detail: (id: string) => ['goods-receipt', id] as const,
}

export function useGoodsReceipts(query: GoodsReceiptQuery, enabled = true) {
  return useQuery({
    queryKey: goodsReceiptKeys.list(query),
    queryFn: () => goodsReceiptService.getList(query),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useGoodsReceipt(id: string | null | undefined) {
  return useQuery({
    queryKey: goodsReceiptKeys.detail(id ?? ''),
    queryFn: () => goodsReceiptService.getById(id!),
    enabled: !!id,
  })
}

type Action = 'submit' | 'withdraw' | 'approve' | 'cancel'

/** Lưu (tạo hoặc sửa) và các thao tác trạng thái; thành công thì thay cache chi tiết, làm mới tồn, Phiếu chờ duyệt */
export function useGoodsReceiptMutations() {
  const queryClient = useQueryClient()
  const done = (doc: GoodsReceiptDto) => {
    queryClient.setQueryData(goodsReceiptKeys.detail(doc.id), doc)
    void invalidateInventoryQueries(queryClient)
  }
  return {
    save: useMutation({
      mutationFn: ({ id, input }: { id?: string; input: SaveGoodsReceiptRequest }) =>
        id ? goodsReceiptService.update(id, input) : goodsReceiptService.create(input),
      onSuccess: done,
    }),
    action: useMutation({
      mutationFn: ({ id, action, input }: { id: string; action: Action; input: DocActionRequest }) =>
        goodsReceiptService[action](id, input),
      onSuccess: done,
    }),
    reject: useMutation({
      mutationFn: ({ id, input }: { id: string; input: RejectRequest }) => goodsReceiptService.reject(id, input),
      onSuccess: done,
    }),
    reverse: useMutation({
      mutationFn: ({ id, input }: { id: string; input: DocActionRequest }) => goodsReceiptService.reverse(id, input),
      onSuccess: () => void invalidateInventoryQueries(queryClient),
    }),
  }
}
