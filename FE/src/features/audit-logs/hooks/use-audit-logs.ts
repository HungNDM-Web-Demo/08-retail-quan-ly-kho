'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { auditLogService } from '../services/audit-log.service'
import type { AuditLogQuery } from '../types/audit-log.types'

export const auditLogKeys = {
  all: ['audit-logs'] as const,
  list: (query: AuditLogQuery) => ['audit-logs', 'list', query] as const,
}

export function useAuditLogs(query: AuditLogQuery) {
  return useQuery({
    queryKey: auditLogKeys.list(query),
    queryFn: () => auditLogService.getList(query),
    placeholderData: keepPreviousData,
  })
}
