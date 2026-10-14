'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { routePath } from '@/config/route-path'
import { resolveHomePath } from '@/config/routes'
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
  const { user, can, canAny, canAll } = usePermissions()
  const router = useRouter()
  const pathname = usePathname()
  const roleSwitched = useAuthStore((s) => s.roleSwitched)
  const list = permission === undefined ? [] : Array.isArray(permission) ? permission : [permission]
  const allowed = !!user && (list.length === 0 || (mode === 'all' ? canAll(list) : canAny(list)))

  // Chỉ chuyển trang một lần: AuthGuard xóa cờ roleSwitched ngay sau lần chuyển về trang chủ, nếu chạy lại
  // effect sẽ đè bằng /forbidden trước khi điều hướng xong.
  const redirected = useRef(false)

  useEffect(() => {
    // Vừa đổi vai trò nhanh thì về trang chủ thay vì báo thiếu quyền (UC-SYS-09)
    if (allowed) redirected.current = false
    if (!redirect || !user || allowed || redirected.current) return
    redirected.current = true
    const home = resolveHomePath(can)
    const goHome = roleSwitched && pathname !== home
    router.replace(goHome ? home : routePath.forbidden)
  }, [redirect, user, allowed, roleSwitched, pathname, router, can])

  if (!allowed) return redirect ? null : <>{fallback}</>
  return <>{children}</>
}
