'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ban, Check, Loader2, Printer, RotateCcw, Save, Send, Undo2, X } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { issueTypeLabels, scrapReasonSuggestions, selectableIssueTypes } from '@/config/inventory-labels'
import { permissions } from '@/config/permissions'
import { routePath, routeTo } from '@/config/route-path'
import { useSupplierOptions } from '@/features/suppliers/hooks/use-suppliers'
import { DocStatusBadge } from '@/features/inventory/components/DocStatusBadge'
import { WarehouseSelect } from '@/features/inventory/components/WarehouseSelect'
import { DocLinesEditor, type DraftLine } from '@/features/inventory/components/doc/DocLinesEditor'
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
import { printPath } from '@/features/inventory/lib/links'
import { demoDataFile } from '@/features/inventory/mock/seed-loader'
import { usePermissions } from '@/hooks/use-permissions'
import { formatVnd } from '@/lib/format'
import type { GoodsIssueDto, IssueType, SaveGoodsIssueRequest } from '@/types/inventory'
import { useGoodsIssue, useGoodsIssueMutations } from '../hooks/use-goods-issues'

type Header = {
  warehouseId: string
  type: IssueType
  recipientName: string
  supplierId: string
  orderRef: string
  reason: string
}

const emptyHeader = (): Header => ({ warehouseId: '', type: 'XuatBan', recipientName: '', supplierId: '', orderRef: '', reason: '' })

function fromDoc(doc: GoodsIssueDto) {
  return {
    header: {
      warehouseId: doc.warehouseId,
      type: doc.type,
      recipientName: doc.recipientName ?? '',
      supplierId: doc.supplierId ?? '',
      orderRef: doc.orderRef ?? '',
      reason: doc.reason ?? '',
    },
    lines: doc.lines.map<DraftLine>((l) => ({ key: l.id, productId: l.productId, unitId: l.unitId ?? null, quantity: l.quantity, unitPrice: null })),
  }
}

/** Gợi ý người nhận theo kho (đại lý, tạp hóa trong dữ liệu mẫu) */
const recipientsOf = (warehouseCode?: string) =>
  demoDataFile.recipients.filter((r) => !warehouseCode || r.warehouse === warehouseCode).map((r) => r.name)

