'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ban, Check, Loader2, Printer, RotateCcw, Save, Send, Undo2, X } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { receiptTypeLabels, selectableReceiptTypes } from '@/config/inventory-labels'
import { permissions } from '@/config/permissions'
import { routePath, routeTo } from '@/config/route-path'
import { useSupplierOptions } from '@/features/suppliers/hooks/use-suppliers'
import { DocStatusBadge } from '@/features/inventory/components/DocStatusBadge'
import { WarehouseSelect } from '@/features/inventory/components/WarehouseSelect'
import { DocLinesEditor, type DraftLine } from '@/features/inventory/components/doc/DocLinesEditor'
import {
  DocPageHeader,
  DocTimeline,
  InfoRow,
  RejectDialog,
  RejectedBanner,
  SelfApprovalHint,
  SideCard,
  toastApproved,
  toastSubmitted,
  useDemoRoleShortcut,
} from '@/features/inventory/components/doc/DocParts'
import { NumberInput } from '@/features/inventory/components/doc/NumberInput'
import { handleDocError, newRequestId } from '@/features/inventory/hooks/use-doc-action'
import { omitKey } from '@/features/inventory/lib/omit'
import { useCatalog, useMyWarehouses, useProductGroups } from '@/features/inventory/hooks/use-inventory'
import { amountInWords } from '@/features/inventory/lib/amount-in-words'
import { receiptLineTotals } from '@/features/inventory/lib/costing'
import { printPath } from '@/features/inventory/lib/links'
import { vnToday } from '@/features/inventory/lib/vn-time'
import { usePermissions } from '@/hooks/use-permissions'
import { getFieldErrors } from '@/lib/api-error'
import { formatDate, formatVnd } from '@/lib/format'
import type { GoodsReceiptDto, ReceiptType, SaveGoodsReceiptRequest } from '@/types/inventory'
import { useGoodsReceipt, useGoodsReceiptMutations } from '../hooks/use-goods-receipts'

type Header = {
  warehouseId: string
  type: ReceiptType
  supplierId: string
  delivererName: string
  sourceDocNo: string
  sourceDocDate: string
  note: string
  freightCost: number | null
}

const emptyHeader = (): Header => ({
  warehouseId: '',
  type: 'MuaHang',
  supplierId: '',
  delivererName: '',
  sourceDocNo: '',
  sourceDocDate: vnToday(),
  note: '',
  freightCost: 0,
})

function fromDoc(doc: GoodsReceiptDto): { header: Header; lines: DraftLine[] } {
  return {
    header: {
      warehouseId: doc.warehouseId,
      type: doc.type,
      supplierId: doc.supplierId ?? '',
      delivererName: doc.delivererName ?? '',
      sourceDocNo: doc.sourceDocNo ?? '',
      sourceDocDate: doc.sourceDocDate ?? '',
      note: doc.note ?? '',
      freightCost: doc.freightCost ?? 0,
    },
    lines: doc.lines.map((l) => ({
      key: l.id,
      productId: l.productId,
      unitId: l.unitId ?? null,
      quantity: l.quantity,
      unitPrice: l.unitPrice ?? 0,
    })),
  }
}

type Dialog = null | 'approve' | 'reject' | 'cancel' | 'withdraw' | 'reverse'

