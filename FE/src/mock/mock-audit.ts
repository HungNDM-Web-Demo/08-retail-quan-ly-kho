import type { AuditAction, AuditLogDto } from '@/features/audit-logs/types/audit-log.types'
import { currentContext } from './mock-auth'
import { newId } from './mock-helpers'
import { auditLogsDb, type MockUser } from './system-data'

/**
 * Ghi nhật ký thao tác ở chế độ mock, giống AuditSaveChangesInterceptor của BE:
 * Create/Update/Delete chỉ lưu các cột thay đổi; Login ghi khi đăng nhập.
 * Handler nghiệp vụ của dự án gọi auditCreate/auditUpdate/auditDelete sau khi ghi dữ liệu.
 */

const MAX_LOGS = 1000
/** Không bao giờ ghi các trường này vào nhật ký */
const HIDDEN_FIELDS = new Set(['passwordHash', 'password', 'isDeleted', 'id'])

type Plain = Record<string, unknown>

function sanitize(value: Plain | null | undefined): Plain {
  if (!value) return {}
  return Object.fromEntries(Object.entries(value).filter(([key]) => !HIDDEN_FIELDS.has(key)))
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Chỉ giữ các cột khác nhau giữa hai bản. */
export function diffValues(before: Plain, after: Plain) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const oldValues: Plain = {}
  const newValues: Plain = {}
  for (const key of keys) {
    if (HIDDEN_FIELDS.has(key) || same(before[key], after[key])) continue
    oldValues[key] = before[key] ?? null
    newValues[key] = after[key] ?? null
  }
  return { oldValues, newValues }
}

export function writeAuditLog(entry: {
  action: AuditAction
  entityName: string
  entityId?: string | null
  oldValues?: Plain | null
  newValues?: Plain | null
  actor?: Pick<MockUser, 'id' | 'username'> | null
}) {
  const actor = entry.actor ?? currentContext()?.user ?? null
  const hasOld = entry.oldValues && Object.keys(entry.oldValues).length > 0
  const hasNew = entry.newValues && Object.keys(entry.newValues).length > 0
  const log: AuditLogDto = {
    id: newId(),
    userId: actor?.id ?? null,
    username: actor?.username ?? null,
    action: entry.action,
    entityName: entry.entityName,
    entityId: entry.entityId ?? null,
    oldValues: hasOld ? JSON.stringify(entry.oldValues) : null,
    newValues: hasNew ? JSON.stringify(entry.newValues) : null,
    ipAddress: null,
    createdAt: new Date().toISOString(),
  }
  auditLogsDb.insert(log)
  const total = auditLogsDb.count()
  if (total > MAX_LOGS) {
    const oldest = auditLogsDb
      .all()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, total - MAX_LOGS)
      .map((x) => x.id)
    auditLogsDb.removeWhere((x) => oldest.includes(x.id))
  }
}

export function auditCreate<T extends { id: string }>(entityName: string, entity: T) {
  writeAuditLog({ action: 'Create', entityName, entityId: entity.id, newValues: sanitize(entity as Plain) })
}

export function auditUpdate<T extends { id: string }>(entityName: string, before: T, after: T) {
  const { oldValues, newValues } = diffValues(sanitize(before as Plain), sanitize(after as Plain))
  if (Object.keys(newValues).length === 0) return
  writeAuditLog({ action: 'Update', entityName, entityId: after.id, oldValues, newValues })
}

export function auditDelete<T extends { id: string }>(entityName: string, entity: T) {
  writeAuditLog({ action: 'Delete', entityName, entityId: entity.id, oldValues: sanitize(entity as Plain) })
}
