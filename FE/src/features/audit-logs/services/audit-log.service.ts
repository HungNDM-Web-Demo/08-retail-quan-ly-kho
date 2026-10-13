import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import { auditLogMock } from '../mock/audit-log.mock'
import type { AuditLogDto, AuditLogQuery } from '../types/audit-log.types'

export const auditLogService = {
  getList: (query: AuditLogQuery): Promise<PaginatedResult<AuditLogDto>> =>
    isMockMode()
      ? auditLogMock.getList(query)
      : apiCall.get<PaginatedResult<AuditLogDto>>(apiRoutes.auditLogs.list, { params: query }),
}
