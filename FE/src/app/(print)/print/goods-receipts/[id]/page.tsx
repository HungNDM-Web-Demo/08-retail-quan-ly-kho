import type { Metadata } from 'next'
import { Suspense } from 'react'
import { GoodsReceiptPrintPage } from '@/features/goods-receipts/pages/GoodsReceiptPrintPage'

export const metadata: Metadata = { title: 'In phiếu nhập kho' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense>
      <GoodsReceiptPrintPage id={id} />
    </Suspense>
  )
}
