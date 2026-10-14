'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AppShellSkeleton } from '@/components/shared/AppShellSkeleton'
import { routePath } from '@/config/route-path'
import { canAccessPath, resolveHomePath } from '@/config/routes'
import { usePermissions } from '@/hooks/use-permissions'
import { useAuthStore } from '@/stores/auth.store'
import { useAuth, useSyncCurrentUser } from '../hooks/use-auth'

/**
 * Bọc khu vực cần đăng nhập:
 * - Chưa đăng nhập → /login?redirect=… (UC-SYS-01 bước 4 quay lại đúng trang).
 * - Vào thẳng URL không có quyền (theo config/routes) → /forbidden (TC-SYS-07).
 * - Vừa đổi vai trò nhanh mà trang hiện tại không còn quyền → về trang chủ (UC-SYS-09).
 * - Mỗi lần tải trang lấy lại quyền mới nhất từ /api/auth/me.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { hydrated, isAuthenticated } = useAuth()
  const { can } = usePermissions()
  const roleSwitched = useAuthStore((s) => s.roleSwitched)
  const pathname = usePathname()
  const router = useRouter()
  useSyncCurrentUser()

  const allowed = canAccessPath(pathname, can)

  useEffect(() => {
    if (!hydrated) return
    if (!isAuthenticated) {
      router.replace(`${routePath.login}?redirect=${encodeURIComponent(pathname)}`)
    } else if (!allowed) {
      // Trang chủ chọn theo quyền của vai trò mới (07-DANH-SACH-API §4: thu ngân → Bán hàng)
      const home = resolveHomePath(can)
      const goHome = roleSwitched && pathname !== home
      router.replace(goHome ? home : routePath.forbidden)
    } else if (roleSwitched) {
      useAuthStore.getState().clearRoleSwitched()
    }
  }, [hydrated, isAuthenticated, allowed, roleSwitched, pathname, router, can])

  if (!hydrated || !isAuthenticated || !allowed) return <AppShellSkeleton />
  return <>{children}</>
}
