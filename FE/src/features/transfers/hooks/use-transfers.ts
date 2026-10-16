'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  DocActionRequest,
  ReceiveTransferRequest,
  RejectRequest,
  SaveTransferRequest,
  TransferDto,
  TransferQuery,
} from '@/types/inventory'
import { invalidateInventoryQueries } from '@/features/inventory/hooks/use-inventory'
import { transferService } from '../services/transfer.service'

export const transferKeys = {
  list: (query: TransferQuery) => ['transfers', query] as const,
  detail: (id: string) => ['transfer', id] as const,
}

export function useTransfers(query: TransferQuery, enabled = true) {
  return useQuery({
    queryKey: transferKeys.list(query),
    queryFn: () => transferService.getList(query),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useTransfer(id: string | null | undefined) {
  return useQuery({
    queryKey: transferKeys.detail(id ?? ''),
    queryFn: () => transferService.getById(id!),
    enabled: !!id,
  })
}

type Action = 'submit' | 'withdraw' | 'approve' | 'cancel'

export function useTransferMutations() {
  const queryClient = useQueryClient()
  const done = (doc: TransferDto) => {
    queryClient.setQueryData(transferKeys.detail(doc.id), doc)
    void invalidateInventoryQueries(queryClient)
  }
  return {
    save: useMutation({
      mutationFn: ({ id, input }: { id?: string; input: SaveTransferRequest }) =>
        id ? transferService.update(id, input) : transferService.create(input),
      onSuccess: done,
    }),
    action: useMutation({
      mutationFn: ({ id, action, input }: { id: string; action: Action; input: DocActionRequest }) =>
        transferService[action](id, input),
      onSuccess: done,
    }),
    reject: useMutation({
      mutationFn: ({ id, input }: { id: string; input: RejectRequest }) => transferService.reject(id, input),
      onSuccess: done,
    }),
    receive: useMutation({
      mutationFn: ({ id, input }: { id: string; input: ReceiveTransferRequest }) => transferService.receive(id, input),
      onSuccess: done,
    }),
  }
}
