import type { PaginationQuery } from '@/types/api'

/** DTO nhật ký, khớp QUY-UOC-API §4.6. */

export type AuditAction = 'Create' | 'Update' | 'Delete' | 'Login'

export type AuditLogDto = {
  id: string
  userId?: string | null
  username?: string | null
  action: AuditAction
  entityName: string
  entityId?: string | null
  /** JSON các cột thay đổi */
  oldValues?: string | null
  newValues?: string | null
  ipAddress?: string | null
  createdAt: string
}

/** GET /api/audit-logs?page&pageSize&userId&entityName&action&fromDate&toDate */
export type AuditLogQuery = PaginationQuery & {
  userId?: string
  entityName?: string
  action?: AuditAction
  /** yyyy-MM-dd */
  fromDate?: string
  /** yyyy-MM-dd */
  toDate?: string
}
