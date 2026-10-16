'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Ban, Check, ClipboardCheck, Printer, Send, Tablet, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { permissions } from '@/config/permissions'
import { routePath, routeTo } from '@/config/route-path'
import { DocStatusBadge } from '@/features/inventory/components/DocStatusBadge'
import {
  DocPageHeader,
  DocTimeline,
  SelfApprovalHint,
  SideCard,
  toastApproved,
  toastSubmitted,
  useDemoRoleShortcut,
} from '@/features/inventory/components/doc/DocParts'
import { handleDocError, newRequestId } from '@/features/inventory/hooks/use-doc-action'
import { useCatalog, useCatalogIndex } from '@/features/inventory/hooks/use-inventory'
import { printPath } from '@/features/inventory/lib/links'
import { errorCode, errorExtension } from '@/features/inventory/lib/problem'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { formatDateTime, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { VarianceReason } from '@/types/inventory'
import { CountingView } from '../components/CountingView'
import { ReasonsDialog, type RequiredLine } from '../components/ReasonsDialog'
import { VarianceTable } from '../components/VarianceTable'
import { useCountQueue } from '../hooks/use-count-queue'
import { useStocktake, useStocktakeMutations } from '../hooks/use-stocktakes'

type Dialog = null | 'fill' | 'approve' | 'cancel' | 'return'

/** SCR-15: đếm (tablet), gửi duyệt, duyệt, trả lại đếm lại, hủy, in biên bản kiểm kê (UC-11) */
export function StocktakeDetailPage({ id }: { id: string }) {
  const params = useSearchParams()
  const tablet = params.get('tablet') === '1'
  const { can, user } = usePermissions()
  const query = useStocktake(id)
  const doc = query.data
  const catalog = useCatalog()
  const index = useCatalogIndex(catalog.data)
  const m = useStocktakeMutations()
  const queue = useCountQueue(doc)
  const shortcut = useDemoRoleShortcut()

  const [dialog, setDialog] = useState<Dialog>(null)
  const [rid, setRid] = useState(newRequestId)
  const [filter, setFilter] = useState<'all' | 'uncounted' | 'recount' | 'counted'>('all')
  const [highlight, setHighlight] = useState<Set<string>>(new Set())
  const [required, setRequired] = useState<RequiredLine[] | null>(null)
  const [noteErrors, setNoteErrors] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [returnNote, setReturnNote] = useState('')
  const [returnErrors, setReturnErrors] = useState<Record<string, string>>({})

  const reload = () => void query.refetch()
  const isCounter = !!doc && !!user && doc.counterId === user.id
  const counting = doc?.status === 'DangKiem' && can(permissions.stocktakes.count)
  const canApprove = doc?.status === 'ChoDuyet' && can(permissions.stocktakes.approve)
  const canCancel = !!doc && (doc.status === 'DangKiem' || doc.status === 'ChoDuyet') && can(permissions.stocktakes.cancel)
  const path = routeTo.stocktake(id)

  const act = async (action: 'fillUncounted' | 'approve' | 'cancel') => {
    if (!doc) return
    try {
      const next = await m.action.mutateAsync({ id: doc.id, action, input: { version: doc.version, clientRequestId: rid } })
      setRid(newRequestId())
      setDialog(null)
      if (action === 'approve') toastApproved(`Đã cân bằng ${next.code}: tồn kho cập nhật theo số đếm`, shortcut, path)
      else if (action === 'cancel') toast.success(`Đã hủy ${next.code}, mở khóa phát sinh`)
      else toast.success('Đã điền số sổ sách cho dòng chưa đếm')
    } catch (error) {
      setRid(newRequestId())
      setDialog(null)
      handleDocError(error, { reload })
      throw error
    }
  }

  const submit = (reasons: { lineId: string; reason: VarianceReason; note?: string }[] = []) => {
    if (!doc) return
    if (queue.pendingCount > 0) {
      queue.flush()
      toast.info('Đang lưu số đếm, bấm Gửi duyệt lại sau giây lát')
      return
    }
    setHighlight(new Set())
    setNoteErrors({})
    const requestId = newRequestId()
    m.submit.mutate(
      { id: doc.id, input: { version: doc.version, clientRequestId: requestId, reasons } },
      {
        onSuccess: (next) => {
          setRequired(null)
          toastSubmitted(`Đã gửi duyệt ${next.code}`, shortcut, path, isCounter && user?.roles.includes('MANAGER'))
        },
        onError: (error) => {
          const code = errorCode(error)
          if (code === 'ConDongChuaDem') {
            const ids = errorExtension<string[]>(error, 'uncountedLineIds') ?? []
            setHighlight(new Set(ids))
            setFilter('uncounted')
            const names = doc.lines.filter((l) => ids.includes(l.id)).map((l) => l.productName)
            toast.error(getErrorMessage(error), { description: names.slice(0, 5).join(', ') + (names.length > 5 ? '…' : '') })
            return
          }
          if (code === 'ThieuNguyenNhan') {
            setRequired(errorExtension<RequiredLine[]>(error, 'requiredLines') ?? [])
            return
          }
          const fields = getFieldErrors(error)
          if (Object.keys(fields).some((k) => k.startsWith('reasons'))) {
            setNoteErrors(fields)
            return
          }
          handleDocError(error, { reload })
        },
      }
    )
  }

  const returnForRecount = () => {
    if (!doc) return
    setReturnErrors({})
    m.returnForRecount.mutate(
      { id: doc.id, input: { version: doc.version, clientRequestId: rid, lineIds: [...selected], note: returnNote } },
      {
        onSuccess: (next) => {
          setRid(newRequestId())
          setDialog(null)
          setSelected(new Set())
          setReturnNote('')
          toast.success(`Đã trả lại ${next.code} để đếm lại ${selected.size} dòng`)
        },
        onError: (error) => {
          setRid(newRequestId())
          const fields = getFieldErrors(error)
          if (Object.keys(fields).length) setReturnErrors(fields)
          else {
            setDialog(null)
            handleDocError(error, { reload })
          }
        },
      }
    )
  }

  const counterIsMe = isCounter

  if (query.isError) return <ErrorState error={query.error} onRetry={reload} />
  if (!doc) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  const uncounted = doc.lines.filter((l) => l.countedQuantity == null).length
  return (
    <div className={cn('space-y-5', tablet && 'mx-auto max-w-[800px]')}>
      <DocPageHeader
        backHref={routePath.stocktakes}
        backLabel="Danh sách kiểm kê"
        title={`Kiểm kê ${doc.code}`}
        status={<DocStatusBadge kind="stocktake" status={doc.status} />}
        subtitle={`${doc.warehouseCode} · ${doc.scopeAll ? 'Toàn kho' : doc.groups.map((g) => g.name).join(', ')} · người đếm ${doc.counterName} · chốt sổ ${formatDateTime(doc.snapshotAt)}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={printPath('Stocktake', doc.id)} target="_blank" rel="noopener">
                <Printer aria-hidden="true" /> {doc.status === 'DangKiem' ? 'In danh sách đếm' : 'In biên bản'}
              </a>
            </Button>
            {counting && !tablet && (
              <Button variant="outline" onClick={() => window.open(`${path}?tablet=1`, '_blank', 'noopener')}>
                <Tablet aria-hidden="true" /> Mở chế độ tablet
              </Button>
            )}
            {canCancel && (
              <Button variant="destructive" onClick={() => setDialog('cancel')}>
                <Ban aria-hidden="true" /> Hủy phiếu
              </Button>
            )}
            {counting && (
              <>
                <Button variant="outline" onClick={() => setDialog('fill')} disabled={uncounted === 0}>
                  <ClipboardCheck aria-hidden="true" /> Điền bằng sổ sách cho dòng chưa đếm
                </Button>
                <Button onClick={() => submit()} disabled={m.submit.isPending}>
                  <Send aria-hidden="true" /> Gửi duyệt
                </Button>
              </>
            )}
            {canApprove && (
              <>
                <Button variant="outline" onClick={() => setDialog('return')} disabled={selected.size === 0}>
                  <Undo2 aria-hidden="true" /> Trả lại đếm lại{selected.size > 0 && ` (${selected.size})`}
                </Button>
                <Button onClick={() => setDialog('approve')} disabled={counterIsMe}>
                  <Check aria-hidden="true" /> Duyệt cân bằng
                </Button>
              </>
            )}
          </>
        }
      />

      {canApprove && counterIsMe && <SelfApprovalHint path={path} stocktake />}

      {counting ? (
        <div className={cn('grid gap-5', !tablet && 'xl:grid-cols-[minmax(0,1fr)_18rem]')}>
          <CountingView
            doc={doc}
            catalog={index.byId}
            lookup={index.lookup}
            queue={queue}
            highlightIds={highlight}
            filter={filter}
            onFilterChange={setFilter}
          />
          {!tablet && (
            <aside className="space-y-4">
              <SideCard title="Hướng dẫn đếm">
                <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-sm">
                  <li>Quét mã chai cộng 1 chai, quét mã thùng cộng cả thùng.</li>
                  <li>Gõ số vào ô thùng + lẻ là đặt lại tổng đã đếm.</li>
                  <li>Mặt hàng ngoài danh sách nhưng thuộc phạm vi: quét là thêm dòng.</li>
                  {doc.isBlind && <li>Màn đếm không hiện số sổ sách (kiểm kê mù).</li>}
                </ul>
              </SideCard>
              <SideCard title="Lịch sử">
                <DocTimeline
                  items={[
                    { icon: 'create', label: 'Tạo phiếu, chốt sổ sách', by: doc.createdByName, at: doc.snapshotAt },
                    doc.returnNote && { icon: 'reject', label: `Trả lại đếm lại: ${doc.returnNote}` },
                  ]}
                />
              </SideCard>
            </aside>
          )}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="min-w-0 space-y-3">
            {canApprove && <p className="text-muted-foreground text-sm">Chọn dòng nghi ngờ rồi bấm “Trả lại đếm lại”; dòng khác giữ số đã đếm.</p>}
            <VarianceTable doc={doc} selectable={canApprove} selected={selected} onSelectedChange={setSelected} />
          </section>
          <aside className="space-y-4">
            {doc.canViewValues && doc.surplusValue != null && (
              <SideCard title="Chênh lệch">
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Tổng thừa</dt>
                    <dd className="text-success font-medium tabular-nums">+{formatVnd(doc.surplusValue)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Tổng thiếu</dt>
                    <dd className="text-destructive font-medium tabular-nums">−{formatVnd(doc.shortageValue)}</dd>
                  </div>
                </dl>
              </SideCard>
            )}
            <SideCard title="Lịch sử">
              <DocTimeline
                items={[
                  { icon: 'create', label: 'Tạo phiếu, chốt sổ sách', by: doc.createdByName, at: doc.snapshotAt },
                  doc.submittedAt && { icon: 'submit', label: 'Gửi duyệt', by: doc.submittedByName, at: doc.submittedAt },
                  doc.approvedAt && { icon: 'approve', label: 'Duyệt cân bằng', by: doc.approvedByName, at: doc.approvedAt },
                  doc.cancelledAt && { icon: 'cancel', label: 'Hủy phiếu', by: doc.cancelledByName, at: doc.cancelledAt },
                ]}
              />
            </SideCard>
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={dialog === 'fill'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Điền số sổ sách cho ${uncounted} dòng chưa đếm?`}
        description="Các dòng này được coi như đếm đúng sổ sách (chênh 0). Chỉ dùng khi đã kiểm tra thực tế."
        confirmText="Điền bằng sổ sách"
        icon={ClipboardCheck}
        loading={m.action.isPending}
        onConfirm={() => act('fillUncounted')}
      />
      <ConfirmDialog
        open={dialog === 'approve'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Duyệt cân bằng ${doc.code}?`}
        description="Tồn kho từng dòng chênh lệch đặt bằng số đếm, giá vốn giữ nguyên, thẻ kho ghi dòng Điều chỉnh kiểm kê; mở khóa phát sinh."
        confirmText="Duyệt cân bằng"
        icon={Check}
        loading={m.action.isPending}
        onConfirm={() => act('approve')}
      />
      <ConfirmDialog
        open={dialog === 'cancel'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Hủy phiếu kiểm kê ${doc.code}?`}
        description="Không điều chỉnh tồn; mở khóa phát sinh của hàng trong phạm vi."
        confirmText="Hủy phiếu"
        variant="destructive"
        icon={Ban}
        loading={m.action.isPending}
        onConfirm={() => act('cancel')}
      />
      <Dialog open={dialog === 'return'} onOpenChange={(o) => !m.returnForRecount.isPending && !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trả lại đếm lại {selected.size} dòng</DialogTitle>
            <DialogDescription>Phiếu về Đang kiểm; các dòng đã chọn bị xóa số đếm, người đếm thấy ghi chú này.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="return-note">Ghi chú cho người đếm</Label>
            <Textarea
              id="return-note"
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              rows={3}
              maxLength={500}
              aria-invalid={!!returnErrors.note || undefined}
              placeholder="Ví dụ: Đếm lại kệ B3, kiểm tra thùng móp"
            />
            {(returnErrors.note || returnErrors.lineIds) && (
              <p className="text-destructive text-sm">{returnErrors.note ?? returnErrors.lineIds}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={m.returnForRecount.isPending}>
              Hủy
            </Button>
            <Button onClick={returnForRecount} disabled={m.returnForRecount.isPending || !returnNote.trim()}>
              <Undo2 aria-hidden="true" /> Trả lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReasonsDialog
        open={!!required}
        onOpenChange={(o) => !o && setRequired(null)}
        lines={required ?? []}
        pending={m.submit.isPending}
        noteErrors={noteErrors}
        onConfirm={(reasons) => submit(reasons)}
      />
    </div>
  )
}
