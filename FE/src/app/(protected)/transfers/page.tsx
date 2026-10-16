import type { Metadata } from 'next'
import { Suspense } from 'react'
import { TransfersPage } from '@/features/transfers/pages/TransfersPage'

export const metadata: Metadata = { title: 'Chuyển kho' }

export default function Page() {
  return (
    <Suspense>
      <TransfersPage />
    </Suspense>
  )
}
