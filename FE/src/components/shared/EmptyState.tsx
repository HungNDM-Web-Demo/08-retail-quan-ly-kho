import { Inbox, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type EmptyStateProps = {
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  /** Hành động gợi ý: "Thêm mới", "Xóa bộ lọc" */
  action?: React.ReactNode
  className?: string
  compact?: boolean
}

/** Trạng thái trống có hướng dẫn bước tiếp theo (không để màn hình trắng). */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14',
        className
      )}
    >
      <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-foreground font-medium">{title}</p>
        {description && <p className="text-muted-foreground text-sm text-pretty">{description}</p>}
      </div>
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}
