'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ApprovalQuery } from '@/types/inventory'
import { approvalService } from '../services/approval.service'

export const approvalKeys = {
  list: (query: ApprovalQuery) => ['approvals', query] as const,
}

/** Phiếu chờ duyệt (07 §2.7) */
export function useApprovals(query: ApprovalQuery) {
  return useQuery({
    queryKey: approvalKeys.list(query),
    queryFn: () => approvalService.getList(query),
    placeholderData: keepPreviousData,
  })
}
