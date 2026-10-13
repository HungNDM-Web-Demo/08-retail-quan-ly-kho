'use client'

import { ArrowRight, BadgeCheck, BriefcaseBusiness, Loader2, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { roleCodes } from '@/config/permissions'
import { useDemoAccounts, useQuickLogin } from '@/features/demo/hooks/use-demo'
import { getErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { AuthResponse } from '../types/auth.types'

const ROLE_ICONS: Record<string, LucideIcon> = {
  [roleCodes.admin]: ShieldCheck,
  [roleCodes.manager]: BriefcaseBusiness,
  [roleCodes.staff]: UserRound,
}

/**
 * Khu "Đăng nhập nhanh" (UC-SYS-02): mỗi vai trò demo một thẻ kèm mô tả.
 * Không có tài khoản demo (BE tắt DEMO_MODE) thì không hiển thị (E1).
 */
export function QuickLogin({ onSuccess }: { onSuccess: (response: AuthResponse) => void }) {
  const { data: accounts, isLoading, isError } = useDemoAccounts()
  const quickLogin = useQuickLogin()

  if (isError || (!isLoading && !accounts?.length)) return null

  return (
    <section aria-labelledby="quick-login-title" className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" aria-hidden="true" />
        <h2 id="quick-login-title" className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Hoặc đăng nhập nhanh để xem demo
        </h2>
        <span className="bg-border h-px flex-1" aria-hidden="true" />
      </div>

      <div className="grid gap-2">
        {isLoading
          ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[4.5rem] w-full rounded-xl" />)
          : accounts!.map((account) => {
              const Icon = ROLE_ICONS[account.roleCode] ?? BadgeCheck
              const pending = quickLogin.isPending && quickLogin.variables === account.roleCode
              return (
                <button
                  key={account.username}
                  type="button"
                  disabled={quickLogin.isPending}
                  onClick={() =>
                    quickLogin.mutate(account.roleCode, {
                      onSuccess,
                      onError: (error) => toast.error(getErrorMessage(error)),
                    })
                  }
                  className={cn(
                    'group bg-card flex min-h-[4.5rem] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left shadow-xs transition-[border-color,box-shadow,background-color] duration-200 outline-none',
                    'hover:border-primary/50 hover:shadow-md focus-visible:ring-ring/50 focus-visible:ring-3 disabled:cursor-wait',
                    quickLogin.isPending && !pending && 'opacity-60'
                  )}
                  aria-label={`Đăng nhập nhanh vai trò ${account.roleName}`}
                >
                  <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold">{account.roleName}</span>
                      <span className="text-muted-foreground text-xs">{account.fullName}</span>
                    </span>
                    {account.description && (
                      <span className="text-muted-foreground mt-0.5 block text-sm leading-snug">{account.description}</span>
                    )}
                  </span>
                  {pending ? (
                    <Loader2 className="text-primary size-5 shrink-0 animate-spin" aria-hidden="true" />
                  ) : (
                    <ArrowRight
                      className="text-muted-foreground group-hover:text-primary size-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  )}
                </button>
              )
            })}
      </div>
    </section>
  )
}
