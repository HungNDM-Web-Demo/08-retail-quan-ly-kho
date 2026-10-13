'use client'

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PUBLIC_QUERY_ROOT, resetPrivateQueries } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth.store'
import { authService } from '../services/auth.service'
import type { ChangePasswordRequest, LoginRequest } from '../types/auth.types'

export const authKeys = {
  me: ['auth', 'me'] as const,
}

/** Phiên hiện tại: người dùng, đã đọc xong bộ nhớ chưa, đã đăng nhập chưa. */
export function useAuth() {
  const session = useAuthStore((s) => s.session)
  const hydrated = useAuthStore((s) => s.hydrated)
  const kind = useAuthStore((s) => s.kind)
  return {
    hydrated,
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session,
    /** true khi tab này đang dùng vai trò đổi nhanh (sessionStorage) */
    isTabSession: kind === 'session',
  }
}

/** UC-SYS-01: đăng nhập bằng tên đăng nhập và mật khẩu. */
export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: LoginRequest) => authService.login(request),
    onSuccess: (response) => {
      useAuthStore.getState().setSession(response, 'local')
      void resetPrivateQueries(queryClient)
    },
  })
}

/** UC-SYS-03: thu hồi refresh token, xóa phiên trên trình duyệt. */
export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const refreshToken = useAuthStore.getState().session?.refreshToken
      if (refreshToken) await authService.logout({ refreshToken }).catch(() => undefined)
    },
    onSettled: () => {
      useAuthStore.getState().clear()
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== PUBLIC_QUERY_ROOT })
    },
  })
}

/**
 * Lấy lại quyền mới nhất của người đang đăng nhập (GET /api/auth/me) mỗi lần tải trang,
 * để đổi phân quyền có hiệu lực ở lần tải trang kế tiếp (UC-SYS-06 bước 4).
 */
export function useSyncCurrentUser() {
  const isAuthenticated = useAuthStore((s) => !!s.session)
  const query = useQuery({
    queryKey: authKeys.me,
    queryFn: () => authService.me(),
    enabled: isAuthenticated,
    staleTime: 60_000,
  })
  useEffect(() => {
    if (query.data) useAuthStore.getState().setUser(query.data)
  }, [query.data])
  return query
}

/** UC-SYS-04: đổi mật khẩu của chính mình. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (request: ChangePasswordRequest) => authService.changePassword(request),
  })
}
