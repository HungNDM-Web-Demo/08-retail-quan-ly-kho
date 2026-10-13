'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { routePath } from '@/config/route-path'
import { useLogout } from '@/features/auth/hooks/use-auth'
import { useRoleLabel } from '@/features/demo/hooks/use-demo'
import { usePermissions } from '@/hooks/use-permissions'
import { UserAvatar } from './UserAvatar'

/** Menu tài khoản trên Header: hồ sơ, giao diện sáng/tối, đăng xuất (UC-SYS-03). */
export function UserMenu() {
  const { user, roles } = usePermissions()
  const { theme, setTheme } = useTheme()
  const roleLabel = useRoleLabel()
  const logout = useLogout()
  const router = useRouter()

  if (!user) return null

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        toast.success('Đã đăng xuất')
        router.replace(routePath.login)
      },
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-1.5 sm:pr-2.5" aria-label={`Tài khoản ${user.fullName}`}>
          <UserAvatar name={user.fullName} avatarUrl={user.avatarUrl} size="sm" />
          <span className="hidden max-w-40 flex-col items-start leading-tight lg:flex">
            <span className="truncate text-sm font-medium">{user.fullName}</span>
            <span className="text-muted-foreground truncate text-xs font-normal">
              {roles.map(roleLabel).join(', ')}
            </span>
          </span>
          <ChevronDown className="text-muted-foreground hidden size-4 lg:block" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 py-2 font-normal">
          <UserAvatar name={user.fullName} avatarUrl={user.avatarUrl} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{user.fullName}</span>
            <span className="text-muted-foreground truncate text-xs">@{user.username}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="h-10">
          <Link href={routePath.profile}>
            <UserRound aria-hidden="true" />
            Hồ sơ cá nhân
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">Giao diện</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? 'light'} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light" className="h-9">
            <Sun aria-hidden="true" /> Sáng
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="h-9">
            <Moon aria-hidden="true" /> Tối
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="h-9">
            <Monitor aria-hidden="true" /> Theo hệ thống
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className="h-10" onSelect={handleLogout} disabled={logout.isPending}>
          <LogOut aria-hidden="true" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
