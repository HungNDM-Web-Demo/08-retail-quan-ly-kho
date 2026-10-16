import type { Metadata } from 'next'
import { Suspense } from 'react'
import { GoodsIssueDetailPage } from '@/features/goods-issues/pages/GoodsIssueDetailPage'

export const metadata: Metadata = { title: 'Phiếu xuất' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense>
      <GoodsIssueDetailPage key={id} id={id} />
    </Suspense>
  )
}
