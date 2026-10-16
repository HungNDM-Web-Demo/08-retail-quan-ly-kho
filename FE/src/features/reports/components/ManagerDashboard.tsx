'use client'

import Link from 'next/link'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpFromLine,
  ChartColumn,
  ClipboardCheck,
  PackageX,
  RefreshCw,
  Truck,
  Warehouse,
} from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { routePath, routeTo } from '@/config/route-path'
import { formatNumber, formatTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DashboardReport, DocKind } from '@/types/inventory'
import { useDashboardReport } from '../hooks/use-reports'
import { displayDateKey, shortDateKey } from '../lib/date-range'
import { compactVnd } from './ReportParts'

const chartConfig = {
  inValue: { label: 'Giá trị nhập', color: 'var(--chart-1)' },
  outValue: { label: 'Giá trị xuất', color: 'var(--chart-2)' },
} satisfies ChartConfig

const PENDING: { key: keyof Omit<DashboardReport['pending'], 'total'>; kind: DocKind; label: string }[] = [
  { key: 'goodsReceipts', kind: 'GoodsReceipt', label: 'Nhập' },
  { key: 'goodsIssues', kind: 'GoodsIssue', label: 'Xuất' },
  { key: 'transfers', kind: 'Transfer', label: 'Chuyển' },
  { key: 'stocktakes', kind: 'Stocktake', label: 'Kiểm kê' },
]

const cardLink =
  'group bg-card hover:border-primary/40 focus-visible:ring-ring/50 block rounded-xl border p-5 shadow-xs transition-[border-color,box-shadow] duration-200 outline-none hover:shadow-sm focus-visible:ring-3'

/**
 * SCR-01 Tổng quan quản lý (UC-12, FR-01, FR-02; 07 §4.6): giá trị tồn từng kho và tổng; phiếu chờ duyệt theo loại;
 * hàng đang chuyển; dưới tối thiểu, hết hàng, vượt tối đa; biểu đồ nhập/xuất 30 ngày; top 10 xuất. Bấm thẻ mở danh
 * sách đã lọc sẵn.
 */
export function ManagerDashboard({ header }: { header: React.ReactNode }) {
  const report = useDashboardReport()
  const data = report.data

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {header}
        <div className="flex items-center gap-3">
          {data && <p className="text-muted-foreground text-sm">Cập nhật lúc {formatTime(data.asOf)}</p>}
          <Button variant="outline" onClick={() => void report.refetch()} disabled={report.isFetching}>
            <RefreshCw className={cn(report.isFetching && 'animate-spin')} aria-hidden="true" />
            Làm mới
          </Button>
        </div>
      </div>
      {report.error && !data ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <DashboardBody data={data} />
      )}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Đang tải tổng quan">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}

