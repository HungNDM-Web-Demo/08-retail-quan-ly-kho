import type { Metadata } from 'next'
import { ForbiddenPage } from '@/features/auth/pages/ForbiddenPage'

export const metadata: Metadata = { title: 'Không có quyền truy cập' }

export default function Page() {
  return <ForbiddenPage />
}
