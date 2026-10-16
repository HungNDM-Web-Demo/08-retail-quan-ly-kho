import type { Metadata } from 'next'
import { Suspense } from 'react'
import { GoodsReceiptsPage } from '@/features/goods-receipts/pages/GoodsReceiptsPage'

export const metadata: Metadata = { title: 'Phiếu nhập' }

export default function Page() {
  return (
    <Suspense>
      <GoodsReceiptsPage />
    </Suspense>
  )
}
