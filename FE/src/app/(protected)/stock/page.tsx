import type { Metadata } from 'next'
import { StockPage } from '@/features/stock/pages/StockPage'

export const metadata: Metadata = { title: 'Tồn kho' }

export default function Page() {
  return <StockPage />
}
