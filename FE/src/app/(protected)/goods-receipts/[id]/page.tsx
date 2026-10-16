import type { Metadata } from 'next'
import { Suspense } from 'react'
import { GoodsReceiptDetailPage } from '@/features/goods-receipts/pages/GoodsReceiptDetailPage'

export const metadata: Metadata = { title: 'Phiếu nhập' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense>
      <GoodsReceiptDetailPage key={id} id={id} />
    </Suspense>
  )
}