function DashboardBody({ data }: { data: DashboardReport }) {
  const sumIn = data.daily.reduce((s, d) => s + d.inValue, 0)
  const sumOut = data.daily.reduce((s, d) => s + d.outValue, 0)
  const hasChart = sumIn > 0 || sumOut > 0
  const first = data.daily[0]?.date
  const last = data.daily[data.daily.length - 1]?.date

  return (
    <>
      <section aria-label="Giá trị tồn kho" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-primary text-primary-foreground rounded-xl p-5 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium opacity-90">Tổng giá trị tồn</p>
            <Warehouse className="size-5 opacity-80" aria-hidden="true" />
          </div>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{formatVnd(data.totalStockValue)}</p>
          <p className="mt-1 text-xs opacity-85">{data.warehouses.length} kho đang hoạt động, chưa gồm hàng đang chuyển</p>
        </div>
        {data.warehouses.map((w) => (
          <Link key={w.warehouseId} href={`${routePath.stock}?warehouseId=${w.warehouseId}`} className={cardLink}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-muted-foreground min-w-0 text-sm font-medium">
                <span className="text-foreground font-mono font-semibold">{w.code}</span> · {w.name}
              </p>
              <ArrowRight
                className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </div>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{formatVnd(w.stockValue)}</p>
            <p className="text-muted-foreground mt-1 text-xs">{formatNumber(w.stockedProductCount, 0)} mặt hàng còn tồn</p>
          </Link>
        ))}
      </section>

      <section aria-label="Việc cần chú ý" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className={cn('bg-card rounded-xl border p-5 shadow-xs sm:col-span-2', data.pending.total > 0 && 'border-warning/50')}>
          <div className="flex items-start justify-between gap-3">
            <Link
              href={routePath.approvals}
              className="text-muted-foreground hover:text-primary text-sm font-medium underline-offset-4 hover:underline"
            >
              Phiếu chờ duyệt
            </Link>
            <ClipboardCheck className="text-warning size-5" aria-hidden="true" />
          </div>
          <p className={cn('mt-1 text-2xl font-semibold tabular-nums', data.pending.total > 0 && 'text-warning')}>
            {formatNumber(data.pending.total, 0)}
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {PENDING.map((p) => (
              <Link
                key={p.key}
                href={`${routePath.approvals}?kind=${p.kind}`}
                className="hover:bg-muted focus-visible:ring-ring/50 rounded-lg border px-2 py-1.5 text-center outline-none focus-visible:ring-3"
              >
                <span className="block text-lg font-semibold tabular-nums">{formatNumber(data.pending[p.key], 0)}</span>
                <span className="text-muted-foreground text-xs">{p.label}</span>
              </Link>
            ))}
          </div>
        </div>
        <Link href={`${routePath.transfers}?status=DangChuyen`} className={cardLink}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-muted-foreground text-sm font-medium">Đang chuyển</p>
            <Truck className="text-info size-5" aria-hidden="true" />
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatNumber(data.inTransit.count, 0)} <span className="text-muted-foreground text-base font-normal">phiếu</span>
          </p>
          <p className="text-sm tabular-nums">{formatVnd(data.inTransit.value)}</p>
          {data.inTransit.lateCount > 0 && (
            <StatusBadge tone="danger" className="mt-2">
              {data.inTransit.lateCount} phiếu trễ quá 3 ngày
            </StatusBadge>
          )}
        </Link>
        <AlertCard href={`${routePath.stock}?tab=alerts&status=DuoiToiThieu`} label="Dưới tối thiểu" value={data.belowMinCount} tone="warning" icon={AlertTriangle} />
        <div className="grid gap-4">
          <AlertCard href={`${routePath.stock}?tab=alerts&status=HetHang`} label="Hết hàng" value={data.outOfStockCount} tone="danger" icon={PackageX} compact />
          <AlertCard href={`${routePath.stock}?tab=alerts&status=VuotToiDa`} label="Vượt tối đa" value={data.overMaxCount} tone="info" icon={ArrowUpFromLine} compact />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Giá trị nhập, xuất 30 ngày</CardTitle>
            <CardDescription>
              {first && last && `${displayDateKey(first)} → ${displayDateKey(last)} · `}
              nhập {formatVnd(sumIn)} · xuất {formatVnd(sumOut)}. Không tính chuyển kho, kiểm kê, xuất điều chỉnh.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasChart ? (
              <EmptyState compact icon={ChartColumn} title="Chưa có phát sinh trong 30 ngày" />
            ) : (
              <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full" aria-label="Biểu đồ cột giá trị nhập và xuất theo ngày trong 30 ngày">
                <BarChart data={data.daily} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDateKey} tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis tickFormatter={compactVnd} tickLine={false} axisLine={false} width={56} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(v) => displayDateKey(String(v))}
                        formatter={(value, name) => (
                          <div className="flex w-full justify-between gap-4">
                            <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label}</span>
                            <span className="font-medium tabular-nums">{formatVnd(Number(value))}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="inValue" fill="var(--color-inValue)" radius={[3, 3, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="outValue" fill="var(--color-outValue)" radius={[3, 3, 0, 0]} maxBarSize={14} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 pb-0 xl:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Top 10 mặt hàng xuất nhiều nhất</CardTitle>
            <CardDescription>Theo giá trị xuất 30 ngày</CardDescription>
          </CardHeader>
          {data.topIssued.length === 0 ? (
            <EmptyState compact title="Chưa có phiếu xuất trong 30 ngày" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="text-xs uppercase">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Mặt hàng</TableHead>
                    <TableHead className="text-right">Giá trị</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topIssued.map((t, i) => (
                    <TableRow key={t.productId}>
                      <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                      <TableCell>
                        <Link href={routeTo.stockCard(t.productId)} className="hover:text-primary line-clamp-1 text-sm font-medium underline-offset-4 hover:underline">
                          {t.name}
                        </Link>
                        <span className="text-muted-foreground text-xs">
                          <span className="font-mono">{t.code}</span> · {formatNumber(t.quantity, 0)} {t.baseUnit.toLowerCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium whitespace-nowrap tabular-nums">{formatVnd(t.value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

function AlertCard({
  href,
  label,
  value,
  tone,
  icon: Icon,
  compact,
}: {
  href: string
  label: string
  value: number
  tone: 'warning' | 'danger' | 'info'
  icon: typeof AlertTriangle
  compact?: boolean
}) {
  const color = { warning: 'text-warning', danger: 'text-destructive', info: 'text-info' }[tone]
  return (
    <Link href={href} className={cn(cardLink, compact && 'p-4')}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <Icon className={cn('size-5', color)} aria-hidden="true" />
      </div>
      <p className={cn('mt-1 font-semibold tabular-nums', compact ? 'text-xl' : 'text-2xl', value > 0 && color)}>
        {formatNumber(value, 0)} <span className="text-muted-foreground text-sm font-normal">dòng hàng × kho</span>
      </p>
      {!compact && <p className="text-muted-foreground mt-1 text-xs">Khả dụng ≤ tồn tối thiểu; bấm để xem đề xuất nhập, chuyển kho</p>}
    </Link>
  )
}
