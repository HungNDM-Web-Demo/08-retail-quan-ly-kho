'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { routePath } from '@/config/route-path'
import { getVisibleNavGroups, resolveHomePath } from '@/config/routes'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { useRoleLabel } from '@/features/demo/hooks/use-demo'
import { usePermissions } from '@/hooks/use-permissions'
import { cn } from '@/lib/utils'
import { BrandLogo } from './BrandLogo'
import { UserAvatar } from './UserAvatar'

const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

/**
 * Thanh bên trái: menu lấy từ config/routes, tự ẩn mục thiếu quyền (KIEN-TRUC-HE-THONG §6.4).
 * Desktop thu gọn còn icon (Ctrl/⌘ + B); điện thoại mở dạng ngăn kéo.
 */
export function AppSidebar() {
  const pathname = usePathname()
  const { can, user, roles } = usePermissions()
  const { isMobile, setOpenMobile } = useSidebar()
  const roleLabel = useRoleLabel()
  const groups = getVisibleNavGroups(can)

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 justify-center border-b px-3 group-data-[collapsible=icon]:px-2">
        <Link
          href={resolveHomePath(can)}
          onClick={closeOnMobile}
          className="focus-visible:ring-sidebar-ring flex min-w-0 items-center rounded-md outline-none focus-visible:ring-2 group-data-[collapsible=icon]:justify-center"
          aria-label="Về trang chủ"
        >
          <BrandLogo size="md" nameClassName="group-data-[collapsible=icon]:hidden" className="group-data-[collapsible=icon]:gap-0" />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {groups.map((group) => (
          <SidebarGroup key={group.id} className="group-data-[collapsible=icon]:px-3">
            {group.label && (
              <SidebarGroupLabel className="text-muted-foreground text-[0.6875rem] font-semibold tracking-wider uppercase">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const active = !item.newTab && isActivePath(pathname, item.href)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className={cn(
                          'h-10 gap-3 px-3 text-[0.875rem] transition-colors duration-150 group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! [&_svg]:size-[1.125rem] group-data-[collapsible=icon]:[&>span]:hidden',
                          'data-active:bg-primary/10 data-active:text-primary data-active:font-semibold'
                        )}
                      >
                        {item.newTab ? (
                          // Mục mở tab mới (vd "Xem trang công khai"): báo rõ cho trình đọc màn hình
                          <a href={item.href} target="_blank" rel="noopener" onClick={closeOnMobile}>
                            <item.icon aria-hidden="true" />
                            <span>{item.title}</span>
                            <span className="sr-only"> (mở tab mới)</span>
                          </a>
                        ) : (
                          <Link href={item.href} onClick={closeOnMobile} aria-current={active ? 'page' : undefined}>
                            <item.icon aria-hidden="true" />
                            <span>{item.title}</span>
                          </Link>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {user && (
        <SidebarFooter className="border-t p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="lg"
                tooltip={`${user.fullName} · Hồ sơ cá nhân`}
                isActive={isActivePath(pathname, routePath.profile)}
                className="gap-3 px-2 group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[&>span]:hidden"
              >
                <Link href={routePath.profile} onClick={closeOnMobile}>
                  <UserAvatar name={user.fullName} avatarUrl={user.avatarUrl} size="sm" />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-medium">{user.fullName}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {roles.map(roleLabel).join(', ') || user.username}
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  )
}
