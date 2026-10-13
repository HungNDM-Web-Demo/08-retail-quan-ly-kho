'use client'

import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { findRoute } from '@/config/routes'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

/** Thanh đầu trang: nút thu gọn menu, tiêu đề trang theo config/routes, sáng/tối, menu tài khoản. */
export function Header({ actions }: { actions?: React.ReactNode }) {
  const pathname = usePathname()
  const match = findRoute(pathname)

  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/65 sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-md sm:px-4 lg:px-6">
      <SidebarTrigger className="size-10" />
      <Separator orientation="vertical" className="mx-1 h-5! self-center" />

      <nav aria-label="Vị trí trang" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        {match?.group?.label && (
          <>
            <span className="text-muted-foreground hidden truncate sm:inline">{match.group.label}</span>
            <ChevronRight className="text-muted-foreground hidden size-4 shrink-0 sm:block" aria-hidden="true" />
          </>
        )}
        <span className="text-foreground truncate font-semibold">{match?.item.title ?? ''}</span>
      </nav>

      <div className="flex items-center gap-1">
        {actions}
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
