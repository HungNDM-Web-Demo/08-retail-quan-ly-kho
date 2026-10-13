'use client'

import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BrandThemeSync } from '@/features/settings/components/BrandThemeSync'
import { isMockMode } from '@/lib/data-source'
import { getQueryClient } from '@/lib/query-client'
import { mockDb } from '@/mock/mock-db'
import { useAuthStore } from '@/stores/auth.store'

/** Đọc phiên đăng nhập; ở chế độ mock, tab khác sửa dữ liệu thì làm mới dữ liệu đang xem. */
function AppBootstrap() {
  useEffect(() => {
    useAuthStore.getState().hydrate()
  }, [])

  useEffect(() => {
    if (!isMockMode()) return
    const queryClient = getQueryClient()
    return mockDb.subscribe((event) => {
      if (event.remote) void queryClient.invalidateQueries()
    })
  }, [])

  return <BrandThemeSync />
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <TooltipProvider delayDuration={300}>
          <AppBootstrap />
          {children}
          <Toaster position="top-right" closeButton richColors />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
