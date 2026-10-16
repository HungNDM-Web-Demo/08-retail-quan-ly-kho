import type { Metadata } from 'next'
import { StockCardPage } from '@/features/stock/pages/StockCardPage'

export const metadata: Metadata = { title: 'Thẻ kho' }

export default async function Page({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params
  return <StockCardPage productId={productId} />
}
