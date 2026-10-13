'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PUBLIC_QUERY_ROOT, resetPrivateQueries } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth.store'
import { demoService } from '../services/demo.service'

export const demoKeys = {
  accounts: [PUBLIC_QUERY_ROOT, 'demo-accounts'] as const,
}

/** Nguồn dữ liệu đang chạy (dữ liệu mẫu hay máy chủ thật) để hiển thị cho người trình diễn. */
export function useDemoEnvironment() {
  return demoService.environment()
}

/** Tài khoản demo cho khu "Đăng nhập nhanh" và thanh công cụ demo. Lỗi (DEMO_MODE tắt) thì ẩn. */
export function useDemoAccounts() {
  return useQuery({
    queryKey: demoKeys.accounts,
    queryFn: () => demoService.getAccounts(),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

/**
 * Đổi mã vai trò sang tên hiển thị ("MANAGER" → "Quản lý") dựa trên danh sách tài khoản demo
 * (CurrentUser chỉ có mã vai trò). Không tìm thấy thì trả lại mã.
 */
export function useRoleLabel() {
  const { data } = useDemoAccounts()
  return (code: string) => data?.find((a) => a.roleCode === code)?.roleName || code
}

/** UC-SYS-02: đăng nhập nhanh trên trang đăng nhập (phiên chung cho mọi tab). */
export function useQuickLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (roleCode: string) => demoService.loginAs({ roleCode }),
    onSuccess: (response) => {
      useAuthStore.getState().setSession(response, 'local')
      void resetPrivateQueries(queryClient)
    },
  })
}

/**
 * UC-SYS-09: đổi vai trò nhanh từ thanh công cụ demo.
 * Phiên mới chỉ ghi vào sessionStorage của tab này (KIEN-TRUC-HE-THONG §6.2 quy tắc 6).
 */
export function useSwitchRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (roleCode: string) => demoService.loginAs({ roleCode }),
    onSuccess: (response) => {
      useAuthStore.getState().switchSession(response)
      void resetPrivateQueries(queryClient)
    },
  })
}

/** UC-SYS-10: đặt lại dữ liệu demo. Thành công thì tải lại trang. */
export function useResetDemoData() {
  return useMutation({
    mutationFn: () => demoService.reset(),
  })
}
