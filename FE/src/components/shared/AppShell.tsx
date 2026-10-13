'use client'

import { DemoToolbar } from '@/components/demo/DemoToolbar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { appConfig } from '@/config/app.config'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui.store'
import { AppSidebar } from './AppSidebar'
import { Header } from './Header'

/** Khung trang quản trị: sidebar + header + nội dung + thanh công cụ demo. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <a
        href="#noi-dung"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua menu, tới nội dung
      </a>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <Header />
        <div
          id="noi-dung"
          className={cn(
            'mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8',
            // Chừa chỗ cho nút công cụ demo nổi ở góc dưới để không che nội dung cuối trang
            appConfig.demoToolbar && 'pb-24 sm:pb-24'
          )}
        >
          {children}
        </div>
      </SidebarInset>
      <DemoToolbar />
    </SidebarProvider>
  )
}