/** SCR-05/06: lập, sửa, gửi, xem, duyệt, in phiếu nhập (UC-03, UC-05, UC-07) */
export function GoodsReceiptDetailPage({ id }: { id: string }) {
  const isNew = id === 'new'
  const router = useRouter()
  const { can, user } = usePermissions()
  const query = useGoodsReceipt(isNew ? null : id)
  const doc = query.data
  const catalog = useCatalog()
  const groups = useProductGroups()
  const warehouses = useMyWarehouses()
  const suppliers = useSupplierOptions()
  const m = useGoodsReceiptMutations()
  const shortcut = useDemoRoleShortcut()

  const [header, setHeader] = useState<Header>(emptyHeader)
  const [lines, setLines] = useState<DraftLine[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveRid, setSaveRid] = useState(newRequestId)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [actionRid, setActionRid] = useState(newRequestId)
  const [rejectError, setRejectError] = useState<string>()

  // Nạp dữ liệu phiếu vào form khi mở hoặc khi phiếu đổi phiên bản
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

  // Phiếu mới: chọn sẵn kho đang hoạt động đầu tiên
  const defaultWarehouseId = warehouses.data?.find((w) => w.isActive)?.id
  if (isNew && !header.warehouseId && defaultWarehouseId) setHeader((h) => ({ ...h, warehouseId: defaultWarehouseId }))

  const groupColors = useMemo(() => new Map((groups.data ?? []).map((g) => [g.id, g.color])), [groups.data])
  const isOwner = !!doc && doc.createdById === user?.id
  const editable = isNew
    ? can(permissions.goodsReceipts.create)
    : !!doc && (doc.status === 'Nhap' || doc.status === 'TuChoi') && isOwner && can(permissions.goodsReceipts.update)
  const showPrices = isNew || editable || !!doc?.canViewValues
  const path = isNew ? routePath.goodsReceipts : routeTo.goodsReceipt(id)
  const set = <K extends keyof Header>(key: K, value: Header[K]) => {
    setHeader((h) => ({ ...h, [key]: value }))
    setDirty(true)
    setErrors((e) => omitKey(e, key))
  }

  const totals = useMemo(() => {
    const factor = (l: DraftLine) =>
      catalog.data?.find((p) => p.id === l.productId)?.units.find((u) => u.id === l.unitId)?.factor ?? 1
    return receiptLineTotals(
      lines.map((l) => ({ quantity: l.quantity ?? 0, unitPrice: l.unitPrice ?? 0, factor: factor(l) })),
      header.freightCost ?? 0
    )
  }, [lines, header.freightCost, catalog.data])

  const buildRequest = (submit: boolean): SaveGoodsReceiptRequest => ({
    warehouseId: header.warehouseId,
    type: header.type,
    supplierId: header.supplierId || null,
    delivererName: header.delivererName,
    sourceDocNo: header.sourceDocNo,
    sourceDocDate: header.sourceDocDate || null,
    note: header.note,
    freightCost: header.freightCost ?? 0,
    lines: lines.map((l) => ({ productId: l.productId, unitId: l.unitId, quantity: l.quantity ?? 0, unitPrice: l.unitPrice ?? 0 })),
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
            toastSubmitted(
              `Đã gửi duyệt phiếu ${saved.code}`,
              shortcut,
              routeTo.goodsReceipt(saved.id),
              user?.roles.includes('MANAGER')
            )
          } else toast.success('Đã lưu nháp')
          if (isNew) router.replace(routeTo.goodsReceipt(saved.id))
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

  const runAction = (action: 'approve' | 'cancel' | 'withdraw') =>
    new Promise<void>((resolve, reject) => {
      if (!doc) return reject()
      m.action.mutate(
        { id: doc.id, action, input: { version: doc.version, clientRequestId: actionRid } },
        {
          onSuccess: (next) => {
            setActionRid(newRequestId())
            if (action === 'approve') toastApproved(`Đã duyệt ${next.code}`, shortcut, routeTo.goodsReceipt(next.id))
            else toast.success(action === 'cancel' ? 'Đã hủy phiếu' : 'Đã rút lại, phiếu về Nháp để sửa')
            resolve()
          },
          onError: (error) => {
            setActionRid(newRequestId())
            handleDocError(error, { reload: () => void query.refetch() })
            reject(error)
          },
        }
      )
    })

  const reverse = () =>
    new Promise<void>((resolve, reject) => {
      if (!doc) return reject()
      m.reverse.mutate(
        { id: doc.id, input: { version: doc.version, clientRequestId: actionRid } },
        {
          onSuccess: (issue) => {
            setActionRid(newRequestId())
            toast.success('Đã tạo phiếu xuất điều chỉnh nháp')
            router.push(routeTo.goodsIssue(issue.id))
            resolve()
          },
          onError: (error) => {
            setActionRid(newRequestId())
            handleDocError(error, { reload: () => void query.refetch() })
            reject(error)
          },
        }
      )
    })

  const reject = (reason: string) => {
    if (!doc) return
    setRejectError(undefined)
    m.reject.mutate(
      { id: doc.id, input: { version: doc.version, clientRequestId: actionRid, reason } },
      {
        onSuccess: (next) => {
          setActionRid(newRequestId())
          setDialog(null)
          toast.success(`Đã từ chối ${next.code}`)
        },
        onError: (error) => {
          setActionRid(newRequestId())
          const field = getFieldErrors(error).reason
          if (field) setRejectError(field)
          else {
            handleDocError(error, { reload: () => void query.refetch() })
            setDialog(null)
          }
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
  const canApprove = !!doc && doc.status === 'ChoDuyet' && can(permissions.goodsReceipts.approve)
  const selfApproval = canApprove && isOwner
  const canWithdraw = !!doc && doc.status === 'ChoDuyet' && isOwner && can(permissions.goodsReceipts.update)
  const canCancel =
    !!doc &&
    (doc.status === 'Nhap' || doc.status === 'TuChoi') &&
    can(permissions.goodsReceipts.delete) &&
    (isOwner || can(permissions.goodsReceipts.approve))
  const canReverse =
    !!doc && doc.status === 'DaDuyet' && doc.type !== 'NhapDieuChinh' && !doc.reversedById && can(permissions.goodsReceipts.reverse)
  const supplierList = suppliers.data ?? []
  const title = isNew ? 'Phiếu nhập mới' : `Phiếu nhập ${doc?.code ?? '(nháp)'}`

  return (
    <div className="space-y-5">
      <DocPageHeader
        backHref={routePath.goodsReceipts}
        backLabel="Danh sách phiếu nhập"
        title={title}
        status={doc && <DocStatusBadge kind="doc" status={doc.status} />}
        subtitle={
          doc
            ? `${doc.warehouseCode} · ${receiptTypeLabels[doc.type]} · lập bởi ${doc.createdByName}`
            : 'Quét mã vạch hoặc tìm tên để thêm hàng; Enter ở ô số lượng quay về ô quét'
        }
        actions={
          <>
            {doc && (
              <Button variant="outline" asChild>
                <a href={printPath('GoodsReceipt', doc.id)} target="_blank" rel="noopener">
                  <Printer aria-hidden="true" /> In
                </a>
              </Button>
            )}
            {canReverse && (
              <Button variant="outline" onClick={() => setDialog('reverse')}>
                <RotateCcw aria-hidden="true" /> Tạo phiếu ngược
              </Button>
            )}
            {canCancel && (
              <Button variant="destructive" onClick={() => setDialog('cancel')}>
                <Ban aria-hidden="true" /> Hủy phiếu
              </Button>
            )}
            {canWithdraw && (
              <Button variant="outline" onClick={() => setDialog('withdraw')}>
                <Undo2 aria-hidden="true" /> Rút lại
              </Button>
            )}
            {canApprove && (
              <>
                <Button variant="outline" onClick={() => setDialog('reject')} disabled={selfApproval}>
                  <X aria-hidden="true" /> Từ chối
                </Button>
                <Button onClick={() => setDialog('approve')} disabled={selfApproval}>
                  <Check aria-hidden="true" /> Duyệt
                </Button>
              </>
            )}
            {editable && (
              <>
                <Button variant="outline" onClick={() => save(false)} disabled={busy}>
                  <Save aria-hidden="true" /> Lưu nháp
                </Button>
                <Button onClick={() => save(true)} disabled={busy || !can(permissions.goodsReceipts.update)}>
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
          <Link className="font-medium underline-offset-4 hover:underline" href={routeTo.goodsIssue(doc.reversalOfId)}>
            {doc.reversalOfCode}
          </Link>
          : gửi duyệt để ghi sổ điều chỉnh.
        </p>
      )}
      {doc?.status === 'TuChoi' && (
        <RejectedBanner reason={doc.rejectReason} by={doc.rejectedByName} at={doc.rejectedAt} />
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <section className="bg-card rounded-xl border p-4 sm:p-5">
            {editable ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Kho nhận" required error={errors.warehouseId}>
                  <WarehouseSelect
                    value={header.warehouseId}
                    onChange={(v) => set('warehouseId', v)}
                    activeOnly
                    invalid={!!errors.warehouseId}
                    className="h-10"
                  />
                </FormField>
                <FormField htmlFor="doc-type"
                  label="Loại nhập" required error={errors.type}>
                  {header.type === 'NhapDieuChinh' ? (
                    <Input value={receiptTypeLabels.NhapDieuChinh} readOnly className="h-10" />
                  ) : (
                    <Select value={header.type} onValueChange={(v) => set('type', v as ReceiptType)}>
                      <SelectTrigger id="doc-type" className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {selectableReceiptTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {receiptTypeLabels[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
                <FormField
                  htmlFor="doc-supplier"
                  label="Nhà cung cấp"
                  required={header.type === 'MuaHang'}
                  error={errors.supplierId}
                  hint={header.type === 'MuaHang' ? undefined : 'Không bắt buộc'}
                >
                  <Select value={header.supplierId || '__none__'} onValueChange={(v) => set('supplierId', v === '__none__' ? '' : v)}>
                    <SelectTrigger id="doc-supplier" className="h-10 w-full">
                      <SelectValue placeholder="Chọn nhà cung cấp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Chưa chọn —</SelectItem>
                      {supplierList.map((s) => (
                        <SelectItem key={s.id} value={s.id} disabled={!s.isActive}>
                          {s.code} · {s.name}
                          {!s.isActive && ' (ngừng giao dịch)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label={header.type === 'HangBanTraLai' ? 'Đơn vị trả hàng' : 'Người giao hàng'} error={errors.delivererName}>
                  <Input value={header.delivererName} onChange={(e) => set('delivererName', e.target.value)} className="h-10" maxLength={150} />
                </FormField>
                <FormField label="Số hóa đơn, chứng từ gốc" error={errors.sourceDocNo}>
                  <Input value={header.sourceDocNo} onChange={(e) => set('sourceDocNo', e.target.value)} className="h-10" maxLength={30} />
                </FormField>
                <FormField label="Ngày chứng từ" error={errors.sourceDocDate}>
                  <Input
                    type="date"
                    value={header.sourceDocDate}
                    onChange={(e) => set('sourceDocDate', e.target.value)}
                    className="h-10"
                  />
                </FormField>
                <FormField label="Chi phí mua hàng" error={errors.freightCost} hint="Vận chuyển, bốc xếp; phân bổ theo thành tiền">
                  <NumberInput
                    grouped
                    suffix="₫"
                    value={header.freightCost}
                    onValueChange={(v) => set('freightCost', v)}
                    className="h-10"
                  />
                </FormField>
                <FormField label="Ghi chú" className="sm:col-span-2" error={errors.note}>
                  <Textarea value={header.note} onChange={(e) => set('note', e.target.value)} rows={1} maxLength={500} className="min-h-10" />
                </FormField>
              </div>
            ) : (
              doc && (
                <dl className="grid gap-x-8 sm:grid-cols-2">
                  <InfoRow label="Kho nhận">
                    {doc.warehouseCode} · {doc.warehouseName}
                  </InfoRow>
                  <InfoRow label="Loại nhập">{receiptTypeLabels[doc.type]}</InfoRow>
                  <InfoRow label="Nhà cung cấp">{doc.supplierName && `${doc.supplierCode} · ${doc.supplierName}`}</InfoRow>
                  <InfoRow label="Người giao hàng">{doc.delivererName}</InfoRow>
                  <InfoRow label="Số hóa đơn">{doc.sourceDocNo}</InfoRow>
                  <InfoRow label="Ngày chứng từ">{doc.sourceDocDate && formatDate(doc.sourceDocDate)}</InfoRow>
                  {doc.reversalOfCode && (
                    <InfoRow label="Phiếu ngược của">
                      <Link className="text-primary hover:underline" href={routeTo.goodsIssue(doc.reversalOfId!)}>
                        {doc.reversalOfCode}
                      </Link>
                    </InfoRow>
                  )}
                  {doc.reversedByCode !== undefined && doc.reversedById && (
                    <InfoRow label="Đã có phiếu ngược">
                      <Link className="text-primary hover:underline" href={routeTo.goodsIssue(doc.reversedById)}>
                        {doc.reversedByCode ?? 'Phiếu nháp'}
                      </Link>
                    </InfoRow>
                  )}
                  <InfoRow label="Ghi chú">{doc.note}</InfoRow>
                </dl>
              )
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold">Hàng nhập</h2>
            <DocLinesEditor
              kind="receipt"
              lines={lines}
              onChange={(next) => {
                setLines(next)
                setDirty(true)
                if (errors.lines) setErrors((e) => omitKey(e, 'lines'))
              }}
              catalog={catalog.data ?? []}
              groupColors={groupColors}
              freightCost={header.freightCost ?? 0}
              showPrices={showPrices}
              errors={errors}
              disabled={!editable}
              autoFocus={isNew}
            />
          </section>
        </div>

        <aside className="space-y-4">
          {showPrices && (
            <SideCard title="Giá trị phiếu">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Tiền hàng</dt>
                  <dd className="tabular-nums">{formatVnd(totals.totalAmount)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Chi phí mua hàng</dt>
                  <dd className="tabular-nums">{formatVnd(header.freightCost ?? 0)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t pt-2 text-base">
                  <dt className="font-medium">Giá trị nhập kho</dt>
                  <dd className="font-semibold tabular-nums">{formatVnd(totals.totalValue)}</dd>
                </div>
                {totals.totalValue > 0 && <p className="text-muted-foreground pt-1 text-xs italic">{amountInWords(totals.totalValue)}</p>}
              </dl>
            </SideCard>
          )}
          {doc && (
            <SideCard title="Lịch sử phiếu">
              <DocTimeline
                items={[
                  { icon: 'create', label: 'Lập phiếu', by: doc.createdByName, at: doc.createdAt },
                  doc.submittedAt && { icon: 'submit', label: 'Gửi duyệt', at: doc.submittedAt },
                  doc.rejectedAt && { icon: 'reject', label: 'Từ chối', by: doc.rejectedByName, at: doc.rejectedAt },
                  doc.approvedAt && { icon: 'approve', label: 'Duyệt, ghi sổ', by: doc.approvedByName, at: doc.approvedAt },
                  doc.cancelledAt && { icon: 'cancel', label: 'Hủy phiếu', by: doc.cancelledByName, at: doc.cancelledAt },
                ]}
              />
            </SideCard>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={dialog === 'approve'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Duyệt phiếu ${doc?.code ?? ''}?`}
        description="Duyệt sẽ ghi sổ: cộng tồn kho, tính lại giá vốn bình quân, ghi thẻ kho. Không sửa được sau khi duyệt."
        confirmText="Duyệt và ghi sổ"
        icon={Check}
        loading={m.action.isPending}
        onConfirm={() => runAction('approve')}
      />
      <ConfirmDialog
        open={dialog === 'withdraw'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Rút lại phiếu để sửa?"
        description="Phiếu về Nháp, rời khỏi danh sách chờ duyệt. Gửi lại sau khi sửa."
        confirmText="Rút lại"
        icon={Undo2}
        loading={m.action.isPending}
        onConfirm={() => runAction('withdraw')}
      />
      <ConfirmDialog
        open={dialog === 'cancel'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Hủy phiếu nhập?"
        description="Phiếu đã hủy không sửa, không gửi lại được."
        confirmText="Hủy phiếu"
        variant="destructive"
        icon={Ban}
        loading={m.action.isPending}
        onConfirm={() => runAction('cancel')}
      />
      <ConfirmDialog
        open={dialog === 'reverse'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Tạo phiếu ngược của ${doc?.code ?? ''}?`}
        description="Tạo phiếu xuất nháp loại Xuất điều chỉnh, cùng kho, mỗi dòng theo đơn vị cơ bản. Gửi duyệt để trừ lại tồn."
        confirmText="Tạo phiếu ngược"
        icon={RotateCcw}
        loading={m.reverse.isPending}
        onConfirm={reverse}
      />
      <RejectDialog
        open={dialog === 'reject'}
        onOpenChange={(o) => {
          if (!o) setDialog(null)
          setRejectError(undefined)
        }}
        docLabel={`phiếu ${doc?.code ?? ''}`}
        onConfirm={reject}
        loading={m.reject.isPending}
        serverError={rejectError}
      />
    </div>
  )
}

