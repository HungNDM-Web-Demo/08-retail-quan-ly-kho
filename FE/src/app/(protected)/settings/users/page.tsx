import type { Metadata } from 'next'
import { UsersPage } from '@/features/users/pages/UsersPage'

export const metadata: Metadata = { title: 'Tài khoản' }

export default function Page() {
  return <UsersPage />
}
