'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { errorCode, isStaleDocError } from '../lib/problem'

/** Sinh mã chống bấm lặp (07 §3.8) */
export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/**
 * Giữ `clientRequestId` cho một form hoặc hộp thao tác: giữ nguyên khi bấm lại hoặc thử lại sau lỗi mạng, đổi mới
 * sau khi thành công hoặc gặp lỗi nghiệp vụ cần sửa dữ liệu (07 §3.8).
 */
export function useRequestId() {
  const [id, setId] = useState(newRequestId)
  const renew = useCallback(() => setId(newRequestId()), [])
  return [id, renew] as const
}

/**
 * Xử lý lỗi thao tác phiếu (07 §4.3): `DuLieuCu`, `PhieuDaDuyet`, sai trạng thái → báo rồi tải lại phiếu;
 * lỗi theo ô → trả map lỗi để hiện tại ô; còn lại → toast. Trả true khi lỗi là lỗi nghiệp vụ (cần mã mới).
 */
export function handleDocError(
  error: unknown,
  options: { reload?: () => void; onFieldErrors?: (errors: Record<string, string>) => void } = {}
): boolean {
  if (isStaleDocError(error)) {
    toast.warning(getErrorMessage(error))
    options.reload?.()
    return true
  }
  const fields = getFieldErrors(error)
  if (Object.keys(fields).length && options.onFieldErrors) {
    options.onFieldErrors(fields)
    if (errorCode(error) || Object.keys(fields).length > 0) toast.error(getErrorMessage(error))
    return true
  }
  toast.error(getErrorMessage(error))
  // Lỗi mạng (status 0) giữ mã cũ để gửi lại; lỗi nghiệp vụ đổi mã
  return !(typeof error === 'object' && error && 'status' in error && (error as { status: number }).status === 0)
}
