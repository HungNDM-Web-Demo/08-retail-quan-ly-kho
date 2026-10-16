'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Ban, Check, Loader2, PackageCheck, Printer, Save, Send, Undo2, X } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { permissions } from '@/config/permissions'
import { routePath, routeTo } from '@/config/route-path'
import { DocStatusBadge } from '@/features/inventory/components/DocStatusBadge'
import { WarehouseSelect } from '@/features/inventory/components/WarehouseSelect'
import { DocLinesEditor, newLineKey, type DraftLine } from '@/features/inventory/components/doc/DocLinesEditor'
import { DocLinesView } from '@/features/inventory/components/doc/DocLinesView'
import {
  DocPageHeader,
  DocTimeline,
  InfoRow,
  RejectedBanner,
  SelfApprovalHint,
  SideCard,
  toastApproved,
  toastSubmitted,
  useDemoRoleShortcut,
} from '@/features/inventory/components/doc/DocParts'
import { DocWorkflowDialogs, useDocWorkflow } from '@/features/inventory/components/doc/DocWorkflow'
import { handleDocError, newRequestId } from '@/features/inventory/hooks/use-doc-action'
import { omitKey } from '@/features/inventory/lib/omit'
import {
  useAvailability,
  useCatalog,
  useCatalogIndex,
  useMyWarehouses,
  useProductGroups,
} from '@/features/inventory/hooks/use-inventory'
import { parseTransferDraftParams, printPath } from '@/features/inventory/lib/links'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { formatVnd } from '@/lib/format'
import type { CatalogProduct, SaveTransferRequest } from '@/types/inventory'
import { ReceiveTransferDialog } from '../components/ReceiveTransferDialog'
import { useTransfer, useTransferMutations } from '../hooks/use-transfers'

type Header = { fromWarehouseId: string; toWarehouseId: string; note: string }

/** Đặt số lượng cơ bản vào dòng theo đơn vị lớn nhất nếu chia hết, không thì đơn vị cơ bản (07 §3.9 "Nguồn chuyển") */
function lineFromBase(product: CatalogProduct | undefined, productId: string, base: number): DraftLine {
  const big = [...(product?.units ?? [])].sort((a, b) => b.factor - a.factor)[0]
  if (big && base % big.factor === 0) return { key: newLineKey(), productId, unitId: big.id, quantity: base / big.factor, unitPrice: null }
  return { key: newLineKey(), productId, unitId: null, quantity: base, unitPrice: null }
}

