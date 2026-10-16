'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, FileText, Truck } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { routeTo } from '@/config/route-path'
import { useProductGroups } from '@/features/inventory/hooks/use-inventory'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { MovementRow } from '@/types/inventory'
import { useMovementReport } from '../hooks/use-reports'
import { buildAccountingSheets } from '../lib/accounting-export'
import { displayDateKey } from '../lib/date-range'
import { excelFileName, excelSheet, type ExcelColumn } from '../lib/export-excel'
import { ExportButton, Stat, TabLoading, TabToolbar } from './ReportParts'
import type { ReportTabProps } from './report-tab'

type Totals = Omit<MovementRow, 'productId' | 'productCode' | 'productName' | 'groupId' | 'groupName' | 'baseUnit'>
const ZERO: Totals = { openingQty: 0, openingValue: 0, inQty: 0, inValue: 0, outQty: 0, outValue: 0, closingQty: 0, closingValue: 0 }
const add = (a: Totals, r: Totals): Totals => ({
  openingQty: a.openingQty + r.openingQty,
  openingValue: a.openingValue + r.openingValue,
  inQty: a.inQty + r.inQty,
  inValue: a.inValue + r.inValue,
  outQty: a.outQty + r.outQty,
  outValue: a.outValue + r.outValue,
  closingQty: a.closingQty + r.closingQty,
  closingValue: a.closingValue + r.closingValue,
})

const COLUMNS: ExcelColumn<Partial<MovementRow>>[] = [
  { header: 'Nhóm hàng', value: (r) => r.groupName, width: 24 },
  { header: 'Mã hàng', value: (r) => r.productCode, width: 14 },
  { header: 'Tên hàng', value: (r) => r.productName, width: 40 },
  { header: 'ĐVT', value: (r) => r.baseUnit, width: 8 },
  { header: 'Tồn đầu SL', value: (r) => r.openingQty, width: 12 },
  { header: 'Tồn đầu giá trị', value: (r) => r.openingValue, width: 16 },
  { header: 'Nhập SL', value: (r) => r.inQty, width: 10 },
  { header: 'Nhập giá trị', value: (r) => r.inValue, width: 16 },
  { header: 'Xuất SL', value: (r) => r.outQty, width: 10 },
  { header: 'Xuất giá trị', value: (r) => r.outValue, width: 16 },
  { header: 'Tồn cuối SL', value: (r) => r.closingQty, width: 12 },
  { header: 'Tồn cuối giá trị', value: (r) => r.closingValue, width: 16 },
]

/**
 * Tab Xuất nhập tồn (UC-13, FR-32, FR-33, BR-21): tồn đầu, nhập, xuất, tồn cuối (số lượng, giá trị) theo mặt hàng,
 * gộp theo nhóm hàng mở rộng được (2a); dòng tổng; "Hàng đang chuyển cuối kỳ" khi Tất cả kho; bấm số nhập, xuất mở
 * thẻ kho cùng kho, kỳ.
 */
