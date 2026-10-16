import type { Metadata } from 'next'
import { SuppliersPage } from '@/features/suppliers/pages/SuppliersPage'

export const metadata: Metadata = { title: 'Nhà cung cấp' }

export default function Page() {
  return <SuppliersPage />
}
