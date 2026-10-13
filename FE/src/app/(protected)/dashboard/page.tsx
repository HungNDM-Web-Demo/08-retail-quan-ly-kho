import type { Metadata } from 'next'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'

export const metadata: Metadata = { title: 'Tổng quan' }

export default function Page() {
  return <DashboardPage />
}
