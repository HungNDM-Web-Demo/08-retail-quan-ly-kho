'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SaveWarehouseRequest } from '@/types/inventory'
import { warehouseService } from '../services/warehouse.service'

/** Khóa query 07 §4.9: ['warehouses'] (làm mới cả ['warehouses', 'my'] của lõi) */
export const warehouseKeys = {
  all: ['warehouses'] as const,
  list: ['warehouses', 'list'] as const,
  keeperCandidates: ['warehouses', 'keeper-candidates'] as const,
}

export function useWarehouses() {
  return useQuery({ queryKey: warehouseKeys.list, queryFn: () => warehouseService.getList() })
}

export function useKeeperCandidates(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: warehouseKeys.keeperCandidates,
    queryFn: () => warehouseService.getKeeperCandidates(),
    enabled: options.enabled ?? true,
  })
}

/**
 * Sau khi đổi kho, thủ kho: phạm vi kho đổi nên làm mới mọi dữ liệu theo kho (tồn, hàng hóa, báo cáo).
 * Thủ kho ở tab khác nhận thay đổi qua đồng bộ mock-db giữa tab (07 §4.2).
 */
function useInvalidateWarehouses() {
  const queryClient = useQueryClient()
  return () => {
    for (const key of ['warehouses', 'products', 'product', 'stock-levels', 'stock-alerts', 'reports', 'audit-logs']) {
      void queryClient.invalidateQueries({ queryKey: [key] })
    }
  }
}

export function useSaveWarehouse() {
  const invalidate = useInvalidateWarehouses()
  return useMutation({
    mutationFn: async ({
      id,
      input,
      keeperIds,
    }: {
      id?: string
      /** Không có (và có id): chỉ gán thủ kho */
      input?: SaveWarehouseRequest
      /** Có: gán đủ danh sách thủ kho ngay sau khi lưu (UC-02 bước 3) */
      keeperIds?: string[]
    }) => {
      if (!input) {
        if (!id) throw new Error('Thiếu kho')
        return warehouseService.assignKeepers(id, { userIds: keeperIds ?? [] })
      }
      const saved = id ? await warehouseService.update(id, input) : await warehouseService.create(input)
      return keeperIds ? warehouseService.assignKeepers(saved.id, { userIds: keeperIds }) : saved
    },
    onSettled: invalidate,
  })
}

export function useSetWarehouseStatus() {
  const invalidate = useInvalidateWarehouses()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      warehouseService.setStatus(id, { isActive }),
    onSuccess: invalidate,
  })
}

export function useAssignKeepers() {
  const invalidate = useInvalidateWarehouses()
  return useMutation({
    mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) =>
      warehouseService.assignKeepers(id, { userIds }),
    onSuccess: invalidate,
  })
}

export function useDeleteWarehouse() {
  const invalidate = useInvalidateWarehouses()
  return useMutation({
    mutationFn: (id: string) => warehouseService.remove(id),
    onSuccess: invalidate,
  })
}
