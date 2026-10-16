'use client'

import { useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api-error'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { exportExcel, type ExcelSheet } from '../lib/export-excel'

/** Trục tiền gọn: 1.250.000 → "1,3tr", 85.000 → "85k", 1.250.000.000 → "1,3 tỷ" */
export const compactVnd = (v: number) =>
  Math.abs(v) >= 1_000_000_000
    ? `${formatNumber(v / 1_000_000_000, 1)} tỷ`
    : Math.abs(v) >= 1_000_000
      ? `${formatNumber(v / 1_000_000, 1)}tr`
      : Math.abs(v) >= 1000
        ? `${formatNumber(v / 1000, 0)}k`
        : formatNumber(v, 0)

/** 12.5 → "12,5%" (1 chữ số thập phân, dấu phẩy; 07 §4.6) */
export const formatPercent = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${formatNumber(v, 1)}%`

/** Số lượng nguyên, 0 hiện "0" */
export const qty = (v: number | null | undefined) => formatNumber(v ?? 0, 0)

/** Nút "Xuất Excel": dựng trang tính khi bấm (có thể tải thêm dữ liệu) rồi tải file về máy */
export function ExportButton({
  fileName,
  build,
  disabled,
  label = 'Xuất Excel',
  variant = 'outline',
}: {
  fileName: string
  build: () => ExcelSheet[] | Promise<ExcelSheet[]>
  disabled?: boolean
  label?: string
  variant?: 'outline' | 'ghost' | 'default'
}) {
  const [pending, setPending] = useState(false)
  return (
    <Button
      variant={variant}
      disabled={disabled || pending}
      onClick={async () => {
        setPending(true)
        try {
          await exportExcel(fileName, await build())
          toast.success(`Đã tải ${fileName}`)
        } catch (error) {
          toast.error(getErrorMessage(error, 'Không xuất được file Excel'))
        } finally {
          setPending(false)
        }
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}
      {label}
    </Button>
  )
}

/** Thẻ số liệu tổng của tab báo cáo */
export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: 'destructive' | 'success' | 'warning'
}) {
  return (
    <div className="bg-card rounded-xl border p-4 shadow-xs">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-semibold tabular-nums',
          tone === 'destructive' && 'text-destructive',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning'
        )}
      >
        {value}
      </p>
      {sub && <div className="text-muted-foreground mt-1 text-xs">{sub}</div>}
    </div>
  )
}

/** Khung chờ tải chung: hàng thẻ và một khối bảng */
export function TabLoading({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải báo cáo">
      {cards > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: cards }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}

/** Thanh lọc riêng của tab và nút xuất */
export function TabToolbar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}
