import type { Metadata } from 'next'
import { StockCardPrintPage } from '@/features/stock/pages/StockCardPrintPage'

export const metadata: Metadata = { title: 'In thẻ kho' }

export default async function Page({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params
  return <StockCardPrintPage productId={productId} />
}
