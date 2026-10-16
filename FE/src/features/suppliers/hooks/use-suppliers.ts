'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SaveSupplierRequest, SupplierQuery } from '@/types/inventory'
import { supplierService } from '../services/supplier.service'

/** Khóa query theo 07 §4.9: ['suppliers', query]; ô chọn ['suppliers', 'options'] */
export const supplierKeys = {
  all: ['suppliers'] as const,
  list: (query: SupplierQuery) => ['suppliers', query] as const,
  options: ['suppliers', 'options'] as const,
}

export function useSuppliers(query: SupplierQuery) {
  return useQuery({
    queryKey: supplierKeys.list(query),
    queryFn: () => supplierService.getList(query),
    placeholderData: keepPreviousData,
  })
}

/** Ô chọn nhà cung cấp (bộ lọc báo cáo, phiếu); chỉ chọn được `isActive` vào phiếu mới */
export function useSupplierOptions(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: supplierKeys.options,
    queryFn: () => supplierService.getOptions(),
    staleTime: 5 * 60_000,
    enabled: options.enabled ?? true,
  })
}

function useInvalidateSuppliers() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: supplierKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
  }
}

export function useSaveSupplier() {
  const invalidate = useInvalidateSuppliers()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SaveSupplierRequest }) =>
      id ? supplierService.update(id, input) : supplierService.create(input),
    onSuccess: invalidate,
  })
}

export function useSetSupplierStatus() {
  const invalidate = useInvalidateSuppliers()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      supplierService.setStatus(id, { isActive }),
    onSuccess: invalidate,
  })
}

export function useDeleteSupplier() {
  const invalidate = useInvalidateSuppliers()
  return useMutation({
    mutationFn: (id: string) => supplierService.remove(id),
    onSuccess: invalidate,
  })
}
