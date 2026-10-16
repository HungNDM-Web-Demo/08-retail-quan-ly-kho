'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ClipboardList, Hourglass, PackageMinus, Truck, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { issueTypeLabels, slowMovingBucketLabels, varianceReasonLabels } from '@/config/inventory-labels'
import { routeTo } from '@/config/route-path'
import { WarehouseSelect } from '@/features/inventory/components/WarehouseSelect'
import { useProductGroups } from '@/features/inventory/hooks/use-inventory'
import { formatDate, formatDateTime, formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SlowMovingBucket, SlowMovingRow, StocktakeVarianceRow, TransferLossRow } from '@/types/inventory'
import {
  useIssuesByType,
  useReceiptsBySupplier,
  useSlowMovingReport,
  useStocktakeVariances,
  useTransferLosses,
} from '../hooks/use-reports'
import { displayDateKey } from '../lib/date-range'
import { excelFileName, excelSheet } from '../lib/export-excel'
import { ExportButton, formatPercent, Stat, TabLoading, TabToolbar } from './ReportParts'
import type { ReportTabProps } from './report-tab'

const period = (r: { from: string; to: string }) => `Kỳ ${displayDateKey(r.from)} – ${displayDateKey(r.to)}`

/** Thanh tỉ trọng (kèm số %, không chỉ dựa vào màu) */
function ShareBar({ value }: { value: number }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="bg-muted h-2 w-24 overflow-hidden rounded-full" aria-hidden="true">
        <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="w-12 text-right tabular-nums">{formatPercent(value)}</span>
    </div>
  )
}

function TableCard({ children, minWidth = 860 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="overflow-x-auto">
        <Table style={{ minWidth }}>{children}</Table>
      </div>
    </Card>
  )
}

// ───────────────────────── Chậm luân chuyển (FR-34, BR-22, UC-14 bước 1–2)

const BUCKETS: SlowMovingBucket[] = ['Tu30', 'Tu60', 'Tu90']
const BUCKET_TONE = { Tu30: 'warning', Tu60: 'danger', Tu90: 'danger' } as const

