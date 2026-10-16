import type { Metadata } from 'next'
import { Suspense } from 'react'
import { GoodsIssuePrintPage } from '@/features/goods-issues/pages/GoodsIssuePrintPage'

export const metadata: Metadata = { title: 'In phiếu xuất kho' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense>
      <GoodsIssuePrintPage id={id} />
    </Suspense>
  )
}
