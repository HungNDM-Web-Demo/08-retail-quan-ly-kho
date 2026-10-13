import { RefreshCw, ServerCrash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'

type ErrorStateProps = {
  error?: unknown
  title?: string
  onRetry?: () => void
  className?: string
}

/** Khối báo lỗi tải dữ liệu kèm nút thử lại. */
export function ErrorState({ error, title = 'Không tải được dữ liệu', onRetry, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <ServerCrash className="size-6" aria-hidden="true" />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{getErrorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Thử lại
        </Button>
      )}
    </div>
  )
}
