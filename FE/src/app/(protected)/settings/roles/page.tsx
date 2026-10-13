import type { Metadata } from 'next'
import { RolesPage } from '@/features/roles/pages/RolesPage'

export const metadata: Metadata = { title: 'Vai trò và phân quyền' }

export default function Page() {
  return <RolesPage />
}
