'use client'

import Link from 'next/link'
import {
  ArrowLeftRight,
  ArrowRight,
  ClipboardList,
  FilePen,
  Hourglass,
  PackageMinus,
  PackagePlus,
  RefreshCw,
  Truck,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { lateTransferLabel } from '@/config/inventory-labels'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { docPath } from '@/features/inventory/lib/links'
import { usePermissions } from '@/hooks/use-permissions'
import { formatDateTime, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StaffTodo, TodoDoc } from '@/types/inventory'
import { useStaffTodo } from '../hooks/use-reports'

/**
 * SCR-01 Việc cần làm của thủ kho (UC-12 1a, FR-03; 07 §4.6): phiếu nháp, bị từ chối (lý do, người, giờ), chờ nhận
 * (nhãn Trễ), đang đếm kiểm kê, đang chờ duyệt của mình; tại kho được gán; không có số tiền.
 */
export function StaffTodoView({ header }: { header: React.ReactNode }) {
  const { can } = usePermissions()
  const todo = useStaffTodo()
  const data = todo.data

  const actions = [
    { show: can(permissions.goodsReceipts.create), href: routePath.goodsReceiptNew, label: 'Lập phiếu nhập', icon: PackagePlus },
    { show: can(permissions.goodsIssues.create), href: routePath.goodsIssueNew, label: 'Lập phiếu xuất', icon: PackageMinus },
    { show: can(permissions.transfers.create), href: routePath.transferNew, label: 'Lập phiếu chuyển', icon: ArrowLeftRight },
  ].filter((a) => a.show)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {header}
        <Button variant="outline" onClick={() => void todo.refetch()} disabled={todo.isFetching}>
          <RefreshCw className={cn(todo.isFetching && 'animate-spin')} aria-hidden="true" />
          Làm mới
        </Button>
      </div>

      {data && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Kho bạn phụ trách:</span>
          {data.warehouses.length ? (
            data.warehouses.map((w) => (
              <Badge key={w.id} variant="outline" className="h-7 gap-1.5 px-2.5 font-normal">
                <span className="font-mono font-semibold">{w.code}</span> {w.name}
              </Badge>
            ))
          ) : (
            <span className="text-warning">Chưa được gán kho nào, liên hệ quản lý kho</span>
          )}
        </div>
      )}

      {actions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {actions.map((a) => (
            <Button key={a.href} asChild variant="outline" className="h-14 justify-start gap-3 text-base">
              <Link href={a.href}>
                <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                  <a.icon className="size-5" aria-hidden="true" />
                </span>
                {a.label}
              </Link>
            </Button>
          ))}
        </div>
      )}

      {todo.error && !data ? (
        <ErrorState error={todo.error} onRetry={() => void todo.refetch()} />
      ) : !data ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : (
        <TodoBlocks data={data} />
      )}
    </div>
  )
}

