import type { Metadata } from 'next'
import { ProductsPage } from '@/features/products/pages/ProductsPage'

export const metadata: Metadata = { title: 'Hàng hóa' }

export default function Page() {
  return <ProductsPage />
}
