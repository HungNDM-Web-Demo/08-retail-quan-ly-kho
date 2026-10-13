import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: string
  description?: React.ReactNode
  icon?: LucideIcon
  /** Nút hành động bên phải (Thêm mới, Xuất file…) */
  actions?: React.ReactNode
  className?: string
}

/** Tiêu đề trang: tên, mô tả ngắn, nút hành động. Trên điện thoại nút xuống dòng dưới tiêu đề. */
export function PageHeader({ title, description, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="bg-primary/10 text-primary mt-0.5 hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex">
            <Icon className="size-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {description && <p className="text-muted-foreground text-sm text-pretty">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