export function MovementTab({ range, warehouseId, scopeText, enabled }: ReportTabProps) {
  const [groupId, setGroupId] = useState<string | undefined>()
  const groups = useProductGroups()
  const report = useMovementReport({ ...range, warehouseId, groupId }, enabled)
  const data = report.data
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const grouped = useMemo(() => {
    const map = new Map<string, { id: string; name: string; rows: MovementRow[]; totals: Totals }>()
    for (const r of data?.rows ?? []) {
      const g = map.get(r.groupId) ?? { id: r.groupId, name: r.groupName, rows: [], totals: ZERO }
      g.rows.push(r)
      g.totals = add(g.totals, r)
      map.set(r.groupId, g)
    }
    return [...map.values()]
  }, [data?.rows])

  if (report.error && !data) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!data) return <TabLoading />

  const t = data.totals
  const cardHref = (productId: string) => {
    const q = new URLSearchParams({ from: data.from, to: data.to })
    if (data.warehouseId) q.set('warehouseId', data.warehouseId)
    return `${routeTo.stockCard(productId)}?${q.toString()}`
  }
  const groupName = groups.data?.find((g) => g.id === groupId)?.name
  const filters = `Kỳ ${displayDateKey(data.from)} – ${displayDateKey(data.to)} · ${scopeText}${groupName ? ` · Nhóm ${groupName}` : ''}`
  const allCollapsed = grouped.length > 0 && grouped.every((g) => collapsed.has(g.id))
  const toggle = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Tồn đầu kỳ" value={formatVnd(t.openingValue)} sub={`${formatNumber(t.openingQty, 0)} đơn vị cơ bản`} />
        <Stat label="Nhập trong kỳ" tone="success" value={formatVnd(t.inValue)} sub="Phiếu nhập, chuyển đến, kiểm kê thừa" />
        <Stat label="Xuất trong kỳ" tone="destructive" value={formatVnd(t.outValue)} sub="Phiếu xuất, chuyển đi, kiểm kê thiếu" />
        <Stat label="Tồn cuối kỳ" value={formatVnd(t.closingValue)} sub={`${formatNumber(t.closingQty, 0)} đơn vị cơ bản`} />
      </div>

      <TabToolbar>
        <Select value={groupId ?? 'all'} onValueChange={(v) => setGroupId(v === 'all' ? undefined : v)}>
          <SelectTrigger className="w-60" aria-label="Lọc theo nhóm hàng">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi nhóm hàng</SelectItem>
            {(groups.data ?? []).map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          disabled={!grouped.length}
          onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(grouped.map((g) => g.id)))}
        >
          {allCollapsed ? <ChevronsUpDown aria-hidden="true" /> : <ChevronsDownUp aria-hidden="true" />}
          {allCollapsed ? 'Mở tất cả nhóm' : 'Chỉ xem tổng theo nhóm'}
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <ExportButton
            fileName={excelFileName('xuat nhap ton', data.from, data.to)}
            disabled={!data.rows.length}
            build={() => [
              excelSheet('Xuất nhập tồn', 'BÁO CÁO XUẤT NHẬP TỒN', filters, COLUMNS, data.rows, { productName: 'Tổng cộng', ...t }),
              ...(data.inTransit
                ? [
                    excelSheet(
                      'Hàng đang chuyển',
                      'HÀNG ĐANG CHUYỂN CUỐI KỲ',
                      filters,
                      [
                        { header: 'Mã hàng', value: (l: (typeof data.inTransit.lines)[number]) => l.productCode, width: 14 },
                        { header: 'Tên hàng', value: (l) => l.productName, width: 40 },
                        { header: 'ĐVT', value: (l) => l.baseUnit, width: 8 },
                        { header: 'Số lượng', value: (l) => l.quantity, width: 12 },
                        { header: 'Giá trị', value: (l) => l.value, width: 16 },
                      ],
                      data.inTransit.lines
                    ),
                  ]
                : []),
            ]}
          />
          <ExportButton
            label="Xuất dữ liệu kế toán"
            variant="ghost"
            fileName={excelFileName('du lieu ke toan', data.from, data.to)}
            build={() => buildAccountingSheets(range, warehouseId, scopeText)}
          />
        </div>
      </TabToolbar>

      {data.rows.length === 0 ? (
        <Card>
          <EmptyState icon={FileText} title="Không có số liệu trong kỳ" description="Kho, nhóm hàng đã chọn không có tồn và phát sinh." />
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="max-h-[70vh] overflow-auto">
            <Table className="min-w-[1180px]">
              <TableHeader className="bg-muted sticky top-0 z-10">
                <TableRow className="text-xs uppercase">
                  <TableHead rowSpan={2} className="align-bottom">
                    Mặt hàng
                  </TableHead>
                  <TableHead colSpan={2} className="border-l text-center">
                    Tồn đầu kỳ
                  </TableHead>
                  <TableHead colSpan={2} className="border-l text-center">
                    Nhập
                  </TableHead>
                  <TableHead colSpan={2} className="border-l text-center">
                    Xuất
                  </TableHead>
                  <TableHead colSpan={2} className="border-l text-center">
                    Tồn cuối kỳ
                  </TableHead>
                </TableRow>
                <TableRow className="text-xs uppercase">
                  {['openingQty', 'inQty', 'outQty', 'closingQty'].map((k) => (
                    <Fragment key={k}>
                      <TableHead className="border-l text-right">SL</TableHead>
                      <TableHead className="text-right">Giá trị</TableHead>
                    </Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map((g) => {
                  const open = !collapsed.has(g.id)
                  return (
                    <Fragment key={g.id}>
                      <TableRow className="bg-muted/40 hover:bg-muted/60 cursor-pointer font-medium" onClick={() => toggle(g.id)}>
                        <TableCell>
                          <button
                            type="button"
                            className="focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded outline-none focus-visible:ring-3"
                            aria-expanded={open}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggle(g.id)
                            }}
                          >
                            {open ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
                            {g.name}
                            <span className="text-muted-foreground text-xs font-normal">({g.rows.length} mặt hàng)</span>
                          </button>
                        </TableCell>
                        <Nums r={g.totals} />
                      </TableRow>
                      {open &&
                        g.rows.map((r) => (
                          <TableRow key={r.productId}>
                            <TableCell className="pl-9">
                              <Link href={cardHref(r.productId)} className="hover:text-primary line-clamp-1 text-sm font-medium underline-offset-4 hover:underline">
                                {r.productName}
                              </Link>
                              <span className="text-muted-foreground text-xs">
                                <span className="font-mono">{r.productCode}</span> · {r.baseUnit.toLowerCase()}
                              </span>
                            </TableCell>
                            <Nums r={r} href={cardHref(r.productId)} label={r.productName} />
                          </TableRow>
                        ))}
                    </Fragment>
                  )
                })}
              </TableBody>
              <tfoot className="bg-muted sticky bottom-0 border-t font-semibold">
                <TableRow className="hover:bg-transparent">
                  <TableCell>Tổng cộng</TableCell>
                  <Nums r={t} />
                </TableRow>
              </tfoot>
            </Table>
          </div>
        </Card>
      )}

      {data.inTransit && (
        <Card className="border-info/40 bg-info/5 gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Truck className="text-info size-5" aria-hidden="true" />
            <h3 className="font-semibold">Hàng đang chuyển cuối kỳ: {formatVnd(data.inTransit.totalValue)}</h3>
            <span className="text-muted-foreground text-sm">
              Đã xuất kho đi, chưa nhận ở kho đến; không thuộc tồn kho nào (BR-21).
            </span>
          </div>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {data.inTransit.lines.map((l) => (
              <li key={l.productId} className="flex justify-between gap-3 rounded-md border bg-card px-3 py-1.5">
                <span className="min-w-0 truncate">
                  <span className="font-mono text-xs">{l.productCode}</span> {l.productName}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatNumber(l.quantity, 0)} {l.baseUnit.toLowerCase()}, {formatVnd(l.value)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function Nums({ r, href, label }: { r: Totals; href?: string; label?: string }) {
  const q = (v: number) => formatNumber(v, 0)
  const v = (x: number) => formatNumber(x, 0)
  const link = (value: number, kind: 'nhập' | 'xuất') =>
    href && value ? (
      <Link
        href={href}
        className={cn('font-medium underline-offset-4 hover:underline', kind === 'nhập' ? 'text-success' : 'text-destructive')}
        aria-label={`Xem thẻ kho ${label}: ${kind} ${q(value)}`}
      >
        {q(value)}
      </Link>
    ) : (
      q(value)
    )
  return (
    <>
      <TableCell className="border-l text-right tabular-nums">{q(r.openingQty)}</TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">{v(r.openingValue)}</TableCell>
      <TableCell className="border-l text-right tabular-nums">{link(r.inQty, 'nhập')}</TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">{v(r.inValue)}</TableCell>
      <TableCell className="border-l text-right tabular-nums">{link(r.outQty, 'xuất')}</TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">{v(r.outValue)}</TableCell>
      <TableCell className="border-l text-right font-medium tabular-nums">{q(r.closingQty)}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">{v(r.closingValue)}</TableCell>
    </>
  )
}
