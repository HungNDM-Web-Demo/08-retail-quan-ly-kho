'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

export type PaginationProps = {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
}

/** Dãy số trang rút gọn: 1 … 4 5 6 … 20 */
function pageWindow(page: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, total, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p))
  if (page >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => pages.add(p))
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const result: (number | 'gap')[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('gap')
    result.push(p)
  })
  return result
}

export function DataTablePagination({
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: PaginationProps) {
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalCount)
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span aria-live="polite">
          {totalCount === 0 ? (
            'Không có dòng nào'
          ) : (
            <>
              Hiển thị <span className="text-foreground font-medium">{formatNumber(from)}–{formatNumber(to)}</span> trên{' '}
              <span className="text-foreground font-medium">{formatNumber(totalCount)}</span> dòng
            </>
          )}
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            <span className="whitespace-nowrap">Số dòng</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-9 w-[4.75rem]" aria-label="Số dòng mỗi trang">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
      </div>

      <nav aria-label="Phân trang" className="flex items-center justify-between gap-1 sm:justify-end">
        <Button
          variant="outline"
          size="icon"
          className="hidden size-9 sm:inline-flex"
          disabled={!canPrev}
          onClick={() => onPageChange(1)}
          aria-label="Trang đầu"
        >
          <ChevronsLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft />
        </Button>

        <span className="text-muted-foreground px-2 text-sm sm:hidden">
          Trang <span className="text-foreground font-medium">{page}</span>/{totalPages}
        </span>
        <div className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, totalPages).map((item, index) =>
            item === 'gap' ? (
              <span key={`gap-${index}`} className="text-muted-foreground w-6 text-center text-sm" aria-hidden="true">
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? 'default' : 'ghost'}
                size="icon"
                className={cn('size-9 tabular-nums', item !== page && 'text-muted-foreground')}
                onClick={() => onPageChange(item)}
                aria-label={`Trang ${item}`}
                aria-current={item === page ? 'page' : undefined}
              >
                {item}
              </Button>
            )
          )}
        </div>

        <Button
          variant="outline"
          size="icon"
          className="size-9"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          aria-label="Trang sau"
        >
          <ChevronRight />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="hidden size-9 sm:inline-flex"
          disabled={!canNext}
          onClick={() => onPageChange(totalPages)}
          aria-label="Trang cuối"
        >
          <ChevronsRight />
        </Button>
      </nav>
    </div>
  )
}
