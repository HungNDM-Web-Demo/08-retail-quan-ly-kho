'use client'

import { UserRound } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { KeeperCandidate } from '@/types/inventory'

/**
 * Chọn thủ kho phụ trách (FR-05, UC-02 bước 3): tài khoản vai trò Thủ kho đang hoạt động
 * (`GET /api/warehouses/keeper-candidates`), kèm kho họ đang phụ trách để quản lý cân nhắc.
 */
export function KeeperPicker({
  candidates,
  loading,
  value,
  onChange,
  currentCode,
}: {
  candidates: KeeperCandidate[] | undefined
  loading?: boolean
  value: string[]
  onChange: (ids: string[]) => void
  /** Mã kho đang sửa, để không nhắc lại trong "đang phụ trách" */
  currentCode?: string
}) {
  if (loading) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    )
  }
  if (!candidates?.length) {
    return (
      <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5 text-sm">
        Chưa có tài khoản vai trò Thủ kho đang hoạt động. Thêm ở Cài đặt → Tài khoản.
      </p>
    )
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {candidates.map((c) => {
        const checked = value.includes(c.id)
        const id = `keeper-${c.id}`
        const others = c.warehouseCodes.filter((code) => code !== currentCode)
        return (
          <label
            key={c.id}
            htmlFor={id}
            className={cn(
              'flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-150',
              checked ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/60'
            )}
          >
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={(v) => onChange(v ? [...value, c.id] : value.filter((x) => x !== c.id))}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <UserRound className="text-muted-foreground size-3.5" aria-hidden="true" />
                {c.fullName}
              </span>
              <span className="text-muted-foreground block text-xs leading-snug">
                @{c.username}
                {others.length > 0 ? ` · đang phụ trách ${others.join(', ')}` : ' · chưa phụ trách kho khác'}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
