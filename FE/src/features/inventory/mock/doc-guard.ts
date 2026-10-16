import type { DocActionRequest } from '@/types/inventory'
import { inventoryErrors } from './errors'

/**
 * Thứ tự kiểm một thao tác trên phiếu có sẵn (07 §3.8, BE `DocActionGuard`):
 * 1. `clientRequestId` trùng thao tác gần nhất → trả kết quả cũ (không làm lại);
 * 2. trạng thái không cho thao tác → `PhieuDaDuyet` (đã ghi sổ) hoặc `TrangThaiKhongHopLe`;
 * 3. quyền người thao tác (người lập, BR-06);
 * 4. `version` lệch → 409 `DuLieuCu`;
 * 5. quy tắc nghiệp vụ (người gọi kiểm tiếp) rồi ghi, `version += 1`, `lastRequestId = clientRequestId`.
 */
export type GuardedDoc = {
  status: string
  version: number
  createdById: string
  lastRequestId?: string | null
  code?: string
  approvedByName?: string
  approvedAt?: string
}

/** Trạng thái coi là "đã ghi sổ" → lỗi PhieuDaDuyet */
const POSTED = new Set(['DaDuyet', 'DangChuyen', 'DaNhan', 'DaCanBang'])

export function guardDocAction(
  doc: GuardedDoc,
  req: Partial<DocActionRequest>,
  options: {
    allowed: readonly string[]
    userId: string
    /** Chỉ người lập (sửa, gửi, rút) */
    ownerOnly?: boolean
    /** Người thao tác phải khác người lập (duyệt, từ chối; BR-06) */
    notOwner?: boolean
    /** Danh sách người phải khác (kiểm kê: người đếm) */
    notUsers?: readonly string[]
    /** Kiểm kê: câu "Người duyệt phải khác người đếm" */
    stocktake?: boolean
    /** Kiểm thêm sau khi qua bước 2 (vd phạm vi kho, người lập hoặc người có quyền duyệt) */
    authorize?: () => void
  }
): 'replay' | 'proceed' {
  if (req.clientRequestId && doc.lastRequestId && req.clientRequestId === doc.lastRequestId) return 'replay'
  if (!options.allowed.includes(doc.status)) {
    if (POSTED.has(doc.status)) throw inventoryErrors.phieuDaDuyet(doc.code, doc.approvedByName, doc.approvedAt)
    throw inventoryErrors.trangThaiKhongHopLe(doc.status)
  }
  if (options.ownerOnly && doc.createdById !== options.userId) throw inventoryErrors.khongPhaiNguoiLap()
  if (options.notOwner && doc.createdById === options.userId) throw inventoryErrors.nguoiDuyetTrungNguoiLap(false)
  if (options.notUsers?.includes(options.userId)) throw inventoryErrors.nguoiDuyetTrungNguoiLap(options.stocktake)
  options.authorize?.()
  if (req.version !== undefined && req.version !== doc.version) throw inventoryErrors.duLieuCu(doc.version)
  return 'proceed'
}

/** Thời điểm hiện tại ISO (một chỗ để thao tác trong cùng request dùng chung) */
export const nowIso = () => new Date().toISOString()
