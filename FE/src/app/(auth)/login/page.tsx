import { Suspense } from 'react'
import type { Metadata } from 'next'
import { LoginPage } from '@/features/auth/pages/LoginPage'

export const metadata: Metadata = { title: 'Đăng nhập' }

export default function Page() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  )
}
