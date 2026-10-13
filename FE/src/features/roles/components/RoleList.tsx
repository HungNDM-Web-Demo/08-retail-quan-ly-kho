'use client'

import { Lock, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { RoleDto } from '../types/role.types'

type RoleListProps = {
  roles: RoleDto[] | undefined
  isLoading?: boolean
  selectedId?: string
  onSelect: (role: RoleDto) => void
}

/** Danh sách vai trò kèm số tài khoản mỗi vai trò (UC-SYS-06 bước 1). */
export function RoleList({ roles, isLoading, selectedId, onSelect }: RoleListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <nav aria-label="Danh sách vai trò" className="space-y-2">
      {(roles ?? []).map((role) => {
        const active = role.id === selectedId
        return (
          <button
            key={role.id}
            type="button"
            onClick={() => onSelect(role)}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'bg-card w-full rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow] duration-150 outline-none',
              'focus-visible:ring-ring/50 focus-visible:ring-3',
              active ? 'border-primary/60 bg-primary/5 shadow-xs' : 'hover:border-foreground/20 hover:bg-muted/40'
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className={cn('block truncate font-semibold', active && 'text-primary')}>{role.name}</span>
                <span className="text-muted-foreground font-mono text-xs">{role.code}</span>
              </span>
              <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs tabular-nums" title="Số tài khoản">
                <Users className="size-3.5" aria-hidden="true" />
                {role.userCount}
                <span className="sr-only">tài khoản</span>
              </span>
            </span>
            {role.description && (
              <span className="text-muted-foreground mt-2 line-clamp-2 block text-sm leading-snug">{role.description}</span>
            )}
            {role.isSystem && (
              <span className="text-muted-foreground mt-2 inline-flex items-center gap-1 text-xs">
                <Lock className="size-3" aria-hidden="true" />
                Vai trò hệ thống
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
