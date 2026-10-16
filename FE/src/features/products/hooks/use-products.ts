'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProductQuery, SaveProductGroupRequest, SaveProductRequest } from '@/types/inventory'
import { productService } from '../services/product.service'

/** Khóa query 07 §4.9: ['product-groups'], ['products', query], ['product', id] */
export const productKeys = {
  groups: ['product-groups'] as const,
  all: ['products'] as const,
  list: (query: ProductQuery) => ['products', query] as const,
  detail: (id: string) => ['product', id] as const,
}

/** Danh sách nhóm hàng: handler `GET /api/product-groups` ở lõi (`useProductGroups`), dùng chung khóa ['product-groups'] */
export { useProductGroups as useProductGroupList } from '@/features/inventory/hooks/use-inventory'

export function useProducts(query: ProductQuery) {
  return useQuery({
    queryKey: productKeys.list(query),
    queryFn: () => productService.getList(query),
    placeholderData: keepPreviousData,
  })
}

export function useProductDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: productKeys.detail(id ?? ''),
    queryFn: () => productService.getById(id as string),
    enabled: !!id,
  })
}

/** Đổi danh mục ảnh hưởng catalog quét mã, tồn, cảnh báo (ngưỡng), báo cáo, nhật ký */
function useInvalidateCatalog() {
  const queryClient = useQueryClient()
  return () => {
    for (const key of ['product-groups', 'products', 'product', 'catalog', 'stock-levels', 'stock-alerts', 'reports', 'audit-logs']) {
      void queryClient.invalidateQueries({ queryKey: [key] })
    }
  }
}

export function useSaveProductGroup() {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SaveProductGroupRequest }) =>
      id ? productService.updateGroup(id, input) : productService.createGroup(input),
    onSuccess: invalidate,
  })
}

export function useSetProductGroupStatus() {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => productService.setGroupStatus(id, { isActive }),
    onSuccess: invalidate,
  })
}

export function useDeleteProductGroup() {
  const invalidate = useInvalidateCatalog()
  return useMutation({ mutationFn: (id: string) => productService.removeGroup(id), onSuccess: invalidate })
}

export function useSaveProduct() {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: SaveProductRequest }) =>
      id ? productService.update(id, input) : productService.create(input),
    onSuccess: invalidate,
  })
}

export function useSetProductStatus() {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => productService.setStatus(id, { isActive }),
    onSuccess: invalidate,
  })
}

export function useDeleteProduct() {
  const invalidate = useInvalidateCatalog()
  return useMutation({ mutationFn: (id: string) => productService.remove(id), onSuccess: invalidate })
}
