'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { StockAlertQuery, StockCardQuery, StockQuery } from '@/types/inventory'
import { stockService } from '../services/stock.service'

/** Khóa query 07 §4.9; lõi làm mới các khóa này sau mỗi lần ghi sổ (`invalidateInventoryQueries`) */
export const stockKeys = {
  list: (query: StockQuery) => ['stock-levels', query] as const,
  alerts: (query: StockAlertQuery) => ['stock-alerts', query] as const,
  reservations: (warehouseId: string, productId: string) => ['reservations', warehouseId, productId] as const,
  card: (query: StockCardQuery) => ['stock-card', query] as const,
}

export function useStockLevels(query: StockQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: stockKeys.list(query),
    queryFn: () => stockService.getList(query),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  })
}

export function useStockAlerts(query: StockAlertQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: stockKeys.alerts(query),
    queryFn: () => stockService.getAlerts(query),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  })
}

export function useReservations(warehouseId: string | null | undefined, productId: string | null | undefined) {
  return useQuery({
    queryKey: stockKeys.reservations(warehouseId ?? '', productId ?? ''),
    queryFn: () => stockService.getReservations(warehouseId!, productId!),
    enabled: !!warehouseId && !!productId,
  })
}

export function useStockCard(query: StockCardQuery | null) {
  return useQuery({
    queryKey: stockKeys.card(query ?? { productId: '', from: '', to: '' }),
    queryFn: () => stockService.getStockCard(query!),
    enabled: !!query?.productId && !!query.from && !!query.to,
    placeholderData: keepPreviousData,
  })
}
