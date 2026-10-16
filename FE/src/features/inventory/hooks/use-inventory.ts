'use client'

import { useMemo } from 'react'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import type { CatalogProduct } from '@/types/inventory'
import { inventoryService } from '../services/inventory.service'

/** Query key dùng chung (07 §4.9) */
export const inventoryKeys = {
  catalog: ['catalog'] as const,
  myWarehouses: ['warehouses', 'my'] as const,
  warehouseOptions: ['warehouses', 'options'] as const,
  availability: (warehouseId: string) => ['availability', warehouseId] as const,
  storeProfile: ['store-profile'] as const,
  productGroups: ['product-groups'] as const,
}

/**
 * Làm mới sau thao tác ghi sổ (duyệt, nhận, duyệt kiểm kê) hoặc đổi giữ chỗ: tồn, cảnh báo, khả dụng, thẻ kho, báo
 * cáo, Phiếu chờ duyệt, danh sách và chi tiết phiếu, sản phẩm, kho (07 §4.9).
 */
export function invalidateInventoryQueries(queryClient: QueryClient) {
  const roots = new Set([
    'stock-levels',
    'stock-alerts',
    'availability',
    'stock-card',
    'reservations',
    'reports',
    'approvals',
    'goods-receipts',
    'goods-receipt',
    'goods-issues',
    'goods-issue',
    'transfers',
    'transfer',
    'stocktakes',
    'stocktake',
    'products',
    'product',
    'warehouses',
    'dashboard',
    'staff-todo',
  ])
  return queryClient.invalidateQueries({
    predicate: (query) => typeof query.queryKey[0] === 'string' && roots.has(query.queryKey[0]),
  })
}

/** Danh mục gọn để quét mã tại máy (NFR-02), giữ 5 phút */
export function useCatalog(enabled = true) {
  return useQuery({
    queryKey: inventoryKeys.catalog,
    queryFn: () => inventoryService.getCatalog(),
    staleTime: 5 * 60_000,
    enabled,
  })
}

/** Bảng tra catalog: theo id, theo mã vạch (mọi đơn vị), theo mã hàng */
export function useCatalogIndex(catalog: CatalogProduct[] | undefined) {
  return useMemo(() => {
    const byId = new Map<string, CatalogProduct>()
    const byBarcode = new Map<string, { product: CatalogProduct; unitId?: string }>()
    const byCode = new Map<string, CatalogProduct>()
    for (const p of catalog ?? []) {
      byId.set(p.id, p)
      byCode.set(p.code.toUpperCase(), p)
      if (p.barcode) byBarcode.set(p.barcode, { product: p })
      for (const u of p.units) if (u.barcode) byBarcode.set(u.barcode, { product: p, unitId: u.id })
    }
    return {
      byId,
      /** Tra mã vạch rồi mã hàng (07 §4.3) */
      lookup(code: string) {
        const text = code.trim()
        return byBarcode.get(text) ?? (byCode.get(text.toUpperCase()) ? { product: byCode.get(text.toUpperCase())! } : null)
      },
    }
  }, [catalog])
}

/** Kho trong phạm vi người dùng (ô chọn kho, bộ lọc kho) */
export function useMyWarehouses() {
  return useQuery({
    queryKey: inventoryKeys.myWarehouses,
    queryFn: () => inventoryService.getMyWarehouses(),
    staleTime: 60_000,
  })
}

/** Mọi kho đang hoạt động, không theo phạm vi: ô "Kho đến" của phiếu chuyển (07 §5 #46) */
export function useWarehouseOptions(enabled = true) {
  return useQuery({
    queryKey: inventoryKeys.warehouseOptions,
    queryFn: () => inventoryService.getWarehouseOptions(),
    staleTime: 60_000,
    enabled,
  })
}

/** Tồn thực, chờ xuất, khả dụng của kho (màn lập phiếu xuất, chuyển) */
export function useAvailability(warehouseId: string | null | undefined) {
  return useQuery({
    queryKey: inventoryKeys.availability(warehouseId ?? ''),
    queryFn: () => inventoryService.getAvailability(warehouseId!),
    enabled: !!warehouseId,
    staleTime: 10_000,
  })
}

/** Đơn vị in trên chứng từ */
export function useStoreProfile() {
  return useQuery({
    queryKey: inventoryKeys.storeProfile,
    queryFn: () => inventoryService.getStoreProfile(),
    staleTime: 5 * 60_000,
  })
}

/** Nhóm hàng (bộ lọc, phạm vi kiểm kê) */
export function useProductGroups() {
  return useQuery({
    queryKey: inventoryKeys.productGroups,
    queryFn: () => inventoryService.getProductGroups(),
    staleTime: 60_000,
  })
}
