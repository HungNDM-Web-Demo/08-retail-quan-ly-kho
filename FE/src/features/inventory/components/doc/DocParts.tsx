'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Ban, CheckCircle2, Clock, FileEdit, Send, UserRoundCog, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { appConfig } from '@/config/app.config'
import { rejectReasonSuggestions } from '@/config/inventory-labels'
import { roleCodes } from '@/config/permissions'
import { useSwitchRole } from '@/features/demo/hooks/use-demo'
import { getErrorMessage } from '@/lib/api-error'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { inventoryRules } from '../../lib/rules'

/** Đầu trang chi tiết phiếu: quay lại danh sách, tiêu đề, nhãn trạng thái, nút thao tác */
export function DocPageHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  status,
  actions,
}: {
  backHref: string
  backLabel: string
  title: string
  subtitle?: React.ReactNode
  status?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <Link
        href={backHref}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {backLabel}
      </Link>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {status}
          </div>
          {subtitle && <div className="text-muted-foreground text-sm">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/** Khung lý do bị từ chối (07 §4.3, FR-03) */
export function RejectedBanner({ reason, by, at }: { reason?: string; by?: string; at?: string }) {
  if (!reason) return null
  return (
    <div role="status" className="border-destructive/30 bg-destructive/5 flex gap-3 rounded-lg border p-4">
      <XCircle className="text-destructive mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-0.5">
        <p className="text-destructive font-medium">Phiếu bị từ chối</p>
        <p className="text-sm">“{reason}”</p>
        <p className="text-muted-foreground text-xs">
          {by} · {formatDateTime(at)}
        </p>
      </div>
    </div>
  )
}

type TimelineItem = { icon: 'create' | 'submit' | 'approve' | 'reject' | 'cancel' | 'receive'; label: string; by?: string; at?: string }
const ICONS = { create: FileEdit, submit: Send, approve: CheckCircle2, reject: XCircle, cancel: Ban, receive: CheckCircle2 }

/** Dòng thời gian thao tác của phiếu */
export function DocTimeline({ items }: { items: (TimelineItem | false | '' | null | undefined)[] }) {
  const list = items.filter(Boolean) as TimelineItem[]
  return (
    <ol className="space-y-3">
      {list.map((item, i) => {
        const Icon = ICONS[item.icon]
        return (
          <li key={i} className="flex gap-3">
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full',
                item.icon === 'approve' || item.icon === 'receive'
                  ? 'bg-success/12 text-success'
                  : item.icon === 'reject'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground'
              )}
              aria-hidden="true"
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 text-sm leading-tight">
              <p className="font-medium">{item.label}</p>
              <p className="text-muted-foreground text-xs">
                {[item.by, formatDateTime(item.at, '')].filter(Boolean).join(' · ')}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Thẻ thông tin bên cạnh (tablet ngang, desktop) */
export function SideCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('bg-card rounded-xl border p-4', className)}>
      <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">{title}</h2>
      {children}
    </section>
  )
}

/** Cặp nhãn – giá trị trong phần xem phiếu */
export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-2 py-1 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{children || <span className="text-muted-foreground font-normal">—</span>}</dd>
    </div>
  )
}

/**
 * Hộp từ chối (07 §4.4): lý do bắt buộc ≥ 10 ký tự sau khi bỏ khoảng trắng, gợi ý có sẵn, đếm ký tự, khóa nút khi
 * chưa đủ. Lỗi máy chủ theo ô `reason` hiện dưới ô.
 */
export function RejectDialog({
  open,
  onOpenChange,
  docLabel,
  onConfirm,
  loading,
  serverError,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  docLabel: string
  onConfirm: (reason: string) => void
  loading?: boolean
  serverError?: string
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <RejectBody docLabel={docLabel} onCancel={() => onOpenChange(false)} onConfirm={onConfirm} loading={loading} serverError={serverError} />
      </DialogContent>
    </Dialog>
  )
}

/** Nội dung hộp từ chối: trạng thái tự đặt lại mỗi lần mở (DialogContent gỡ khi đóng) */
function RejectBody({
  docLabel,
  onCancel,
  onConfirm,
  loading,
  serverError,
}: {
  docLabel: string
  onCancel: () => void
  onConfirm: (reason: string) => void
  loading?: boolean
  serverError?: string
}) {
  const [reason, setReason] = useState('')
  const length = reason.trim().length
  const enough = length >= inventoryRules.minRejectReason
  return (
    <>
      <DialogHeader>
        <DialogTitle>Từ chối {docLabel}</DialogTitle>
        <DialogDescription>Người lập sẽ thấy lý do này để sửa phiếu và gửi lại.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="reject-reason">Lý do từ chối</Label>
        <Textarea
          id="reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          aria-invalid={!!serverError || undefined}
          placeholder="Ví dụ: Sai đơn giá so với hóa đơn, kiểm tra lại"
          autoFocus
        />
        <div className="flex items-start justify-between gap-3 text-xs">
          <span className={cn(serverError ? 'text-destructive' : 'text-muted-foreground')}>
            {serverError ?? `Tối thiểu ${inventoryRules.minRejectReason} ký tự`}
          </span>
          <span className={cn('tabular-nums', enough ? 'text-success' : 'text-muted-foreground')}>{length}/10</span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {rejectReasonSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setReason(s)}
              className="bg-muted hover:bg-accent focus-visible:ring-ring/50 min-h-8 rounded-full px-3 text-xs transition-colors outline-none focus-visible:ring-3"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Hủy
        </Button>
        <Button variant="danger" onClick={() => onConfirm(reason)} disabled={loading || !enough}>
          Từ chối phiếu
        </Button>
      </DialogFooter>
    </>
  )
}

/**
 * Lối tắt trình diễn một trình duyệt (07 §4.2): đổi vai trò bằng đúng hàm của DemoToolbar rồi mở trang `path`.
 * Chỉ dùng khi `appConfig.demoToolbar`.
 */
export function useDemoRoleShortcut() {
  const switchRole = useSwitchRole()
  const router = useRouter()
  return {
    enabled: appConfig.demoToolbar,
    pending: switchRole.isPending,
    switchTo(roleCode: string, label: string, path?: string) {
      switchRole.mutate(roleCode, {
        onSuccess: () => {
          toast.success(`Đã chuyển sang ${label}`, { description: 'Chỉ áp dụng cho tab này' })
          if (path) router.push(path)
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      })
    },
  }
}

/** Thông báo nổi sau khi gửi duyệt: nút "Đổi sang Quản lý để duyệt" (07 §4.2) */
export function toastSubmitted(
  message: string,
  shortcut: ReturnType<typeof useDemoRoleShortcut>,
  path: string,
  creatorIsManager = false
) {
  if (!shortcut.enabled) {
    toast.success(message)
    return
  }
  const target = creatorIsManager
    ? { code: roleCodes.admin, label: 'Quản trị viên' }
    : { code: roleCodes.manager, label: 'Quản lý' }
  toast.success(message, {
    duration: 10_000,
    action: { label: `Đổi sang ${target.label} để duyệt`, onClick: () => shortcut.switchTo(target.code, target.label, path) },
  })
}

/** Thông báo nổi sau khi duyệt: nút "Đổi lại Thủ kho" (07 §4.2) */
export function toastApproved(message: string, shortcut: ReturnType<typeof useDemoRoleShortcut>, path?: string) {
  if (!shortcut.enabled) {
    toast.success(message)
    return
  }
  toast.success(message, {
    duration: 10_000,
    action: { label: 'Đổi lại Thủ kho', onClick: () => shortcut.switchTo(roleCodes.staff, 'Thủ kho', path) },
  })
}

/** Ghi chú "Người duyệt phải khác người lập" kèm lối tắt đổi sang Quản trị viên (TC-16) */
export function SelfApprovalHint({ path, stocktake = false }: { path: string; stocktake?: boolean }) {
  const shortcut = useDemoRoleShortcut()
  return (
    <div className="bg-warning/10 text-warning flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-sm">
      <Clock className="size-4 shrink-0" aria-hidden="true" />
      <span className="font-medium">{stocktake ? 'Người duyệt phải khác người đếm' : 'Người duyệt phải khác người lập'}</span>
      {shortcut.enabled && (
        <button
          type="button"
          className="text-primary inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
          onClick={() => shortcut.switchTo(roleCodes.admin, 'Quản trị viên', path)}
          disabled={shortcut.pending}
        >
          <UserRoundCog className="size-3.5" aria-hidden="true" />
          Đổi sang Quản trị viên để duyệt
        </button>
      )}
    </div>
  )
}

