'use client'

import { useState } from 'react'
import { Ban, Check, RotateCcw, Undo2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { getFieldErrors } from '@/lib/api-error'
import type { DocActionRequest } from '@/types/inventory'
import { handleDocError, newRequestId } from '../../hooks/use-doc-action'
import { RejectDialog } from './DocParts'

export type DocDialog = null | 'approve' | 'reject' | 'cancel' | 'withdraw' | 'reverse'

/**
 * Thao tác trạng thái trên một phiếu có sẵn: mỗi lần mở hộp một `clientRequestId`, gửi kèm `version`; lỗi
 * `DuLieuCu`/`PhieuDaDuyet` thì báo và tải lại (07 §3.8, §4.3).
 */
export function useDocWorkflow<T extends { id: string; version: number }>({
  doc,
  reload,
}: {
  doc: T | undefined
  reload: () => void
}) {
  const [dialog, setDialog] = useState<DocDialog>(null)
  const [rid, setRid] = useState(newRequestId)
  const [rejectError, setRejectError] = useState<string>()

  /** Chạy thao tác; trả Promise để ConfirmDialog giữ trạng thái chờ */
  async function run<R>(fn: (input: DocActionRequest) => Promise<R>, onDone?: (result: R) => void): Promise<void> {
    if (!doc) return
    try {
      const result = await fn({ version: doc.version, clientRequestId: rid })
      setRid(newRequestId())
      onDone?.(result)
    } catch (error) {
      if (handleDocError(error, { reload })) setRid(newRequestId())
      setDialog(null)
      throw error
    }
  }

  async function reject<R>(fn: (input: DocActionRequest & { reason: string }) => Promise<R>, reason: string, onDone?: (r: R) => void) {
    if (!doc) return
    setRejectError(undefined)
    try {
      const result = await fn({ version: doc.version, clientRequestId: rid, reason })
      setRid(newRequestId())
      setDialog(null)
      onDone?.(result)
    } catch (error) {
      setRid(newRequestId())
      const field = getFieldErrors(error).reason
      if (field) setRejectError(field)
      else {
        handleDocError(error, { reload })
        setDialog(null)
      }
    }
  }

  return { dialog, setDialog, run, reject, rejectError, clearRejectError: () => setRejectError(undefined) }
}

/** Các hộp xác nhận dùng chung của trang chi tiết phiếu */
export function DocWorkflowDialogs({
  workflow,
  code,
  kindLabel,
  approveDescription,
  reverseDescription,
  pending,
  onApprove,
  onWithdraw,
  onCancel,
  onReverse,
  onReject,
}: {
  workflow: ReturnType<typeof useDocWorkflow>
  code?: string
  kindLabel: string
  approveDescription: string
  reverseDescription?: string
  pending: boolean
  onApprove: () => Promise<void>
  onWithdraw: () => Promise<void>
  onCancel: () => Promise<void>
  onReverse?: () => Promise<void>
  onReject: (reason: string) => void
}) {
  const { dialog, setDialog } = workflow
  const close = (o: boolean) => !o && setDialog(null)
  return (
    <>
      <ConfirmDialog
        open={dialog === 'approve'}
        onOpenChange={close}
        title={`Duyệt ${kindLabel} ${code ?? ''}?`}
        description={approveDescription}
        confirmText="Duyệt và ghi sổ"
        icon={Check}
        loading={pending}
        onConfirm={onApprove}
      />
      <ConfirmDialog
        open={dialog === 'withdraw'}
        onOpenChange={close}
        title="Rút lại phiếu để sửa?"
        description="Phiếu về Nháp, rời khỏi danh sách chờ duyệt và bỏ giữ chỗ tồn. Gửi lại sau khi sửa."
        confirmText="Rút lại"
        icon={Undo2}
        loading={pending}
        onConfirm={onWithdraw}
      />
      <ConfirmDialog
        open={dialog === 'cancel'}
        onOpenChange={close}
        title={`Hủy ${kindLabel}?`}
        description="Phiếu đã hủy không sửa, không gửi lại được."
        confirmText="Hủy phiếu"
        variant="destructive"
        icon={Ban}
        loading={pending}
        onConfirm={onCancel}
      />
      {onReverse && (
        <ConfirmDialog
          open={dialog === 'reverse'}
          onOpenChange={close}
          title={`Tạo phiếu ngược của ${code ?? ''}?`}
          description={reverseDescription}
          confirmText="Tạo phiếu ngược"
          icon={RotateCcw}
          loading={pending}
          onConfirm={onReverse}
        />
      )}
      <RejectDialog
        open={dialog === 'reject'}
        onOpenChange={(o) => {
          if (!o) setDialog(null)
          workflow.clearRejectError()
        }}
        docLabel={`${kindLabel} ${code ?? ''}`}
        onConfirm={onReject}
        loading={pending}
        serverError={workflow.rejectError}
      />
    </>
  )
}
