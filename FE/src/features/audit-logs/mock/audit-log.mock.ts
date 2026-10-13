import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { requirePermission } from '@/mock/mock-auth'
import { inDateRange, paginate, sortItems } from '@/mock/mock-helpers'
import { auditLogsDb } from '@/mock/system-data'
import type { PaginatedResult } from '@/types/api'
import type { AuditLogDto, AuditLogQuery } from '../types/audit-log.types'

export const auditLogMock = {
  async getList(query: AuditLogQuery): Promise<PaginatedResult<AuditLogDto>> {
    await mockDelay()
    requirePermission(permissions.auditLogs.view)
    const logs = auditLogsDb.filter(
      (log) =>
        (!query.userId || log.userId === query.userId) &&
        (!query.entityName || log.entityName === query.entityName) &&
        (!query.action || log.action === query.action) &&
        inDateRange(log.createdAt, query.fromDate, query.toDate)
    )
    return paginate(sortItems(logs, query.sortBy || 'createdAt', query.sortDir || 'desc'), query)
  },
}
