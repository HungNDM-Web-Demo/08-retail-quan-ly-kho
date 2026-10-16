import type { Metadata } from 'next'
import { WarehousesPage } from '@/features/warehouses/pages/WarehousesPage'

export const metadata: Metadata = { title: 'Kho' }

export default function Page() {
  return <WarehousesPage />
}
