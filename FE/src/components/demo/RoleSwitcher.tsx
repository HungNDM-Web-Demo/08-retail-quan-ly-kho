'use client'

import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useDemoAccounts, useSwitchRole } from '@/features/demo/hooks/use-demo'
import type { DemoAccount } from '@/features/demo/types/demo.types'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'

/**
 * Đổi vai trò nhanh (UC-SYS-09, TC-SYS-09): đăng nhập bằng tài khoản demo khác, chỉ cho tab này.
 * Giữ trang hiện tại nếu vai trò mới có quyền, không thì về trang chủ (AuthGuard xử lý).
 */
export function RoleSwitcher({ onSwitched }: { onSwitched?: () => void }) {
  const { data: accounts, isLoading, isError } = useDemoAccounts()
  const { user } = usePermissions()
  const switchRole = useSwitchRole()

  const handleSwitch = (account: DemoAccount) => {
    if (account.username === user?.username || switchRole.isPending) return
    switchRole.mutate(account.roleCode, {
      // Trang hiện tại không còn quyền thì AuthGuard tự đưa về trang chủ
      onSuccess: () => {
        toast.success(`Đã chuyển sang ${account.roleName}`, {
          description: `${account.fullName} · chỉ áp dụng cho tab này`,
        })
        onSwitched?.()
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (isError || !accounts?.length) {
    return <p className="text-muted-foreground text-sm">Chưa bật tài khoản demo (DEMO_MODE).</p>
  }

  return (
    <div role="radiogroup" aria-label="Đổi vai trò nhanh" className="space-y-1.5">
      {accounts.map((account) => {
        const current = account.username === user?.username
        const pending = switchRole.isPending && switchRole.variables === account.roleCode
        return (
          <button
            key={account.username}
            type="button"
            role="radio"
            aria-checked={current}
            disabled={switchRole.isPending && !pending}
            onClick={() => handleSwitch(account)}
            className={cn(
              'flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors duration-150 outline-none',
              'focus-visible:ring-ring/50 focus-visible:ring-3 disabled:opacity-60',
              current ? 'border-primary/40 bg-primary/8' : 'hover:bg-muted border-transparent'
            )}
          >
            <UserAvatar name={account.fullName} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{account.roleName}</span>
                {current && <span className="text-primary text-xs font-medium">Đang dùng</span>}
              </span>
              <span className="text-muted-foreground block truncate text-xs">{account.description || account.fullName}</span>
            </span>
            {pending ? (
              <Loader2 className="text-muted-foreground size-4 animate-spin" aria-label="Đang chuyển" />
            ) : current ? (
              <Check className="text-primary size-4" aria-hidden="true" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
