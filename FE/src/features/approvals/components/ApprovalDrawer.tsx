'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Check, ExternalLink, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { issueTypeLabels, receiptTypeLabels } from '@/config/inventory-labels'
import { useGoodsIssue, useGoodsIssueMutations } from '@/features/goods-issues/hooks/use-goods-issues'
import { useGoodsReceipt, useGoodsReceiptMutations } from '@/features/goods-receipts/hooks/use-goods-receipts'
import { DocLinesEditor } from '@/features/inventory/components/doc/DocLinesEditor'
import { DocLinesView } from '@/features/inventory/components/doc/DocLinesView'
import { InfoRow, SelfApprovalHint, toastApproved, useDemoRoleShortcut } from '@/features/inventory/components/doc/DocParts'
import { DocWorkflowDialogs, useDocWorkflow } from '@/features/inventory/components/doc/DocWorkflow'
import { useCatalog, useCatalogIndex, useProductGroups } from '@/features/inventory/hooks/use-inventory'
import { docPath } from '@/features/inventory/lib/links'
import { useTransfer, useTransferMutations } from '@/features/transfers/hooks/use-transfers'
import { formatDateTime, formatVnd } from '@/lib/format'
import type { ApprovalItem, DocActionRequest, RejectRequest } from '@/types/inventory'

type Doc = { id: string; version: number; code?: string }

/**
 * Ngăn kéo xem nhanh phiếu chờ duyệt (07 §4.4): chi tiết đúng loại kèm số liệu cho người duyệt (tồn hiện tại, thiếu,
 * giá vốn dự kiến), nút Duyệt, Từ chối. Kiểm kê mở màn duyệt riêng (bảng chênh lệch).
 */