/** SCR-09/10: lập, duyệt, nhận phiếu chuyển kho (UC-05, UC-06) */
export function TransferDetailPage({ id }: { id: string }) {
  const isNew = id === 'new'
  const router = useRouter()
  const params = useSearchParams()
  const { can, user } = usePermissions()
  const query = useTransfer(isNew ? null : id)
  const doc = query.data
  const catalog = useCatalog()
  const index = useCatalogIndex(catalog.data)
  const groups = useProductGroups()
  const warehouses = useMyWarehouses()
  const m = useTransferMutations()
  const shortcut = useDemoRoleShortcut()
  const workflow = useDocWorkflow({ doc, reload: () => void query.refetch() })

  const [header, setHeader] = useState<Header>({ fromWarehouseId: '', toWarehouseId: '', note: '' })
  const [lines, setLines] = useState<DraftLine[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveRid, setSaveRid] = useState(newRequestId)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveErrors, setReceiveErrors] = useState<Record<string, string>>({})
  const [receiveRid, setReceiveRid] = useState(newRequestId)

  // /transfers/new?fromWarehouseId&toWarehouseId&lines&rid: tự tạo phiếu nháp rồi mở chi tiết (UC-10, TC-25)
  const draft = useMemo(() => (isNew ? parseTransferDraftParams(new URLSearchParams(params.toString())) : null), [isNew, params])
  const draftStarted = useRef(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  useEffect(() => {
    if (!draft || draftStarted.current || !catalog.data) return
    draftStarted.current = true
    m.save.mutate(
      {
        input: {
          fromWarehouseId: draft.fromWarehouseId,
          toWarehouseId: draft.toWarehouseId,
          lines: draft.lines.map((l) => {
            const line = lineFromBase(index.byId.get(l.productId), l.productId, l.baseQuantity)
            return { productId: line.productId, unitId: line.unitId, quantity: line.quantity ?? 0 }
          }),
          clientRequestId: draft.rid ?? newRequestId(),
        },
      },
      {
        onSuccess: (created) => {
          toast.success('Đã tạo phiếu chuyển nháp từ đề xuất')
          router.replace(routeTo.transfer(created.id))
        },
        onError: (error) => setDraftError(getErrorMessage(error)),
      }
    )
  }, [draft, catalog.data, index, m.save, router])

  const loadedKey = doc ? `${doc.id}:${doc.version}` : null
  const [syncedKey, setSyncedKey] = useState<string | null>(null)
  // Đang sửa dở thì không ghi đè form khi tab khác đổi phiếu: lưu sẽ gặp 409 DuLieuCu rồi mới tải lại (07 §3.8)
  const [dirty, setDirty] = useState(false)
  const [formVersion, setFormVersion] = useState<number | undefined>(undefined)
  if (doc && loadedKey !== syncedKey && (!dirty || !syncedKey)) {
    setSyncedKey(loadedKey)
    setFormVersion(doc.version)
    setHeader({ fromWarehouseId: doc.fromWarehouseId, toWarehouseId: doc.toWarehouseId, note: doc.note ?? '' })
    setLines(doc.lines.map((l) => ({ key: l.id, productId: l.productId, unitId: l.unitId ?? null, quantity: l.quantity, unitPrice: null })))
    setErrors({})
  }

  const defaultWarehouseId = warehouses.data?.find((w) => w.isActive)?.id
  if (isNew && !draft && !header.fromWarehouseId && defaultWarehouseId) setHeader((h) => ({ ...h, fromWarehouseId: defaultWarehouseId }))

  const isOwner = !!doc && doc.createdById === user?.id
  const editable = isNew
    ? can(permissions.transfers.create)
    : !!doc && (doc.status === 'Nhap' || doc.status === 'TuChoi') && isOwner && can(permissions.transfers.update)
  const availability = useAvailability(editable ? header.fromWarehouseId : null)
  const availabilityMap = useMemo(
    () => (availability.data ? new Map(availability.data.map((a) => [a.productId, a])) : undefined),
    [availability.data]
  )
  const groupColors = useMemo(() => new Map((groups.data ?? []).map((g) => [g.id, g.color])), [groups.data])
  const myWarehouseIds = new Set((warehouses.data ?? []).map((w) => w.id))
  const set = <K extends keyof Header>(key: K, value: Header[K]) => {
    setHeader((h) => ({ ...h, [key]: value }))
    setDirty(true)
    setErrors((e) => omitKey(e, key))
  }

  const buildRequest = (submit: boolean): SaveTransferRequest => ({
    fromWarehouseId: header.fromWarehouseId,
    toWarehouseId: header.toWarehouseId,
    note: header.note,
    lines: lines.map((l) => ({ productId: l.productId, unitId: l.unitId, quantity: l.quantity ?? 0 })),
    submit,
    clientRequestId: saveRid,
    // Phiên bản lúc nạp form (không phải bản mới nhất vừa tải lại), để hai tab cùng sửa gặp 409
    version: formVersion,
  })

  const save = (submit: boolean) => {
    // Kho để trống không gửi lên: BE đọc kho là Guid, chuỗi rỗng bị chặn ở bước đọc JSON với câu chung (07 §5 #43)
    const missing: Record<string, string> = {}
    if (!header.fromWarehouseId) missing.fromWarehouseId = 'Chọn kho'
    if (!header.toWarehouseId) missing.toWarehouseId = 'Chọn kho đến'
    setErrors(missing)
    if (Object.keys(missing).length) return
    m.save.mutate(
      { id: isNew ? undefined : id, input: buildRequest(submit) },
      {
        onSuccess: (saved) => {
          setSaveRid(newRequestId())
          setDirty(false)
          if (submit) toastSubmitted(`Đã gửi duyệt phiếu ${saved.code}`, shortcut, routeTo.transfer(saved.id), user?.roles.includes('MANAGER'))
          else toast.success('Đã lưu nháp')
          if (isNew) router.replace(routeTo.transfer(saved.id))
        },
        onError: (error) => {
          const reload = () => {
            setDirty(false)
            void query.refetch()
          }
          if (handleDocError(error, { reload, onFieldErrors: setErrors })) setSaveRid(newRequestId())
        },
      }
    )
  }

  const receive = (received: Record<string, number>) => {
    if (!doc) return
    setReceiveErrors({})
    m.receive.mutate(
      {
        id: doc.id,
        input: {
          version: doc.version,
          clientRequestId: receiveRid,
          lines: doc.lines.map((l) => ({ lineId: l.id, receivedBaseQuantity: received[l.id] ?? 0 })),
        },
      },
      {
        onSuccess: (next) => {
          setReceiveRid(newRequestId())
          setReceiveOpen(false)
          toast.success(
            next.canViewValues && (next.shortageValue ?? 0) > 0
              ? `Đã nhận hàng ${next.code}, hao hụt ${formatVnd(next.shortageValue)}`
              : `Đã nhận hàng ${next.code}`
          )
        },
        onError: (error) => {
          setReceiveRid(newRequestId())
          handleDocError(error, {
            reload: () => {
              setReceiveOpen(false)
              void query.refetch()
            },
            onFieldErrors: setReceiveErrors,
          })
        },
      }
    )
  }

  if (draft && draftError) {
    return (
      <ErrorState title="Không tạo được phiếu chuyển nháp" error={new Error(draftError)} onRetry={() => router.replace(routePath.transferNew)} />
    )
  }
  if (draft) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-16">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Đang tạo phiếu chuyển nháp…
      </div>
    )
  }
  if (!isNew && query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  if (!isNew && !doc) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  const busy = m.save.isPending
  const canApprove = !!doc && doc.status === 'ChoDuyet' && can(permissions.transfers.approve)
  const selfApproval = canApprove && isOwner
  const canWithdraw = !!doc && doc.status === 'ChoDuyet' && isOwner && can(permissions.transfers.update)
  const canCancel =
    !!doc && (doc.status === 'Nhap' || doc.status === 'TuChoi') && can(permissions.transfers.delete) && (isOwner || can(permissions.transfers.approve))
  const canReceive = !!doc && doc.status === 'DangChuyen' && can(permissions.transfers.receive) && myWarehouseIds.has(doc.toWarehouseId)
  const path = isNew ? routePath.transfers : routeTo.transfer(id)
  const action = (name: 'approve' | 'withdraw' | 'cancel') =>
    workflow.run(
      (input) => m.action.mutateAsync({ id: doc!.id, action: name, input }),
      (next) => {
        workflow.setDialog(null)
        if (name === 'approve') toastApproved(`Đã duyệt ${next.code}, hàng đang chuyển`, shortcut, routeTo.transfer(next.id))
        else toast.success(name === 'cancel' ? 'Đã hủy phiếu' : 'Đã rút lại, phiếu về Nháp để sửa')
      }
    )

  return (
    <div className="space-y-5">
      <DocPageHeader
        backHref={routePath.transfers}
        backLabel="Danh sách phiếu chuyển"
        title={isNew ? 'Phiếu chuyển kho mới' : `Phiếu chuyển ${doc?.code ?? '(nháp)'}`}
        status={doc && <DocStatusBadge kind="transfer" status={doc.status} isLate={doc.isLate} />}
        subtitle={
          doc ? (
            <span className="inline-flex items-center gap-1.5">
              {doc.fromWarehouseCode} <ArrowRight className="size-3.5" aria-hidden="true" /> {doc.toWarehouseCode} · lập bởi {doc.createdByName}
            </span>
          ) : (
            'Kho đi bị trừ khi phiếu được duyệt; kho đến cộng khi xác nhận nhận hàng'
          )
        }
        actions={
          <>
            {doc && (
              <Button variant="outline" asChild>
                <a href={printPath('Transfer', doc.id)} target="_blank" rel="noopener">
                  <Printer aria-hidden="true" /> In
                </a>
              </Button>
            )}
            {canCancel && (
              <Button variant="destructive" onClick={() => workflow.setDialog('cancel')}>
                <Ban aria-hidden="true" /> Hủy phiếu
              </Button>
            )}
            {canWithdraw && (
              <Button variant="outline" onClick={() => workflow.setDialog('withdraw')}>
                <Undo2 aria-hidden="true" /> Rút lại
              </Button>
            )}
            {canApprove && (
              <>
                <Button variant="outline" onClick={() => workflow.setDialog('reject')} disabled={selfApproval}>
                  <X aria-hidden="true" /> Từ chối
                </Button>
                <Button onClick={() => workflow.setDialog('approve')} disabled={selfApproval}>
                  <Check aria-hidden="true" /> Duyệt
                </Button>
              </>
            )}
            {canReceive && (
              <Button onClick={() => setReceiveOpen(true)}>
                <PackageCheck aria-hidden="true" /> Xác nhận nhận hàng
              </Button>
            )}
            {editable && (
              <>
                <Button variant="outline" onClick={() => save(false)} disabled={busy}>
                  <Save aria-hidden="true" /> Lưu nháp
                </Button>
                <Button onClick={() => save(true)} disabled={busy || !can(permissions.transfers.update)}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />} Gửi duyệt
                </Button>
              </>
            )}
          </>
        }
      />

      {selfApproval && <SelfApprovalHint path={path} />}
      {doc?.status === 'TuChoi' && <RejectedBanner reason={doc.rejectReason} by={doc.rejectedByName} at={doc.rejectedAt} />}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <section className="bg-card rounded-xl border p-4 sm:p-5">
            {editable ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Kho đi" required error={errors.fromWarehouseId}>
                  <WarehouseSelect value={header.fromWarehouseId} onChange={(v) => set('fromWarehouseId', v)} activeOnly className="h-10" />
                </FormField>
                <FormField label="Kho đến" required error={errors.toWarehouseId}>
                  <WarehouseSelect
                    value={header.toWarehouseId}
                    onChange={(v) => set('toWarehouseId', v)}
                    source="options"
                    activeOnly
                    placeholder="Chọn kho đến"
                    invalid={!!errors.toWarehouseId}
                    className="h-10"
                  />
                </FormField>
                <FormField label="Ghi chú" error={errors.note}>
                  <Textarea value={header.note} onChange={(e) => set('note', e.target.value)} rows={1} maxLength={500} className="min-h-10" />
                </FormField>
              </div>
            ) : (
              doc && (
                <dl className="grid gap-x-8 sm:grid-cols-2">
                  <InfoRow label="Kho đi">
                    {doc.fromWarehouseCode} · {doc.fromWarehouseName}
                  </InfoRow>
                  <InfoRow label="Kho đến">
                    {doc.toWarehouseCode} · {doc.toWarehouseName}
                  </InfoRow>
                  <InfoRow label="Ghi chú">{doc.note}</InfoRow>
                </dl>
              )
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold">Hàng chuyển</h2>
            {editable ? (
              <DocLinesEditor
                kind="transfer"
                lines={lines}
                onChange={(next) => {
                  setLines(next)
                  setDirty(true)
                  if (errors.lines) setErrors((e) => omitKey(e, 'lines'))
                }}
                catalog={catalog.data ?? []}
                groupColors={groupColors}
                availability={availabilityMap}
                errors={errors}
                autoFocus={isNew}
              />
            ) : (
              doc && (
                <DocLinesView
                  lines={doc.lines}
                  catalog={index.byId}
                  groupColors={groupColors}
                  canViewValues={doc.canViewValues}
                  received={doc.status === 'DaNhan'}
                />
              )
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {doc?.canViewValues && doc.totalValue != null && (
            <SideCard title="Giá trị chuyển">
              <p className="text-2xl font-semibold tabular-nums">{formatVnd(doc.totalValue)}</p>
              <p className="text-muted-foreground text-xs">Theo giá vốn kho đi lúc duyệt</p>
              {(doc.shortageValue ?? 0) > 0 && (
                <p className="text-destructive mt-2 text-sm font-medium">Hao hụt vận chuyển: {formatVnd(doc.shortageValue)}</p>
              )}
            </SideCard>
          )}
          {doc && (
            <SideCard title="Lịch sử phiếu">
              <DocTimeline
                items={[
                  { icon: 'create', label: 'Lập phiếu', by: doc.createdByName, at: doc.createdAt },
                  doc.submittedAt && { icon: 'submit', label: 'Gửi duyệt, giữ chỗ tồn kho đi', at: doc.submittedAt },
                  doc.rejectedAt && { icon: 'reject', label: 'Từ chối', by: doc.rejectedByName, at: doc.rejectedAt },
                  doc.approvedAt && { icon: 'approve', label: 'Duyệt, xuất khỏi kho đi', by: doc.approvedByName, at: doc.approvedAt },
                  doc.receivedAt && { icon: 'receive', label: 'Nhận hàng tại kho đến', by: doc.receivedByName, at: doc.receivedAt },
                  doc.cancelledAt && { icon: 'cancel', label: 'Hủy phiếu', by: doc.cancelledByName, at: doc.cancelledAt },
                ]}
              />
            </SideCard>
          )}
        </aside>
      </div>

      {doc && (
        <ReceiveTransferDialog
          open={receiveOpen}
          onOpenChange={setReceiveOpen}
          transfer={doc}
          catalog={index.byId}
          errors={receiveErrors}
          pending={m.receive.isPending}
          onConfirm={receive}
        />
      )}
      <DocWorkflowDialogs
        workflow={workflow}
        code={doc?.code}
        kindLabel="phiếu chuyển"
        approveDescription="Duyệt sẽ trừ tồn kho đi theo giá vốn bình quân hiện tại; phiếu chuyển sang Đang chuyển chờ kho đến xác nhận."
        pending={m.action.isPending || m.reject.isPending}
        onApprove={() => action('approve')}
        onWithdraw={() => action('withdraw')}
        onCancel={() => action('cancel')}
        onReject={(reason) =>
          void workflow.reject((input) => m.reject.mutateAsync({ id: doc!.id, input }), reason, (next) => toast.success(`Đã từ chối ${next.code}`))
        }
      />
    </div>
  )
}