export function SlowMovingTab({ warehouseId, scopeText, enabled }: Omit<ReportTabProps, 'range'>) {
  const [groupId, setGroupId] = useState<string | undefined>()
  const [bucket, setBucket] = useState<SlowMovingBucket | undefined>()
  const groups = useProductGroups()
  const report = useSlowMovingReport({ warehouseId, groupId }, enabled)
  const all = useMemo(() => report.data ?? [], [report.data])
  const stats = useMemo(
    () =>
      BUCKETS.map((b) => {
        const rows = all.filter((r) => r.bucket === b)
        return { bucket: b, count: rows.length, value: rows.reduce((s, r) => s + (r.stockValue ?? 0), 0) }
      }),
    [all]
  )
  if (report.error && !report.data) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!report.data) return <TabLoading cards={3} />
  const rows = bucket ? all.filter((r) => r.bucket === bucket) : all
  const groupName = groups.data?.find((g) => g.id === groupId)?.name
  const filters = `Tính đến hôm nay · ${scopeText}${groupName ? ` · Nhóm ${groupName}` : ''}${bucket ? ` · ${slowMovingBucketLabels[bucket]}` : ''}`

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3" role="radiogroup" aria-label="Lọc theo số ngày">
        {stats.map((s) => (
          <button
            key={s.bucket}
            type="button"
            role="radio"
            aria-checked={bucket === s.bucket}
            onClick={() => setBucket(bucket === s.bucket ? undefined : s.bucket)}
            className={cn(
              'bg-card focus-visible:ring-ring/50 rounded-xl border p-4 text-left shadow-xs transition-colors outline-none focus-visible:ring-3',
              bucket === s.bucket ? 'border-primary ring-primary/30 ring-2' : 'hover:border-primary/40'
            )}
          >
            <p className="text-muted-foreground text-sm">Không xuất {slowMovingBucketLabels[s.bucket].toLowerCase()}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatVnd(s.value)}</p>
            <p className="text-muted-foreground text-xs">{s.count} dòng hàng × kho</p>
          </button>
        ))}
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
        <span className="text-muted-foreground text-sm">
          {rows.length} dòng · lần xuất gần nhất tính xuất bán, dùng nội bộ, chuyển đi (không tính xuất hủy, trả NCC)
        </span>
        <div className="ml-auto">
          <ExportButton
            fileName={excelFileName('cham luan chuyen', new Date().toISOString().slice(0, 10))}
            disabled={!rows.length}
            build={() => [
              excelSheet('Chậm luân chuyển', 'HÀNG CHẬM LUÂN CHUYỂN', filters, [
                { header: 'Mã hàng', value: (r: SlowMovingRow) => r.productCode, width: 14 },
                { header: 'Tên hàng', value: (r) => r.productName, width: 40 },
                { header: 'Nhóm', value: (r) => r.groupName, width: 22 },
                { header: 'Kho', value: (r) => r.warehouseCode, width: 8 },
                { header: 'ĐVT', value: (r) => r.baseUnit, width: 8 },
                { header: 'Tồn', value: (r) => r.onHand, width: 10 },
                { header: 'Giá trị tồn', value: (r) => r.stockValue, width: 16 },
                { header: 'Lần xuất gần nhất', value: (r) => (r.lastIssueAt ? formatDate(r.lastIssueAt) : 'Chưa xuất'), width: 16 },
                { header: 'Nhập đầu tiên', value: (r) => (r.firstReceiptAt ? formatDate(r.firstReceiptAt) : ''), width: 14 },
                { header: 'Số ngày', value: (r) => r.daysSince, width: 10 },
                { header: 'Nhóm ngày', value: (r) => slowMovingBucketLabels[r.bucket], width: 14 },
              ], rows),
            ]}
          />
        </div>
      </TabToolbar>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Hourglass} title="Không có hàng chậm luân chuyển" description="Mọi mặt hàng còn tồn đều có xuất trong 30 ngày qua." />
        </Card>
      ) : (
        <TableCard minWidth={980}>
          <TableHeader className="bg-muted/50">
            <TableRow className="text-xs uppercase">
              <TableHead>Mặt hàng</TableHead>
              <TableHead>Kho</TableHead>
              <TableHead className="text-right">Tồn</TableHead>
              <TableHead className="text-right">Giá trị tồn</TableHead>
              <TableHead>Lần xuất gần nhất</TableHead>
              <TableHead className="text-right">Số ngày</TableHead>
              <TableHead>Nhóm</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.warehouseId}-${r.productId}`}>
                <TableCell>
                  <Link
                    href={`${routeTo.stockCard(r.productId)}?warehouseId=${r.warehouseId}`}
                    className="hover:text-primary line-clamp-1 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {r.productName}
                  </Link>
                  <span className="text-muted-foreground text-xs">
                    <span className="font-mono">{r.productCode}</span> · {r.groupName}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-sm">{r.warehouseCode}</TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {formatNumber(r.onHand, 0)} {r.baseUnit.toLowerCase()}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatVnd(r.stockValue)}</TableCell>
                <TableCell className="text-sm">
                  {r.lastIssueAt ? (
                    formatDate(r.lastIssueAt)
                  ) : (
                    <span className="text-muted-foreground">Chưa xuất · nhập đầu {formatDate(r.firstReceiptAt)}</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{r.daysSince}</TableCell>
                <TableCell>
                  <StatusBadge tone={BUCKET_TONE[r.bucket]}>{slowMovingBucketLabels[r.bucket]}</StatusBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableCard>
      )}
    </div>
  )
}

// ───────────────────────── Nhập theo nhà cung cấp (FR-35)

export function SupplierReceiptsTab({ range, warehouseId, scopeText, enabled }: ReportTabProps) {
  const report = useReceiptsBySupplier({ ...range, warehouseId }, enabled)
  const rows = report.data
  if (report.error && !rows) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!rows) return <TabLoading cards={3} />
  const total = rows.reduce(
    (s, r) => ({
      receiptCount: s.receiptCount + r.receiptCount,
      totalAmount: s.totalAmount + r.totalAmount,
      freightCost: s.freightCost + r.freightCost,
      totalValue: s.totalValue + r.totalValue,
    }),
    { receiptCount: 0, totalAmount: 0, freightCost: 0, totalValue: 0 }
  )
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Giá trị nhập kho" value={formatVnd(total.totalValue)} sub={`${total.receiptCount} phiếu mua hàng đã duyệt`} />
        <Stat label="Tiền hàng" value={formatVnd(total.totalAmount)} sub={`${rows.length} nhà cung cấp`} />
        <Stat label="Chi phí mua hàng" value={formatVnd(total.freightCost)} sub="Đã phân bổ vào giá vốn" />
      </div>
      <TabToolbar>
        <span className="text-muted-foreground text-sm">Phiếu nhập loại Mua hàng, theo ngày duyệt.</span>
        <div className="ml-auto">
          <ExportButton
            fileName={excelFileName('nhap theo nha cung cap', range.from, range.to)}
            disabled={!rows.length}
            build={() => [
              excelSheet(
                'Nhập theo NCC',
                'NHẬP THEO NHÀ CUNG CẤP',
                `${period(range)} · ${scopeText}`,
                [
                  { header: 'Mã NCC', value: (r: Partial<(typeof rows)[number]>) => r.supplierCode, width: 10 },
                  { header: 'Nhà cung cấp', value: (r) => r.supplierName, width: 44 },
                  { header: 'Số phiếu', value: (r) => r.receiptCount, width: 10 },
                  { header: 'Tiền hàng', value: (r) => r.totalAmount, width: 16 },
                  { header: 'Chi phí mua hàng', value: (r) => r.freightCost, width: 16 },
                  { header: 'Giá trị nhập kho', value: (r) => r.totalValue, width: 18 },
                  { header: 'Tỉ trọng (%)', value: (r) => r.sharePercent, width: 12, format: '0.0' },
                ],
                rows,
                { supplierName: 'Tổng cộng', ...total, sharePercent: rows.length ? 100 : 0 }
              ),
            ]}
          />
        </div>
      </TabToolbar>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="Không có phiếu mua hàng trong kỳ" />
        </Card>
      ) : (
        <TableCard>
          <TableHeader className="bg-muted/50">
            <TableRow className="text-xs uppercase">
              <TableHead>Nhà cung cấp</TableHead>
              <TableHead className="text-right">Số phiếu</TableHead>
              <TableHead className="text-right">Tiền hàng</TableHead>
              <TableHead className="text-right">Chi phí mua hàng</TableHead>
              <TableHead className="text-right">Giá trị nhập kho</TableHead>
              <TableHead className="text-right">Tỉ trọng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.supplierId}>
                <TableCell>
                  <div className="text-sm font-medium">{r.supplierName}</div>
                  <div className="text-muted-foreground font-mono text-xs">{r.supplierCode}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.receiptCount}</TableCell>
                <TableCell className="text-right tabular-nums">{formatVnd(r.totalAmount)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatVnd(r.freightCost)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatVnd(r.totalValue)}</TableCell>
                <TableCell>
                  <ShareBar value={r.sharePercent} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <tfoot className="bg-muted/50 border-t font-semibold">
            <TableRow>
              <TableCell>Tổng cộng</TableCell>
              <TableCell className="text-right tabular-nums">{total.receiptCount}</TableCell>
              <TableCell className="text-right tabular-nums">{formatVnd(total.totalAmount)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatVnd(total.freightCost)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatVnd(total.totalValue)}</TableCell>
              <TableCell className="text-right tabular-nums">100%</TableCell>
            </TableRow>
          </tfoot>
        </TableCard>
      )}
    </div>
  )
}

// ───────────────────────── Xuất theo loại (FR-35)

export function IssueTypesTab({ range, warehouseId, scopeText, enabled }: ReportTabProps) {
  const report = useIssuesByType({ ...range, warehouseId }, enabled)
  const rows = report.data
  if (report.error && !rows) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!rows) return <TabLoading cards={0} />
  const total = rows.reduce(
    (s, r) => ({ docCount: s.docCount + r.docCount, baseQuantity: s.baseQuantity + r.baseQuantity, value: s.value + r.value }),
    { docCount: 0, baseQuantity: 0, value: 0 }
  )
  return (
    <div className="space-y-4">
      <TabToolbar>
        <span className="text-muted-foreground text-sm">Phiếu xuất đã duyệt theo loại; số lượng theo đơn vị cơ bản.</span>
        <div className="ml-auto">
          <ExportButton
            fileName={excelFileName('xuat theo loai', range.from, range.to)}
            build={() => [
              excelSheet(
                'Xuất theo loại',
                'XUẤT THEO LOẠI',
                `${period(range)} · ${scopeText}`,
                [
                  { header: 'Loại xuất', value: (r: Partial<(typeof rows)[number]> & { label?: string }) => r.label ?? (r.type ? issueTypeLabels[r.type] : ''), width: 22 },
                  { header: 'Số phiếu', value: (r) => r.docCount, width: 10 },
                  { header: 'Số lượng', value: (r) => r.baseQuantity, width: 12 },
                  { header: 'Giá trị xuất', value: (r) => r.value, width: 18 },
                  { header: 'Tỉ trọng (%)', value: (r) => r.sharePercent, width: 12, format: '0.0' },
                ],
                rows,
                { label: 'Tổng cộng', ...total, sharePercent: total.value ? 100 : 0 }
              ),
            ]}
          />
        </div>
      </TabToolbar>
      <TableCard minWidth={720}>
        <TableHeader className="bg-muted/50">
          <TableRow className="text-xs uppercase">
            <TableHead>Loại xuất</TableHead>
            <TableHead className="text-right">Số phiếu</TableHead>
            <TableHead className="text-right">Số lượng</TableHead>
            <TableHead className="text-right">Giá trị xuất</TableHead>
            <TableHead className="text-right">Tỉ trọng</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.type} className={cn(r.docCount === 0 && 'text-muted-foreground')}>
              <TableCell className="flex items-center gap-2 text-sm font-medium">
                <PackageMinus className="text-muted-foreground size-4" aria-hidden="true" />
                {issueTypeLabels[r.type]}
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.docCount}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(r.baseQuantity, 0)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatVnd(r.value)}</TableCell>
              <TableCell>
                <ShareBar value={r.sharePercent} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <tfoot className="bg-muted/50 border-t font-semibold">
          <TableRow>
            <TableCell>Tổng cộng</TableCell>
            <TableCell className="text-right tabular-nums">{total.docCount}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(total.baseQuantity, 0)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatVnd(total.value)}</TableCell>
            <TableCell className="text-right tabular-nums">{total.value ? '100%' : '—'}</TableCell>
          </TableRow>
        </tfoot>
      </TableCard>
    </div>
  )
}

// ───────────────────────── Chênh lệch kiểm kê (FR-35)

export function StocktakeVariancesTab({ range, warehouseId, scopeText, enabled }: ReportTabProps) {
  const report = useStocktakeVariances({ ...range, warehouseId }, enabled)
  const rows = report.data
  if (report.error && !rows) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!rows) return <TabLoading cards={3} />
  const surplus = rows.reduce((s, r) => s + r.surplusValue, 0)
  const shortage = rows.reduce((s, r) => s + r.shortageValue, 0)
  const reasonText = (r: StocktakeVarianceRow) =>
    r.byReason.map((b) => `${b.reason ? varianceReasonLabels[b.reason] : 'Không bắt buộc'}: ${b.lineCount} dòng, ${formatVnd(b.value)}`).join('; ')
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Tổng thừa" tone="success" value={formatVnd(surplus)} sub={`${rows.length} phiếu đã cân bằng`} />
        <Stat label="Tổng thiếu" tone="destructive" value={formatVnd(shortage)} />
        <Stat label="Chênh lệch thuần" value={formatVnd(surplus - shortage)} />
      </div>
      <TabToolbar>
        <span className="text-muted-foreground text-sm">Phiếu kiểm kê Đã cân bằng theo ngày duyệt.</span>
        <div className="ml-auto">
          <ExportButton
            fileName={excelFileName('chenh lech kiem ke', range.from, range.to)}
            disabled={!rows.length}
            build={() => [
              excelSheet(
                'Chênh lệch kiểm kê',
                'CHÊNH LỆCH KIỂM KÊ',
                `${period(range)} · ${scopeText}`,
                [
                  { header: 'Số phiếu', value: (r: StocktakeVarianceRow) => r.code, width: 14 },
                  { header: 'Kho', value: (r) => r.warehouseCode, width: 8 },
                  { header: 'Ngày duyệt', value: (r) => formatDateTime(r.approvedAt), width: 18 },
                  { header: 'Số dòng', value: (r) => r.lineCount, width: 10 },
                  { header: 'Dòng chênh', value: (r) => r.varianceLineCount, width: 10 },
                  { header: 'Tổng thừa', value: (r) => r.surplusValue, width: 14 },
                  { header: 'Tổng thiếu', value: (r) => r.shortageValue, width: 14 },
                  { header: 'Chênh thuần', value: (r) => r.netValue, width: 14 },
                  { header: 'Nguyên nhân', value: (r) => reasonText(r), width: 60 },
                ],
                rows
              ),
            ]}
          />
        </div>
      </TabToolbar>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="Không có phiếu kiểm kê đã cân bằng trong kỳ" />
        </Card>
      ) : (
        <TableCard minWidth={1040}>
          <TableHeader className="bg-muted/50">
            <TableRow className="text-xs uppercase">
              <TableHead>Phiếu kiểm kê</TableHead>
              <TableHead className="text-right">Dòng chênh / tổng</TableHead>
              <TableHead className="text-right">Thừa</TableHead>
              <TableHead className="text-right">Thiếu</TableHead>
              <TableHead className="text-right">Chênh thuần</TableHead>
              <TableHead>Theo nguyên nhân</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.stocktakeId} className="align-top">
                <TableCell>
                  <Link href={routeTo.stocktake(r.stocktakeId)} className="text-primary font-mono text-sm font-medium underline-offset-4 hover:underline">
                    {r.code}
                  </Link>
                  <div className="text-muted-foreground text-xs">
                    Kho {r.warehouseCode} · duyệt {formatDateTime(r.approvedAt)}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.varianceLineCount} / {r.lineCount}
                </TableCell>
                <TableCell className="text-success text-right tabular-nums">{formatVnd(r.surplusValue)}</TableCell>
                <TableCell className="text-destructive text-right tabular-nums">{formatVnd(r.shortageValue)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatVnd(r.netValue)}</TableCell>
                <TableCell>
                  <ul className="space-y-0.5 text-sm">
                    {r.byReason.map((b) => (
                      <li key={b.reason ?? 'none'} className="flex justify-between gap-3">
                        <span>{b.reason ? varianceReasonLabels[b.reason] : <span className="text-muted-foreground">Không bắt buộc nguyên nhân</span>}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {b.lineCount} dòng · {formatVnd(b.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableCard>
      )}
    </div>
  )
}

// ───────────────────────── Hao hụt vận chuyển (FR-35)

export function TransferLossesTab({ range, scopeText, enabled }: Omit<ReportTabProps, 'warehouseId'>) {
  const [fromWarehouseId, setFrom] = useState('')
  const [toWarehouseId, setTo] = useState('')
  const report = useTransferLosses(
    { ...range, fromWarehouseId: fromWarehouseId || undefined, toWarehouseId: toWarehouseId || undefined },
    enabled
  )
  const rows = report.data
  if (report.error && !rows) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />
  if (!rows) return <TabLoading cards={3} />
  const total = rows.reduce(
    (s, r) => ({ count: s.count + r.transferCount, lines: s.lines + r.shortageLineCount, value: s.value + r.shortageValue }),
    { count: 0, lines: 0, value: 0 }
  )
  type Flat = { route: string; code: string; receivedAt: string; shortageQuantity: number; shortageValue: number }
  const flat: Flat[] = rows.flatMap((r: TransferLossRow) =>
    r.transfers.map((t) => ({ route: `${r.fromWarehouseCode} → ${r.toWarehouseCode}`, ...t }))
  )
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Giá trị hao hụt" tone="destructive" value={formatVnd(total.value)} sub={`${total.lines} dòng hàng thiếu`} />
        <Stat label="Phiếu chuyển đã nhận" value={formatNumber(total.count, 0)} sub={`${rows.length} tuyến kho`} />
        <Stat label="Phiếu có hao hụt" value={formatNumber(flat.length, 0)} />
      </div>
      <TabToolbar>
        <WarehouseSelect value={fromWarehouseId} onChange={setFrom} allLabel="Mọi kho đi" className="w-48" />
        <ArrowRight className="text-muted-foreground size-4" aria-hidden="true" />
        <WarehouseSelect value={toWarehouseId} onChange={setTo} allLabel="Mọi kho đến" className="w-48" />
        <div className="ml-auto">
          <ExportButton
            fileName={excelFileName('hao hut van chuyen', range.from, range.to)}
            disabled={!rows.length}
            build={() => [
              excelSheet(
                'Hao hụt theo tuyến',
                'HAO HỤT VẬN CHUYỂN THEO TUYẾN',
                `${period(range)} · ${scopeText}`,
                [
                  { header: 'Kho đi', value: (r: TransferLossRow) => r.fromWarehouseCode, width: 10 },
                  { header: 'Kho đến', value: (r) => r.toWarehouseCode, width: 10 },
                  { header: 'Phiếu đã nhận', value: (r) => r.transferCount, width: 14 },
                  { header: 'Dòng thiếu', value: (r) => r.shortageLineCount, width: 12 },
                  { header: 'Giá trị hao hụt', value: (r) => r.shortageValue, width: 16 },
                ],
                rows
              ),
              excelSheet(
                'Phiếu có hao hụt',
                'PHIẾU CHUYỂN CÓ HAO HỤT',
                `${period(range)} · ${scopeText}`,
                [
                  { header: 'Tuyến', value: (r: Flat) => r.route, width: 16 },
                  { header: 'Số phiếu', value: (r) => r.code, width: 14 },
                  { header: 'Ngày nhận', value: (r) => formatDateTime(r.receivedAt), width: 18 },
                  { header: 'Số lượng thiếu', value: (r) => r.shortageQuantity, width: 14 },
                  { header: 'Giá trị hao hụt', value: (r) => r.shortageValue, width: 16 },
                ],
                flat
              ),
            ]}
          />
        </div>
      </TabToolbar>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Truck} title="Không có phiếu chuyển đã nhận trong kỳ" />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => (
            <Card key={`${r.fromWarehouseCode}-${r.toWarehouseCode}`} className="gap-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-mono text-base font-semibold">
                  {r.fromWarehouseCode} → {r.toWarehouseCode}
                </h3>
                <span className={cn('font-semibold tabular-nums', r.shortageValue > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                  {formatVnd(r.shortageValue)}
                </span>
              </div>
              <p className="text-muted-foreground text-sm">
                {r.transferCount} phiếu đã nhận · {r.shortageLineCount} dòng thiếu
              </p>
              {r.transfers.length > 0 ? (
                <ul className="divide-y rounded-lg border text-sm">
                  {r.transfers.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <Link href={routeTo.transfer(t.id)} className="text-primary font-mono font-medium underline-offset-4 hover:underline">
                        {t.code}
                      </Link>
                      <span className="text-muted-foreground text-xs">nhận {formatDateTime(t.receivedAt)}</span>
                      <span className="tabular-nums">
                        thiếu {formatNumber(t.shortageQuantity, 0)} · {formatVnd(t.shortageValue)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-success text-sm">Nhận đủ mọi phiếu</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
