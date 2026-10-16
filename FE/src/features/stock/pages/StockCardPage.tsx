'use client'

import { Suspense, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpenText, CalendarX2, Printer } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ledgerDocTypeLabels } from '@/config/inventory-labels'
import { permissions } from '@/config/permissions'
import { routePath, routeTo } from '@/config/route-path'
import { WarehouseSelect } from '@/features/inventory/components/WarehouseSelect'
import { useMyWarehouses } from '@/features/inventory/hooks/use-inventory'
import { docPath } from '@/features/inventory/lib/links'
import { readQuantity } from '@/features/inventory/lib/uom'
import { DateRangeFilter } from '@/features/reports/components/DateRangeFilter'
import { Stat } from '@/features/reports/components/ReportParts'
import { detectPreset, displayDateKey, presetRange, rangeFromParams } from '@/features/reports/lib/date-range'
import { formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StockCardDto } from '@/types/inventory'
import { useStockCard } from '../hooks/use-stock'
import { useUrlParams } from '../hooks/use-url-params'

/**
 * SCR-13 Thẻ kho `/stock/[productId]?warehouseId&from&to` (UC-09, FR-25, BR-20): mặc định kho đang chọn ở trang
 * trước, 30 ngày; "Mọi kho" có cột Kho; tồn đầu kỳ, từng dòng, dòng cộng, tồn cuối; số phiếu mở phiếu gốc;
 * quản lý thấy thêm đơn giá, giá trị (BR-25); nút "In thẻ kho".
 */
export function StockCardPage({ productId }: { productId: string }) {
  return (
    <PermissionGuard permission={permissions.stockLevels.view} redirect>
      <Suspense>
        <StockCardView productId={productId} />
      </Suspense>
    </PermissionGuard>
  )
}

/** Tham số URL thẻ kho / bản in thẻ kho */
export function stockCardSearch(q: { warehouseId?: string; from: string; to: string }) {
  const s = new URLSearchParams()
  if (q.warehouseId) s.set('warehouseId', q.warehouseId)
  s.set('from', q.from)
  s.set('to', q.to)
  return s.toString()
}

function StockCardView({ productId }: { productId: string }) {
  const url = useUrlParams()
  const my = useMyWarehouses()
  const param = url.get('warehouseId')
  const valid = !!param && (my.data ?? []).some((w) => w.id === param)
  const warehouseId = valid ? param : undefined
  const range = rangeFromParams(url.get('from') ?? null, url.get('to') ?? null) ?? presetRange('30d')
  const preset = detectPreset(range)

  // Kho ngoài phạm vi trên URL: bỏ bộ lọc, không hiện số liệu kho đó (TC-06 bước 2)
  const { set } = url
  useEffect(() => {
    if (my.data && param && !valid) set({ warehouseId: undefined })
  }, [my.data, param, valid, set])

  const card = useStockCard(my.data && (!param || valid) ? { productId, warehouseId, from: range.from, to: range.to } : null)
  const data = card.data

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
            <Link href={warehouseId ? `${routePath.stock}?warehouseId=${warehouseId}` : routePath.stock}>
              <ArrowLeft aria-hidden="true" />
              Tồn kho
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BookOpenText className="text-primary size-6 shrink-0" aria-hidden="true" />
            Thẻ kho
          </h1>
          {data ? (
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-medium">{data.product.name}</span> ·{' '}
              <span className="font-mono">{data.product.code}</span> · ĐVT {data.product.baseUnit.toLowerCase()}
              {data.product.units.length > 0 && ` (${data.product.units.map((u) => u.name).join(', ')})`}
            </p>
          ) : (
            <Skeleton className="h-5 w-72" />
          )}
        </div>
        <Button asChild variant="outline" disabled={!data}>
          <a
            href={`${routeTo.printStockCard(productId)}?${stockCardSearch({ warehouseId, ...range })}&print=1`}
            target="_blank"
            rel="noopener"
          >
            <Printer aria-hidden="true" />
            In thẻ kho
          </a>
        </Button>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        <WarehouseSelect
          value={warehouseId ?? ''}
          onChange={(id) => url.set({ warehouseId: id || undefined })}
          allLabel="Mọi kho"
          className="h-11 xl:w-72"
        />
        <div className="min-w-0 flex-1">
          <DateRangeFilter
            key={`${range.from}-${range.to}`}
            preset={preset}
            value={range}
            onChange={(_, r) => url.set({ from: r.from, to: r.to })}
          />
        </div>
      </div>

      {card.error && !data ? (
        <ErrorState error={card.error} onRetry={() => void card.refetch()} />
      ) : !data ? (
        <div className="space-y-4" aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <StockCardBody data={data} fetching={card.isFetching} />
      )}
    </div>
  )
}

