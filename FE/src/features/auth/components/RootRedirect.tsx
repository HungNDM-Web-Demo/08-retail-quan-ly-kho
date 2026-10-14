'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { routePath } from '@/config/route-path'
import { homePathForUser } from '@/config/routes'
import { useAuth } from '../hooks/use-auth'

/** Trang "/": đã đăng nhập thì sang trang chủ theo quyền (homePathForUser), chưa thì về /login. */
export function RootRedirect() {
  const { hydrated, isAuthenticated, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!hydrated) return
    router.replace(isAuthenticated ? homePathForUser(user) : routePath.login)
  }, [hydrated, isAuthenticated, user, router])

  return (
    <div className="flex min-h-svh items-center justify-center" aria-busy="true">
      <Loader2 className="text-primary size-6 animate-spin" aria-label="Đang chuyển trang" />
    </div>
  )
}
