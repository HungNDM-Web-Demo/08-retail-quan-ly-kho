import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ApprovalsPage } from '@/features/approvals/pages/ApprovalsPage'

export const metadata: Metadata = { title: 'Phiếu chờ duyệt' }

export default function Page() {
  return (
    <Suspense>
      <ApprovalsPage />
    </Suspense>
  )
}
