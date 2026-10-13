'use client'

import { ArrowRight } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { auditActionLabels, entityLabel, fieldLabel } from '../audit-labels'
import type { AuditLogDto } from '../types/audit-log.types'

type Values = Record<string, unknown>

function parse(json?: string | null): Values {
  if (!json) return {}
  try {
    const value = JSON.parse(json)
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Values) : { value }
  } catch {
    return { value: json }
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/** Cách hiển thị riêng cho một số cột, vd roleIds → tên vai trò */
export type AuditValueFormatters = Record<string, (value: unknown) => string>

function display(value: unknown, format?: (value: unknown) => string): { text: string; empty: boolean } {
  if (format && value !== null && value !== undefined) return { text: format(value), empty: false }
  if (value === null || value === undefined || value === '') return { text: '(trống)', empty: true }
  if (typeof value === 'boolean') return { text: value ? 'Có' : 'Không', empty: false }
  if (Array.isArray(value)) return value.length ? { text: value.join(', '), empty: false } : { text: '(trống)', empty: true }
  if (typeof value === 'string' && ISO_DATE.test(value)) return { text: formatDateTime(value), empty: false }
  if (typeof value === 'object') return { text: JSON.stringify(value), empty: false }
  return { text: String(value), empty: false }
}

/** Xem chi tiết một dòng nhật ký: giá trị trước và sau khi sửa (UC-SYS-08). */
export function AuditLogDetailDialog({
  log,
  onOpenChange,
  formatters = {},
}: {
  log: AuditLogDto | null
  onOpenChange: (open: boolean) => void
  formatters?: AuditValueFormatters
}) {
  const oldValues = parse(log?.oldValues)
  const newValues = parse(log?.newValues)
  const fields = [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])]
  const action = log ? auditActionLabels[log.action] : null
  const showOld = log?.action !== 'Create'
  const showNew = log?.action !== 'Delete'

  return (
    <Dialog open={!!log} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {action && <StatusBadge tone={action.tone}>{action.label}</StatusBadge>}
            {log && entityLabel(log.entityName)}
          </DialogTitle>
          <DialogDescription>
            {log && (
              <>
                {formatDateTime(log.createdAt)} · bởi <span className="text-foreground font-medium">{log.username ?? 'Hệ thống'}</span>
                {log.ipAddress && <> · IP {log.ipAddress}</>}
                {log.entityId && (
                  <span className="mt-1 block font-mono text-xs break-all">Mã đối tượng: {log.entityId}</span>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto px-6 py-5">
          {fields.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {log?.action === 'Login' ? 'Đăng nhập thành công, không có dữ liệu thay đổi.' : 'Không có chi tiết giá trị thay đổi.'}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-muted-foreground text-left text-xs font-semibold tracking-wide uppercase">
                    <th scope="col" className="w-40 px-3 py-2.5">Trường</th>
                    {showOld && <th scope="col" className="px-3 py-2.5">Trước</th>}
                    {showOld && showNew && <th scope="col" className="w-6 px-0 py-2.5"><span className="sr-only">thành</span></th>}
                    {showNew && <th scope="col" className="px-3 py-2.5">Sau</th>}
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field) => {
                    const before = display(oldValues[field], formatters[field])
                    const after = display(newValues[field], formatters[field])
                    return (
                      <tr key={field} className="border-t align-top">
                        <th scope="row" className="px-3 py-2.5 text-left font-medium">
                          {fieldLabel(field)}
                        </th>
                        {showOld && (
                          <td className={cn('px-3 py-2.5 break-words', before.empty ? 'text-muted-foreground italic' : 'text-destructive')}>
                            {showNew && !before.empty ? <del className="decoration-destructive/40">{before.text}</del> : before.text}
                          </td>
                        )}
                        {showOld && showNew && (
                          <td className="text-muted-foreground px-0 py-3" aria-hidden="true">
                            <ArrowRight className="size-3.5" />
                          </td>
                        )}
                        {showNew && (
                          <td className={cn('px-3 py-2.5 break-words', after.empty ? 'text-muted-foreground italic' : 'text-success font-medium')}>
                            {after.text}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
