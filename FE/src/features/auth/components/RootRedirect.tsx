'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { appConfig } from '@/config/app.config'
import { routePath } from '@/config/route-path'
import { useAuth } from '../hooks/use-auth'

/** Trang "/": đã đăng nhập thì sang trang chủ (homeAfterLogin), chưa thì về /login. */
export function RootRedirect() {
  const { hydrated, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!hydrated) return
    router.replace(isAuthenticated ? appConfig.homeAfterLogin : routePath.login)
  }, [hydrated, isAuthenticated, router])

  return (
    <div className="flex min-h-svh items-center justify-center" aria-busy="true">
      <Loader2 className="text-primary size-6 animate-spin" aria-label="Đang chuyển trang" />
    </div>
  )
}
