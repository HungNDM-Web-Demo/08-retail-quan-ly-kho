import { cn } from '@/lib/utils'

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral'

const TONES: Record<StatusTone, string> = {
  success: 'bg-success/12 text-success ring-success/25',
  warning: 'bg-warning/12 text-warning ring-warning/25',
  danger: 'bg-destructive/10 text-destructive ring-destructive/25',
  info: 'bg-info/10 text-info ring-info/25',
  primary: 'bg-primary/10 text-primary ring-primary/25',
  neutral: 'bg-muted text-muted-foreground ring-border',
}

const DOTS: Record<StatusTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info',
  primary: 'bg-primary',
  neutral: 'bg-muted-foreground',
}

type StatusBadgeProps = {
  tone?: StatusTone
  /** Chấm màu đầu nhãn; luôn đi kèm chữ để không chỉ dựa vào màu */
  dot?: boolean
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** Nhãn trạng thái: Đang hoạt động, Đã khóa, Mới, Hoàn thành… */
export function StatusBadge({ tone = 'neutral', dot = true, icon, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        TONES[tone],
        className
      )}
    >
      {icon ?? (dot && <span className={cn('size-1.5 rounded-full', DOTS[tone])} aria-hidden="true" />)}
      {children}
    </span>
  )
}
