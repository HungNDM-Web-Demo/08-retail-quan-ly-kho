import type { Metadata } from 'next'
import { AuditLogsPage } from '@/features/audit-logs/pages/AuditLogsPage'

export const metadata: Metadata = { title: 'Nhật ký thao tác' }

export default function Page() {
  return <AuditLogsPage />
}
