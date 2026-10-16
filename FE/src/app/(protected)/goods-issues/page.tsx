import type { Metadata } from 'next'
import { Suspense } from 'react'
import { GoodsIssuesPage } from '@/features/goods-issues/pages/GoodsIssuesPage'

export const metadata: Metadata = { title: 'Phiếu xuất' }

export default function Page() {
  return (
    <Suspense>
      <GoodsIssuesPage />
    </Suspense>
  )
}