function StockCardBody({ data, fetching }: { data: StockCardDto; fetching: boolean }) {
  const all = !data.warehouseId
  const values = data.canViewValues
  const units = data.product.units
  const unit = data.product.baseUnit.toLowerCase()
  const q = (n: number) => formatNumber(n, 0)
  const reading = (n: number) => (units.length ? readQuantity(n, data.product.baseUnit, units) : `${q(n)} ${unit}`)
  const colCount = 6 + (all ? 1 : 0) + (values ? (all ? 4 : 5) : 0)

  return (
    <div className={cn('space-y-4 transition-opacity', fetching && 'opacity-60')}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Tồn đầu kỳ"
          value={`${q(data.opening.quantity)} ${unit}`}
          sub={values ? formatVnd(data.opening.value) : reading(data.opening.quantity)}
        />
        <Stat
          label="Tổng nhập"
          tone="success"
          value={`+${q(data.totals.inQuantity)}`}
          sub={values ? formatVnd(data.totals.inValue) : `${unit} trong kỳ`}
        />
        <Stat
          label="Tổng xuất"
          tone="destructive"
          value={`−${q(data.totals.outQuantity)}`}
          sub={values ? formatVnd(data.totals.outValue) : `${unit} trong kỳ`}
        />
        <Stat
          label="Tồn cuối kỳ"
          value={`${q(data.closing.quantity)} ${unit}`}
          sub={values ? formatVnd(data.closing.value) : reading(data.closing.quantity)}
        />
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table className={cn(values ? 'min-w-[1240px]' : 'min-w-[860px]')}>
            <TableHeader className="bg-muted/50">
              <TableRow className="text-xs uppercase">
                <TableHead className="w-36">Ngày ghi sổ</TableHead>
                <TableHead className="w-36">Số phiếu</TableHead>
                {all && <TableHead className="w-20">Kho</TableHead>}
                <TableHead>Diễn giải</TableHead>
                <TableHead className="text-right">Nhập</TableHead>
                <TableHead className="text-right">Xuất</TableHead>
                <TableHead className="text-right">Tồn</TableHead>
                {values && (
                  <>
                    <TableHead className="text-right">Đơn giá</TableHead>
                    <TableHead className="text-right">Giá trị nhập</TableHead>
                    <TableHead className="text-right">Giá trị xuất</TableHead>
                    <TableHead className="text-right">Giá trị tồn</TableHead>
                    {!all && <TableHead className="text-right">Giá vốn sau</TableHead>}
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/30 font-medium hover:bg-muted/30">
                <TableCell colSpan={all ? 4 : 3}>Tồn đầu kỳ {displayDateKey(data.from)}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right tabular-nums">{q(data.opening.quantity)}</TableCell>
                {values && (
                  <>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right tabular-nums">{formatVnd(data.opening.value)}</TableCell>
                    {!all && <TableCell />}
                  </>
                )}
              </TableRow>
              {data.lines.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={colCount}>
                    <EmptyState
                      compact
                      icon={CalendarX2}
                      title="Không có phát sinh trong kỳ"
                      description="Tồn cuối kỳ bằng tồn đầu kỳ. Chọn kỳ dài hơn để xem lịch sử."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm whitespace-nowrap tabular-nums">{formatDateTime(l.postedAt)}</TableCell>
                    <TableCell>
                      <Link
                        href={docPath(l.docKind, l.docId)}
                        className="text-primary font-mono text-sm font-medium underline-offset-4 hover:underline"
                        title={ledgerDocTypeLabels[l.docType]}
                      >
                        {l.docCode}
                      </Link>
                    </TableCell>
                    {all && <TableCell className="font-mono text-sm">{l.warehouseCode}</TableCell>}
                    <TableCell className="text-sm">{l.description}</TableCell>
                    <TableCell className="text-success text-right font-medium tabular-nums">
                      {l.inQuantity ? q(l.inQuantity) : ''}
                    </TableCell>
                    <TableCell className="text-destructive text-right font-medium tabular-nums">
                      {l.outQuantity ? q(l.outQuantity) : ''}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{q(l.balanceQuantity)}</TableCell>
                    {values && (
                      <>
                        <TableCell className="text-right tabular-nums">{formatVnd(l.unitCost)}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.inValue ? formatVnd(l.inValue) : ''}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.outValue ? formatVnd(l.outValue) : ''}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatVnd(l.balanceValue)}</TableCell>
                        {!all && <TableCell className="text-right tabular-nums">{formatVnd(l.avgCostAfter)}</TableCell>}
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
            <tfoot className="bg-muted/50 border-t font-semibold">
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={all ? 4 : 3}>Cộng phát sinh</TableCell>
                <TableCell className="text-success text-right tabular-nums">{q(data.totals.inQuantity)}</TableCell>
                <TableCell className="text-destructive text-right tabular-nums">{q(data.totals.outQuantity)}</TableCell>
                <TableCell />
                {values && (
                  <>
                    <TableCell />
                    <TableCell className="text-right tabular-nums">{formatVnd(data.totals.inValue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatVnd(data.totals.outValue)}</TableCell>
                    <TableCell />
                    {!all && <TableCell />}
                  </>
                )}
              </TableRow>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={all ? 4 : 3}>Tồn cuối kỳ {displayDateKey(data.to)}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right tabular-nums">
                  {q(data.closing.quantity)}
                  {units.length > 0 && <div className="text-muted-foreground text-xs font-normal">{reading(data.closing.quantity)}</div>}
                </TableCell>
                {values && (
                  <>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right tabular-nums">{formatVnd(data.closing.value)}</TableCell>
                    {!all && <TableCell />}
                  </>
                )}
              </TableRow>
            </tfoot>
          </Table>
        </div>
      </Card>
      <p className="text-muted-foreground text-xs">
        {all ? 'Mọi kho bạn được xem: cột Tồn là lũy kế cộng dồn các kho. ' : ''}
        Thẻ kho xếp theo thời điểm ghi sổ (lúc duyệt; chuyển đến: lúc nhận). Tồn cuối kỳ kết thúc hôm nay bằng tồn trên màn Tồn kho.
      </p>
    </div>
  )
}
