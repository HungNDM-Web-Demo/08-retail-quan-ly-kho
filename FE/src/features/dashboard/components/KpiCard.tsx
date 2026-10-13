import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

type KpiCardProps = {
  label: string
  /** Giá trị đã định dạng, vd formatVnd(12500000) */
  value: React.ReactNode
  icon?: LucideIcon
  /** Phần trăm thay đổi so với kỳ trước, vd 12.5 hoặc -3 */
  change?: number
  /** Chú thích kỳ so sánh, vd "so với hôm qua" */
  changeLabel?: string
  /** true khi giảm là tốt (chi phí, đơn hủy…) */
  inverse?: boolean
  isLoading?: boolean
  className?: string
}

/**
 * Thẻ chỉ số cho trang Tổng quan của dự án.
 *   <KpiCard label="Doanh thu hôm nay" value={formatVnd(revenue)} icon={Wallet} change={8.2} changeLabel="so với hôm qua" />
 */
export function KpiCard({ label, value, icon: Icon, change, changeLabel, inverse, isLoading, className }: KpiCardProps) {
  const up = (change ?? 0) >= 0
  const good = inverse ? !up : up

  return (
    <div className={cn('bg-card rounded-xl border p-5 shadow-xs', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        {Icon && (
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Icon className="size-[1.125rem]" aria-hidden="true" />
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="mt-2 h-8 w-32" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      )}
      {change !== undefined && !isLoading && (
        <p className="mt-2 flex items-center gap-1.5 text-xs">
          <span className={cn('inline-flex items-center gap-0.5 font-semibold', good ? 'text-success' : 'text-destructive')}>
            {up ? <TrendingUp className="size-3.5" aria-hidden="true" /> : <TrendingDown className="size-3.5" aria-hidden="true" />}
            {up ? '+' : ''}
            {formatNumber(change, 1)}%
          </span>
          {changeLabel && <span className="text-muted-foreground">{changeLabel}</span>}
        </p>
      )}
    </div>
  )
}