/** SCR-07/08: lập, xem, duyệt, in phiếu xuất (UC-04, UC-05, UC-07) */
export function GoodsIssueDetailPage({ id }: { id: string }) {
  const isNew = id === 'new'
  const router = useRouter()
  const { can, user } = usePermissions()
  const query = useGoodsIssue(isNew ? null : id)
  const doc = query.data
  const catalog = useCatalog()
  const index = useCatalogIndex(catalog.data)
  const groups = useProductGroups()
  const warehouses = useMyWarehouses()
  const m = useGoodsIssueMutations()
  const shortcut = useDemoRoleShortcut()
  const workflow = useDocWorkflow({ doc, reload: () => void query.refetch() })

  const [header, setHeader] = useState<Header>(emptyHeader)
  const [lines, setLines] = useState<DraftLine[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveRid, setSaveRid] = useState(newRequestId)

  const loadedKey = doc ? `${doc.id}:${doc.version}` : null
  const [syncedKey, setSyncedKey] = useState<string | null>(null)
  // Đang sửa dở thì không ghi đè form khi tab khác đổi phiếu: lưu sẽ gặp 409 DuLieuCu rồi mới tải lại (07 §3.8)
  const [dirty, setDirty] = useState(false)
  const [formVersion, setFormVersion] = useState<number | undefined>(undefined)
  if (doc && loadedKey !== syncedKey && (!dirty || !syncedKey)) {
    setSyncedKey(loadedKey)
    setFormVersion(doc.version)
    const next = fromDoc(doc)
    setHeader(next.header)
    setLines(next.lines)
    setErrors({})
  }

  const defaultWarehouseId = warehouses.data?.find((w) => w.isActive)?.id
  if (isNew && !header.warehouseId && defaultWarehouseId) setHeader((h) => ({ ...h, warehouseId: defaultWarehouseId }))

  const isOwner = !!doc && doc.createdById === user?.id
  const editable = isNew
    ? can(permissions.goodsIssues.create)
    : !!doc && (doc.status === 'Nhap' || doc.status === 'TuChoi') && isOwner && can(permissions.goodsIssues.update)
  const suppliers = useSupplierOptions({ enabled: editable || header.type === 'TraNhaCungCap' })
  const availability = useAvailability(editable ? header.warehouseId : null)
  const availabilityMap = useMemo(
    () => (availability.data ? new Map(availability.data.map((a) => [a.productId, a])) : undefined),
    [availability.data]
  )
  const groupColors = useMemo(() => new Map((groups.data ?? []).map((g) => [g.id, g.color])), [groups.data])
  const warehouseCode = warehouses.data?.find((w) => w.id === header.warehouseId)?.code
  const recipients = useMemo(() => recipientsOf(warehouseCode), [warehouseCode])

  const set = <K extends keyof Header>(key: K, value: Header[K]) => {
    setHeader((h) => ({ ...h, [key]: value }))
    setDirty(true)
    setErrors((e) => omitKey(e, key))
  }

  const buildRequest = (submit: boolean): SaveGoodsIssueRequest => ({
    warehouseId: header.warehouseId,
    type: header.type,
    recipientName: header.recipientName,
    supplierId: header.supplierId || null,
    orderRef: header.orderRef,
    reason: header.reason,
    lines: lines.map((l) => ({ productId: l.productId, unitId: l.unitId, quantity: l.quantity ?? 0 })),
    submit,
    clientRequestId: saveRid,
    // Phiên bản lúc nạp form (không phải bản mới nhất vừa tải lại), để hai tab cùng sửa gặp 409
    version: formVersion,
  })

  const save = (submit: boolean) => {
    setErrors({})
    m.save.mutate(
      { id: isNew ? undefined : id, input: buildRequest(submit) },
      {
        onSuccess: (saved) => {
          setSaveRid(newRequestId())
          setDirty(false)
          if (submit) {
            toastSubmitted(`Đã gửi duyệt phiếu ${saved.code}`, shortcut, routeTo.goodsIssue(saved.id), user?.roles.includes('MANAGER'))
          } else toast.success('Đã lưu nháp')
          if (isNew) router.replace(routeTo.goodsIssue(saved.id))
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
  const canApprove = !!doc && doc.status === 'ChoDuyet' && can(permissions.goodsIssues.approve)
  const selfApproval = canApprove && isOwner
  const canWithdraw = !!doc && doc.status === 'ChoDuyet' && isOwner && can(permissions.goodsIssues.update)
  const canCancel =
    !!doc && (doc.status === 'Nhap' || doc.status === 'TuChoi') && can(permissions.goodsIssues.delete) && (isOwner || can(permissions.goodsIssues.approve))
  const canReverse =
    !!doc && doc.status === 'DaDuyet' && doc.type !== 'XuatDieuChinh' && !doc.reversedById && can(permissions.goodsIssues.reverse)
  const path = isNew ? routePath.goodsIssues : routeTo.goodsIssue(id)
  const action = (name: 'approve' | 'withdraw' | 'cancel') =>
    workflow.run(
      (input) => m.action.mutateAsync({ id: doc!.id, action: name, input }),
      (next) => {
        workflow.setDialog(null)
        if (name === 'approve') toastApproved(`Đã duyệt ${next.code}`, shortcut, routeTo.goodsIssue(next.id))
        else toast.success(name === 'cancel' ? 'Đã hủy phiếu' : 'Đã rút lại, phiếu về Nháp để sửa')
      }
    )

  return (
    <div className="space-y-5">
      <DocPageHeader
        backHref={routePath.goodsIssues}
        backLabel="Danh sách phiếu xuất"
        title={isNew ? 'Phiếu xuất mới' : `Phiếu xuất ${doc?.code ?? '(nháp)'}`}
        status={doc && <DocStatusBadge kind="doc" status={doc.status} />}
        subtitle={
          doc
            ? `${doc.warehouseCode} · ${issueTypeLabels[doc.type]} · lập bởi ${doc.createdByName}`
            : 'Cột Khả dụng = tồn thực trừ phần đang chờ xuất; dòng vượt tô đỏ'
        }
        actions={
          <>
            {doc && (
              <Button variant="outline" asChild>
                <a href={printPath('GoodsIssue', doc.id)} target="_blank" rel="noopener">
                  <Printer aria-hidden="true" /> In
                </a>
              </Button>
            )}
            {canReverse && (
              <Button variant="outline" onClick={() => workflow.setDialog('reverse')}>
                <RotateCcw aria-hidden="true" /> Tạo phiếu ngược
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
            {editable && (
              <>
                <Button variant="outline" onClick={() => save(false)} disabled={busy}>
                  <Save aria-hidden="true" /> Lưu nháp
                </Button>
                <Button onClick={() => save(true)} disabled={busy || !can(permissions.goodsIssues.update)}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />} Gửi duyệt
                </Button>
              </>
            )}
          </>
        }
      />

      {selfApproval && <SelfApprovalHint path={path} />}
      {editable && doc?.reversalOfId && (
        <p className="bg-info/10 text-info rounded-lg px-3 py-2 text-sm">
          Phiếu ngược của{' '}
          <Link className="font-medium underline-offset-4 hover:underline" href={routeTo.goodsReceipt(doc.reversalOfId)}>
            {doc.reversalOfCode}
          </Link>
          : gửi duyệt để ghi sổ điều chỉnh.
        </p>
      )}
      {doc?.status === 'TuChoi' && <RejectedBanner reason={doc.rejectReason} by={doc.rejectedByName} at={doc.rejectedAt} />}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <section className="bg-card rounded-xl border p-4 sm:p-5">
            {editable ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Kho xuất" required error={errors.warehouseId}>
                  <WarehouseSelect value={header.warehouseId} onChange={(v) => set('warehouseId', v)} activeOnly className="h-10" />
                </FormField>
                <FormField htmlFor="doc-type"
                  label="Loại xuất" required error={errors.type}>
                  {header.type === 'XuatDieuChinh' ? (
                    <Input value={issueTypeLabels.XuatDieuChinh} readOnly className="h-10" />
                  ) : (
                    <Select value={header.type} onValueChange={(v) => set('type', v as IssueType)}>
                      <SelectTrigger id="doc-type" className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableIssueTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {issueTypeLabels[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
                {header.type === 'TraNhaCungCap' ? (
                  <FormField htmlFor="doc-supplier"
                  label="Nhà cung cấp nhận hàng trả" required error={errors.supplierId}>
                    <Select value={header.supplierId || undefined} onValueChange={(v) => set('supplierId', v)}>
                      <SelectTrigger id="doc-supplier" className="h-10 w-full">
                        <SelectValue placeholder="Chọn nhà cung cấp" />
                      </SelectTrigger>
                      <SelectContent>
                        {(suppliers.data ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.code} · {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                ) : (
                  <FormField label="Người nhận" required={header.type === 'XuatBan'} error={errors.recipientName}>
                    <Input
                      value={header.recipientName}
                      onChange={(e) => set('recipientName', e.target.value)}
                      list="issue-recipients"
                      className="h-10"
                      maxLength={150}
                      placeholder={header.type === 'XuatBan' ? 'Đại lý, cửa hàng nhận hàng' : 'Bộ phận, người nhận'}
                    />
                  </FormField>
                )}
                <datalist id="issue-recipients">
                  {recipients.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
                <FormField label="Số đơn hàng" error={errors.orderRef}>
                  <Input value={header.orderRef} onChange={(e) => set('orderRef', e.target.value)} className="h-10" maxLength={30} />
                </FormField>
                <FormField
                  label={header.type === 'XuatHuy' ? 'Lý do xuất hủy' : 'Lý do, ghi chú'}
                  required={header.type === 'XuatHuy' || header.type === 'XuatDieuChinh'}
                  error={errors.reason}
                  className="sm:col-span-2"
                >
                  <Input
                    value={header.reason}
                    onChange={(e) => set('reason', e.target.value)}
                    list={header.type === 'XuatHuy' ? 'scrap-reasons' : undefined}
                    className="h-10"
                    maxLength={300}
                  />
                </FormField>
                <datalist id="scrap-reasons">
                  {scrapReasonSuggestions.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>
            ) : (
              doc && (
                <dl className="grid gap-x-8 sm:grid-cols-2">
                  <InfoRow label="Kho xuất">
                    {doc.warehouseCode} · {doc.warehouseName}
                  </InfoRow>
                  <InfoRow label="Loại xuất">{issueTypeLabels[doc.type]}</InfoRow>
                  <InfoRow label={doc.type === 'TraNhaCungCap' ? 'Nhà cung cấp' : 'Người nhận'}>
                    {doc.type === 'TraNhaCungCap' ? doc.supplierName && `${doc.supplierCode} · ${doc.supplierName}` : doc.recipientName}
                  </InfoRow>
                  <InfoRow label="Số đơn hàng">{doc.orderRef}</InfoRow>
                  <InfoRow label="Lý do">{doc.reason}</InfoRow>
                  {doc.reversalOfId && (
                    <InfoRow label="Phiếu ngược của">
                      <Link className="text-primary hover:underline" href={routeTo.goodsReceipt(doc.reversalOfId)}>
                        {doc.reversalOfCode}
                      </Link>
                    </InfoRow>
                  )}
                  {doc.reversedById && (
                    <InfoRow label="Đã có phiếu ngược">
                      <Link className="text-primary hover:underline" href={routeTo.goodsReceipt(doc.reversedById)}>
                        {doc.reversedByCode ?? 'Phiếu nháp'}
                      </Link>
                    </InfoRow>
                  )}
                </dl>
              )
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold">Hàng xuất</h2>
            {editable ? (
              <DocLinesEditor
                kind="issue"
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
              doc && <DocLinesView lines={doc.lines} catalog={index.byId} groupColors={groupColors} canViewValues={doc.canViewValues} />
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {doc?.canViewValues && doc.totalValue != null && (
            <SideCard title="Giá trị xuất">
              <p className="text-2xl font-semibold tabular-nums">{formatVnd(doc.totalValue)}</p>
              <p className="text-muted-foreground text-xs">Theo giá vốn bình quân lúc duyệt</p>
            </SideCard>
          )}
          {doc && (
            <SideCard title="Lịch sử phiếu">
              <DocTimeline
                items={[
                  { icon: 'create', label: 'Lập phiếu', by: doc.createdByName, at: doc.createdAt },
                  doc.submittedAt && { icon: 'submit', label: 'Gửi duyệt, giữ chỗ tồn', at: doc.submittedAt },
                  doc.rejectedAt && { icon: 'reject', label: 'Từ chối', by: doc.rejectedByName, at: doc.rejectedAt },
                  doc.approvedAt && { icon: 'approve', label: 'Duyệt, ghi sổ', by: doc.approvedByName, at: doc.approvedAt },
                  doc.cancelledAt && { icon: 'cancel', label: 'Hủy phiếu', by: doc.cancelledByName, at: doc.cancelledAt },
                ]}
              />
            </SideCard>
          )}
        </aside>
      </div>

      <DocWorkflowDialogs
        workflow={workflow}
        code={doc?.code}
        kindLabel="phiếu xuất"
        approveDescription="Duyệt sẽ ghi sổ: trừ tồn kho theo giá vốn bình quân hiện tại, ghi thẻ kho. Không sửa được sau khi duyệt."
        reverseDescription="Tạo phiếu nhập nháp loại Nhập điều chỉnh, cùng kho, mỗi dòng theo đơn vị cơ bản, đơn giá bằng giá vốn đã xuất."
        pending={m.action.isPending || m.reject.isPending || m.reverse.isPending}
        onApprove={() => action('approve')}
        onWithdraw={() => action('withdraw')}
        onCancel={() => action('cancel')}
        onReverse={() =>
          workflow.run(
            (input) => m.reverse.mutateAsync({ id: doc!.id, input }),
            (receipt) => {
              workflow.setDialog(null)
              toast.success('Đã tạo phiếu nhập điều chỉnh nháp')
              router.push(routeTo.goodsReceipt(receipt.id))
            }
          )
        }
        onReject={(reason) =>
          void workflow.reject((input) => m.reject.mutateAsync({ id: doc!.id, input }), reason, (next) =>
            toast.success(`Đã từ chối ${next.code}`)
          )
        }
      />
    </div>
  )
}
