'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { appConfig } from '@/config/app.config'
import { PUBLIC_QUERY_ROOT } from '@/lib/query-client'
import { settingService } from '../services/setting.service'
import { settingKeys, type UpdateSettingsRequest } from '../types/setting.types'

export const settingQueryKeys = {
  public: [PUBLIC_QUERY_ROOT, 'settings'] as const,
  all: ['settings'] as const,
}

/** Cài đặt công khai (Brand.*, Company.*), không cần đăng nhập. */
export function usePublicSettings() {
  return useQuery({
    queryKey: settingQueryKeys.public,
    queryFn: () => settingService.getPublic(),
    staleTime: 5 * 60_000,
  })
}

export type Brand = {
  appName: string
  logoUrl: string
  primaryColor: string | null
  company: {
    name: string
    hotline: string
    zalo: string
    email: string
    address: string
    website: string
  }
  isLoading: boolean
}

/** Thương hiệu đang dùng, có giá trị mặc định khi chưa tải xong. */
export function useBrand(): Brand {
  const { data, isLoading } = usePublicSettings()
  const get = (key: string) => data?.[key]?.trim() ?? ''
  return {
    appName: get(settingKeys.appName) || appConfig.name,
    logoUrl: get(settingKeys.logoUrl),
    primaryColor: get(settingKeys.primaryColor) || null,
    company: {
      name: get(settingKeys.companyName),
      hotline: get(settingKeys.companyHotline),
      zalo: get(settingKeys.companyZalo),
      email: get(settingKeys.companyEmail),
      address: get(settingKeys.companyAddress),
      website: get(settingKeys.companyWebsite),
    },
    isLoading,
  }
}

/** Toàn bộ cài đặt (quyền settings.view). */
export function useSettings() {
  return useQuery({
    queryKey: settingQueryKeys.all,
    queryFn: () => settingService.getAll(),
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: UpdateSettingsRequest) => settingService.update(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settingQueryKeys.all })
      void queryClient.invalidateQueries({ queryKey: settingQueryKeys.public })
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    },
  })
}

export function useUploadImage() {
  return useMutation({
    mutationFn: (file: File) => settingService.uploadImage(file),
  })
}
