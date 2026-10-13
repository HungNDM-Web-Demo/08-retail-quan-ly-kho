'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { appConfig } from '@/config/app.config'
import { routePath } from '@/config/route-path'
import { usePermissions } from '@/hooks/use-permissions'
import { useAuthStore } from '@/stores/auth.store'

type PermissionGuardProps = {
  /** Một mã hoặc danh sách mã quyền */
  permission?: string | string[]
  /** 'any' (mặc định): có một quyền là đủ; 'all': cần đủ mọi quyền */
  mode?: 'any' | 'all'
  /** Thiếu quyền thì chuyển sang /forbidden (dùng bọc cả trang) */
  redirect?: boolean
  /** Hiển thị thay thế khi thiếu quyền (dùng bọc nút, khối nhỏ) */
  fallback?: React.ReactNode
  children: React.ReactNode
}

/**
 * Chặn theo quyền (KIEN-TRUC-HE-THONG §7.5).
 *   Cả trang:  <PermissionGuard permission={permissions.users.view} redirect>…</PermissionGuard>
 *   Một khối:  <PermissionGuard permission={permissions.users.create}><Button/></PermissionGuard>
 */
export function PermissionGuard({ permission, mode = 'any', redirect = false, fallback = null, children }: PermissionGuardProps) {
  const { user, canAny, canAll } = usePermissions()
  const router = useRouter()
  const pathname = usePathname()
  const roleSwitched = useAuthStore((s) => s.roleSwitched)
  const list = permission === undefined ? [] : Array.isArray(permission) ? permission : [permission]
  const allowed = !!user && (list.length === 0 || (mode === 'all' ? canAll(list) : canAny(list)))

  useEffect(() => {
    // Vừa đổi vai trò nhanh thì về trang chủ thay vì báo thiếu quyền (UC-SYS-09)
    if (!redirect || !user || allowed) return
    const goHome = roleSwitched && pathname !== appConfig.homeAfterLogin
    router.replace(goHome ? appConfig.homeAfterLogin : routePath.forbidden)
  }, [redirect, user, allowed, roleSwitched, pathname, router])

  if (!allowed) return redirect ? null : <>{fallback}</>
  return <>{children}</>
}
