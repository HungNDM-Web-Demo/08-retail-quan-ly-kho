'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api-error'

/**
 * Khung một bản in: thanh công cụ (không in), tờ A4, chữ chìm "CHƯA DUYỆT" khi phiếu chưa ghi sổ (quyết định 32).
 * Mở với `?print=1` thì tự gọi `window.print()` một lần sau khi dữ liệu đã sẵn sàng (07 §2.11).
 */
export function PrintPage({
  title,
  ready,
  error,
  draft,
  children,
}: {
  title: string
  ready: boolean
  error?: unknown
  /** Chữ chìm "CHƯA DUYỆT" */
  draft?: boolean
  children?: React.ReactNode
}) {
  const search = useSearchParams()
  const printed = useRef(false)
  const auto = search.get('print') === '1'

  useEffect(() => {
    document.title = title
  }, [title])

  useEffect(() => {
    if (!ready || !auto || printed.current) return
    printed.current = true
    const timer = window.setTimeout(() => window.print(), 400)
    return () => window.clearTimeout(timer)
  }, [ready, auto])

  return (
    <div className="bg-muted/60 min-h-dvh print:bg-white">
      <div className="no-print bg-background/95 sticky top-0 z-10 mb-6 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur">
        <Button variant="ghost" onClick={() => (window.history.length > 1 ? window.history.back() : window.close())}>
          <ArrowLeft aria-hidden="true" />
          Quay lại
        </Button>
        <p className="text-muted-foreground hidden truncate text-sm sm:block">{title} · khổ A4 dọc</p>
        <Button onClick={() => window.print()} disabled={!ready}>
          <Printer aria-hidden="true" />
          In
        </Button>
      </div>
      {error ? (
        <div className="text-destructive mx-auto max-w-lg px-4 text-center" role="alert">
          {getErrorMessage(error)}
        </div>
      ) : !ready ? (
        <div className="print-sheet bg-card space-y-4 rounded-md shadow-sm">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <article className="print-sheet bg-card text-card-foreground relative overflow-hidden rounded-md shadow-sm">
          {draft && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-foreground/10 -rotate-30 text-[64pt] font-black tracking-widest whitespace-nowrap select-none">
                CHƯA DUYỆT
              </span>
            </div>
          )}
          <div className="relative">{children}</div>
        </article>
      )}
    </div>
  )
}
