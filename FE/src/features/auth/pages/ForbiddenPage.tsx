'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Home, LogOut, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { appConfig } from '@/config/app.config'
import { routePath } from '@/config/route-path'
import { useAuth, useLogout } from '../hooks/use-auth'

/** SCR-SYS-02: không có quyền truy cập. */
export function ForbiddenPage() {
  const { user, isAuthenticated } = useAuth()
  const logout = useLogout()
  const router = useRouter()

  const goBack = () => {
    if (window.history.length > 1) router.back()
    else router.replace(appConfig.homeAfterLogin)
  }

  return (
    <main className="bg-background flex min-h-svh items-center justify-center px-4 py-12">
      <div className="animate-in fade-in-0 zoom-in-95 w-full max-w-md text-center duration-300">
        <div className="bg-destructive/10 text-destructive ring-destructive/5 mx-auto flex size-20 items-center justify-center rounded-full ring-8">
          <ShieldAlert className="size-10" aria-hidden="true" />
        </div>
        <p className="text-destructive mt-6 text-sm font-semibold">Lỗi 403</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Bạn không có quyền truy cập</h1>
        <p className="text-muted-foreground mt-3 text-sm text-pretty">
          {user ? (
            <>
              Tài khoản <strong className="text-foreground font-medium">{user.fullName}</strong> chưa được cấp
              quyền vào chức năng này.{' '}
            </>
          ) : (
            'Trang này cần đăng nhập bằng tài khoản có quyền phù hợp. '
          )}
          Liên hệ quản trị viên nếu bạn cần dùng chức năng này.
        </p>

        <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          {isAuthenticated ? (
            <>
              <Button variant="outline" onClick={goBack}>
                <ArrowLeft aria-hidden="true" />
                Quay lại
              </Button>
              <Button asChild>
                <Link href={appConfig.homeAfterLogin}>
                  <Home aria-hidden="true" />
                  Về trang chủ
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => logout.mutate(undefined, { onSettled: () => router.replace(routePath.login) })}
              >
                <LogOut aria-hidden="true" />
                Đăng xuất
              </Button>
            </>
          ) : (
            <Button asChild>
              <Link href={routePath.login}>Đăng nhập</Link>
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