export function ApprovalDrawer({ item, onClose }: { item: ApprovalItem | null; onClose: () => void }) {
  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        {item && <DrawerBody key={item.id} item={item} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}

function DrawerBody({ item, onClose }: { item: ApprovalItem; onClose: () => void }) {
  const catalog = useCatalog()
  const index = useCatalogIndex(catalog.data)
  const groups = useProductGroups()
  const groupColors = useMemo(() => new Map((groups.data ?? []).map((g) => [g.id, g.color])), [groups.data])
  const receipt = useGoodsReceipt(item.kind === 'GoodsReceipt' ? item.id : null)
  const issue = useGoodsIssue(item.kind === 'GoodsIssue' ? item.id : null)
  const transfer = useTransfer(item.kind === 'Transfer' ? item.id : null)
  const rm = useGoodsReceiptMutations()
  const im = useGoodsIssueMutations()
  const tm = useTransferMutations()
  const shortcut = useDemoRoleShortcut()

  const query = item.kind === 'GoodsReceipt' ? receipt : item.kind === 'GoodsIssue' ? issue : transfer
  const doc = query.data as Doc | undefined
  const workflow = useDocWorkflow({ doc, reload: () => void query.refetch() })

  const approveFn = (input: DocActionRequest): Promise<Doc> =>
    item.kind === 'GoodsReceipt'
      ? rm.action.mutateAsync({ id: item.id, action: 'approve', input })
      : item.kind === 'GoodsIssue'
        ? im.action.mutateAsync({ id: item.id, action: 'approve', input })
        : tm.action.mutateAsync({ id: item.id, action: 'approve', input })
  const rejectFn = (input: RejectRequest): Promise<Doc> =>
    item.kind === 'GoodsReceipt'
      ? rm.reject.mutateAsync({ id: item.id, input })
      : item.kind === 'GoodsIssue'
        ? im.reject.mutateAsync({ id: item.id, input })
        : tm.reject.mutateAsync({ id: item.id, input })
  const pending = rm.action.isPending || im.action.isPending || tm.action.isPending || rm.reject.isPending || im.reject.isPending || tm.reject.isPending

  const isStocktake = item.kind === 'Stocktake'
  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>
          {item.code} · {item.typeText}
        </SheetTitle>
        <SheetDescription>
          {item.createdByName} gửi lúc {formatDateTime(item.submittedAt)} · {item.lineCount} dòng
          {item.totalValue != null && ` · ${formatVnd(item.totalValue)}`}
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {!item.canApprove && item.blockedReason && <SelfApprovalHint path={docPath(item.kind, item.id)} stocktake={isStocktake} />}
        {isStocktake ? (
          <p className="text-muted-foreground text-sm">
            Phiếu kiểm kê duyệt ở màn riêng: bảng sổ sách, số đếm, chênh lệch sắp theo giá trị, trả lại đếm lại từng dòng.
          </p>
        ) : !query.data ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
        ) : (
          <>
            {item.kind === 'GoodsReceipt' && receipt.data && (
              <>
                <dl className="grid gap-x-6 sm:grid-cols-2">
                  <InfoRow label="Kho nhận">{receipt.data.warehouseCode}</InfoRow>
                  <InfoRow label="Loại">{receiptTypeLabels[receipt.data.type]}</InfoRow>
                  <InfoRow label="Nhà cung cấp">{receipt.data.supplierName}</InfoRow>
                  <InfoRow label="Số hóa đơn">{receipt.data.sourceDocNo}</InfoRow>
                  <InfoRow label="Chi phí mua hàng">{receipt.data.canViewValues && formatVnd(receipt.data.freightCost)}</InfoRow>
                  <InfoRow label="Giá trị nhập kho">{receipt.data.canViewValues && formatVnd(receipt.data.totalValue)}</InfoRow>
                </dl>
                <DocLinesEditor
                  kind="receipt"
                  disabled
                  lines={receipt.data.lines.map((l) => ({ key: l.id, productId: l.productId, unitId: l.unitId ?? null, quantity: l.quantity, unitPrice: l.unitPrice ?? 0 }))}
                  onChange={() => undefined}
                  catalog={catalog.data ?? []}
                  groupColors={groupColors}
                  freightCost={receipt.data.freightCost ?? 0}
                  showPrices={receipt.data.canViewValues}
                />
              </>
            )}
            {item.kind === 'GoodsIssue' && issue.data && (
              <>
                <dl className="grid gap-x-6 sm:grid-cols-2">
                  <InfoRow label="Kho xuất">{issue.data.warehouseCode}</InfoRow>
                  <InfoRow label="Loại">{issueTypeLabels[issue.data.type]}</InfoRow>
                  <InfoRow label="Người nhận">{issue.data.recipientName ?? issue.data.supplierName}</InfoRow>
                  <InfoRow label="Lý do">{issue.data.reason}</InfoRow>
                </dl>
                <DocLinesView lines={issue.data.lines} catalog={index.byId} groupColors={groupColors} canViewValues={issue.data.canViewValues} />
              </>
            )}
            {item.kind === 'Transfer' && transfer.data && (
              <>
                <dl className="grid gap-x-6 sm:grid-cols-2">
                  <InfoRow label="Kho đi">{transfer.data.fromWarehouseCode}</InfoRow>
                  <InfoRow label="Kho đến">{transfer.data.toWarehouseCode}</InfoRow>
                  <InfoRow label="Ghi chú">{transfer.data.note}</InfoRow>
                </dl>
                <DocLinesView lines={transfer.data.lines} catalog={index.byId} groupColors={groupColors} canViewValues={transfer.data.canViewValues} />
              </>
            )}
          </>
        )}
      </div>
      <SheetFooter className="flex-row flex-wrap justify-end gap-2 border-t">
        <Button variant="ghost" asChild className="mr-auto">
          <Link href={docPath(item.kind, item.id)}>
            <ExternalLink aria-hidden="true" /> Mở trang phiếu
          </Link>
        </Button>
        {!isStocktake && (
          <>
            <Button variant="outline" onClick={() => workflow.setDialog('reject')} disabled={!item.canApprove || !doc}>
              <X aria-hidden="true" /> Từ chối
            </Button>
            <Button onClick={() => workflow.setDialog('approve')} disabled={!item.canApprove || !doc}>
              <Check aria-hidden="true" /> Duyệt
            </Button>
          </>
        )}
      </SheetFooter>
      <DocWorkflowDialogs
        workflow={workflow}
        code={item.code}
        kindLabel="phiếu"
        approveDescription="Duyệt sẽ ghi sổ ngay: tồn kho, giá vốn, thẻ kho cập nhật. Không sửa được sau khi duyệt."
        pending={pending}
        onApprove={() =>
          workflow.run(approveFn, (next) => {
            workflow.setDialog(null)
            toastApproved(`Đã duyệt ${next.code}`, shortcut)
            onClose()
          })
        }
        onWithdraw={async () => undefined}
        onCancel={async () => undefined}
        onReject={(reason) =>
          void workflow.reject(rejectFn, reason, (next) => {
            toast.success(`Đã từ chối ${next.code}`)
            onClose()
          })
        }
      />
    </>
  )
}