function TodoBlocks({ data }: { data: StaffTodo }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Block title="Phiếu bị từ chối" icon={XCircle} tone="danger" count={data.rejected.length} empty="Không có phiếu bị từ chối">
        {data.rejected.map((d) => (
          <DocItem key={d.id} doc={d}>
            <p className="bg-destructive/5 border-destructive/20 mt-1.5 rounded-md border px-2.5 py-1.5 text-sm">
              <span className="font-medium">Lý do: </span>
              {d.rejectReason}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {d.rejectedByName} từ chối lúc {formatDateTime(d.rejectedAt)} · sửa rồi gửi lại
            </p>
          </DocItem>
        ))}
      </Block>
      <Block title="Hàng chuyển đến chờ nhận" icon={Truck} tone="info" count={data.toReceive.length} empty="Không có phiếu chuyển nào đang đến kho của bạn">
        {data.toReceive.map((d) => (
          <DocItem
            key={d.id}
            doc={d}
            badge={d.isLate ? <StatusBadge tone="danger">{lateTransferLabel}</StatusBadge> : undefined}
          >
            <p className="text-muted-foreground mt-1 text-xs">
              Từ {d.fromWarehouseCode} · xuất kho {formatRelativeTime(d.approvedAt)} ({formatDateTime(d.approvedAt)}) · bấm để xác nhận nhận hàng
            </p>
          </DocItem>
        ))}
      </Block>
      <Block title="Phiếu nháp" icon={FilePen} tone="neutral" count={data.drafts.length} empty="Không có phiếu nháp">
        {data.drafts.map((d) => (
          <DocItem key={d.id} doc={d}>
            <p className="text-muted-foreground mt-1 text-xs">Sửa lần cuối {formatRelativeTime(d.updatedAt)} · chưa gửi duyệt</p>
          </DocItem>
        ))}
      </Block>
      <Block title="Kiểm kê đang đếm" icon={ClipboardList} tone="primary" count={data.counting.length} empty="Không có phiếu kiểm kê đang đếm">
        {data.counting.map((d) => (
          <DocItem key={d.id} doc={d}>
            <div className="mt-1.5 flex items-center gap-3">
              <Progress value={d.totalLines ? (d.countedLines * 100) / d.totalLines : 0} className="h-2 flex-1" aria-label="Tiến độ đếm" />
              <span className="text-muted-foreground text-xs tabular-nums">
                {d.countedLines}/{d.totalLines} dòng · người đếm {d.counterName}
              </span>
            </div>
          </DocItem>
        ))}
      </Block>
      <Block
        title="Phiếu của tôi đang chờ duyệt"
        icon={Hourglass}
        tone="warning"
        count={data.waiting.length}
        empty="Không có phiếu nào đang chờ duyệt"
        className="lg:col-span-2"
      >
        {data.waiting.map((d) => (
          <DocItem key={d.id} doc={d}>
            <p className="text-muted-foreground mt-1 text-xs">Lập {formatDateTime(d.createdAt)} · chờ quản lý duyệt</p>
          </DocItem>
        ))}
      </Block>
    </div>
  )
}

const TONE_ICON: Record<string, string> = {
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-warning/12 text-warning',
}

function Block({
  title,
  icon: Icon,
  tone,
  count,
  empty,
  className,
  children,
}: {
  title: string
  icon: LucideIcon
  tone: keyof typeof TONE_ICON
  count: number
  empty: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card className={cn('gap-3', className)}>
      <CardHeader className="flex flex-row items-center gap-3">
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', TONE_ICON[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <CardTitle className="text-base">{title}</CardTitle>
        <span
          className={cn(
            'ml-auto rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums',
            count > 0 ? TONE_ICON[tone] : 'bg-muted text-muted-foreground'
          )}
        >
          {count}
        </span>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="text-muted-foreground bg-muted/40 rounded-lg px-3 py-4 text-center text-sm">{empty}</p>
        ) : (
          <ul className="divide-y rounded-lg border">{children}</ul>
        )}
      </CardContent>
    </Card>
  )
}

function DocItem({ doc, badge, children }: { doc: TodoDoc; badge?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li>
      <Link
        href={docPath(doc.kind, doc.id)}
        className="hover:bg-muted/50 focus-visible:ring-ring/50 group flex min-h-14 items-start gap-3 px-3 py-3 outline-none focus-visible:ring-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-sm font-semibold">{doc.code ?? 'Nháp chưa có mã'}</span>
            <span className="text-sm">{doc.typeText}</span>
            {badge}
          </div>
          <p className="text-muted-foreground text-xs">
            Kho {doc.warehouseCode}
            {/* Hàng chờ nhận: warehouseCode đã là kho đến (07 §5 #44), kho đi ghi ở dòng "Từ …" */}
            {doc.toWarehouseCode && doc.toWarehouseCode !== doc.warehouseCode ? ` → ${doc.toWarehouseCode}` : ''} · {doc.lineCount} dòng
          </p>
          {children}
        </div>
        <ArrowRight
          className="text-muted-foreground group-hover:text-primary mt-1 size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </li>
  )
}
