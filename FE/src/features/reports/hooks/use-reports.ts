'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { MovementQuery, ReportPeriodQuery, SlowMovingQuery, TransferLossQuery } from '@/types/inventory'
import { reportService } from '../services/report.service'

/** Khóa ['reports', loại, query] (07 §4.9); lõi làm mới khóa 'reports' sau mỗi lần ghi sổ */
const opts = { placeholderData: keepPreviousData }

export function useDashboardReport(enabled = true) {
  return useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: () => reportService.getDashboard(),
    enabled,
    refetchInterval: 60_000,
  })
}

export function useStaffTodo(enabled = true) {
  return useQuery({
    queryKey: ['reports', 'staff-todo'],
    queryFn: () => reportService.getStaffTodo(),
    enabled,
    refetchInterval: 60_000,
  })
}

export function useMovementReport(query: MovementQuery, enabled = true) {
  return useQuery({ queryKey: ['reports', 'movement', query], queryFn: () => reportService.getMovement(query), enabled, ...opts })
}

export function useSlowMovingReport(query: SlowMovingQuery, enabled = true) {
  return useQuery({ queryKey: ['reports', 'slow-moving', query], queryFn: () => reportService.getSlowMoving(query), enabled, ...opts })
}

export function useReceiptsBySupplier(query: ReportPeriodQuery, enabled = true) {
  return useQuery({
    queryKey: ['reports', 'receipts-by-supplier', query],
    queryFn: () => reportService.getReceiptsBySupplier(query),
    enabled,
    ...opts,
  })
}

export function useIssuesByType(query: ReportPeriodQuery, enabled = true) {
  return useQuery({ queryKey: ['reports', 'issues-by-type', query], queryFn: () => reportService.getIssuesByType(query), enabled, ...opts })
}

export function useStocktakeVariances(query: ReportPeriodQuery, enabled = true) {
  return useQuery({
    queryKey: ['reports', 'stocktake-variances', query],
    queryFn: () => reportService.getStocktakeVariances(query),
    enabled,
    ...opts,
  })
}

export function useTransferLosses(query: TransferLossQuery, enabled = true) {
  return useQuery({
    queryKey: ['reports', 'transfer-losses', query],
    queryFn: () => reportService.getTransferLosses(query),
    enabled,
    ...opts,
  })
}
