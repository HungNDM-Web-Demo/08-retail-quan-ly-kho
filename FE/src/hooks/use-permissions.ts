'use client'

import { useCallback, useMemo } from 'react'
import { useAuthStore } from '@/stores/auth.store'

/**
 * Kiểm tra quyền trên FE (FE-CAU-TRUC-THU-MUC §4, KIEN-TRUC-HE-THONG §7.5).
 *   const { can } = usePermissions()
 *   {can(permissions.users.create) && <Button>Thêm</Button>}
 * Quản trị viên (isSuperAdmin) luôn có mọi quyền.
 */
export function usePermissions() {
  const user = useAuthStore((state) => state.session?.user ?? null)

  const permissionSet = useMemo(() => new Set(user?.permissions ?? []), [user])
  const roleSet = useMemo(() => new Set(user?.roles ?? []), [user])
  const isSuperAdmin = !!user?.isSuperAdmin

  const can = useCallback(
    (permission: string) => !!user && (isSuperAdmin || permissionSet.has(permission)),
    [user, isSuperAdmin, permissionSet]
  )
  const canAny = useCallback(
    (list: string[]) => !!user && (isSuperAdmin || list.some((p) => permissionSet.has(p))),
    [user, isSuperAdmin, permissionSet]
  )
  const canAll = useCallback(
    (list: string[]) => !!user && (isSuperAdmin || list.every((p) => permissionSet.has(p))),
    [user, isSuperAdmin, permissionSet]
  )
  const hasRole = useCallback((role: string) => roleSet.has(role), [roleSet])
  const hasAnyRole = useCallback((roles: string[]) => roles.some((r) => roleSet.has(r)), [roleSet])

  return {
    user,
    permissions: user?.permissions ?? [],
    roles: user?.roles ?? [],
    isSuperAdmin,
    can,
    canAny,
    canAll,
    hasRole,
    hasAnyRole,
  }
}
