import { docStatusLabels, stocktakeStatusLabels, transferStatusLabels } from '@/config/inventory-labels'
import { ApiError } from '@/lib/api-error'
import { formatNumber } from '@/lib/format'
import type { InventoryErrorCode } from '../lib/problem'
import { baseUnitWord } from '../lib/uom'
import { vnHhmmDate } from '../lib/vn-time'

/**
 * Lỗi nghiệp vụ đúng ProblemDetails của BE (07 §2.12): `code` + `detail` đúng câu + trường mở rộng.
 */

type FieldErrors = Record<string, string | string[]>
const toErrors = (errors: FieldErrors) =>
  Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, Array.isArray(v) ? v : [v]]))

/** Lỗi có mã nghiệp vụ */
export function codedError(
  status: number,
  code: InventoryErrorCode,
  detail: string,
  extensions: Record<string, unknown> & { errors?: FieldErrors } = {}
): ApiError {
  const { errors, ...rest } = extensions
  return ApiError.fromStatus(status, detail, {
    code,
    ...rest,
    ...(errors ? { errors: toErrors(errors) } : {}),
  })
}

/** 400 theo trường; `detail` là câu đầu tiên khi chỉ có một lỗi (07 §2.12) */
export function fieldErrors(errors: FieldErrors): ApiError {
  const messages = Object.values(errors).flatMap((v) => (Array.isArray(v) ? v : [v]))
  const detail = messages.length === 1 ? messages[0] : 'Dữ liệu chưa hợp lệ.'
  return ApiError.fromStatus(400, detail, { errors: toErrors(errors) })
}

const n = (q: number) => formatNumber(q, 0)
const statusText = (status: string) =>
  (docStatusLabels as Record<string, string>)[status] ??
  (transferStatusLabels as Record<string, string>)[status] ??
  (stocktakeStatusLabels as Record<string, string>)[status] ??
  status

export const inventoryErrors = {
  duLieuCu: (currentVersion: number) =>
    codedError(409, 'DuLieuCu', 'Phiếu vừa được cập nhật, đang tải lại', { currentVersion }),
  phieuDaDuyet: (code: string | undefined, byName: string | undefined, at: string | undefined) =>
    codedError(
      409,
      'PhieuDaDuyet',
      `Phiếu ${code ?? ''} đã được ${byName ?? ''} duyệt lúc ${at ? vnHhmmDate(at) : ''}`.replace(/\s+/g, ' ')
    ),
  trangThaiKhongHopLe: (status: string) =>
    codedError(
      400,
      'TrangThaiKhongHopLe',
      `Phiếu đang ở trạng thái ${statusText(status)}, không thực hiện được thao tác này`,
      { docStatus: status }
    ),
  khongPhaiNguoiLap: () =>
    codedError(400, 'KhongPhaiNguoiLap', 'Chỉ người lập được sửa, gửi hoặc rút phiếu này'),
  nguoiDuyetTrungNguoiLap: (stocktake = false) =>
    codedError(
      400,
      'NguoiDuyetTrungNguoiLap',
      stocktake ? 'Người duyệt phải khác người đếm' : 'Người duyệt phải khác người lập'
    ),
  khongPhuTrachKho: (warehouseCode: string, receive = false) =>
    codedError(
      403,
      'KhongPhuTrachKho',
      receive
        ? `Chỉ thủ kho phụ trách ${warehouseCode} được xác nhận nhận hàng`
        : `Bạn không phụ trách kho ${warehouseCode}`
    ),
  /** BR-04: `lines` mọi dòng vượt (index theo thứ tự gửi lên), `excessByProduct` số vượt theo mặt hàng */
  vuotTonKhaDung: (
    lines: { index: number; productId: string; requested: number; available: number; excess: number; baseUnit: string }[]
  ) => {
    const products = new Map(lines.map((l) => [l.productId, l]))
    const sentence = (l: (typeof lines)[number]) => `Vượt tồn khả dụng ${n(l.excess)} ${baseUnitWord(l.baseUnit)}`
    const detail = products.size === 1 ? sentence(lines[0]) : `Có ${lines.length} dòng vượt tồn khả dụng`
    return codedError(400, 'VuotTonKhaDung', detail, {
      lines: lines.map(({ index, productId, requested, available, excess }) => ({
        index,
        productId,
        requested,
        available,
        excess,
      })),
      errors: Object.fromEntries(lines.map((l) => [`lines[${l.index}].quantity`, sentence(l)])),
    })
  },
  khongDuTonThuc: (
    shortages: { productId: string; productName: string; required: number; onHand: number; missing: number; baseUnit: string }[]
  ) =>
    codedError(
      400,
      'KhongDuTonThuc',
      `Không đủ tồn thực: ${shortages[0].productName} thiếu ${n(shortages[0].missing)} ${baseUnitWord(shortages[0].baseUnit)}`,
      { shortages: shortages.map((x) => ({ productId: x.productId, productName: x.productName, required: x.required, onHand: x.onHand, missing: x.missing })) }
    ),
  dangKiemKe: (productName: string, warehouseCode: string, stocktakeId: string, stocktakeCode: string, productIds: string[]) =>
    codedError(400, 'DangKiemKe', `${productName} đang kiểm kê tại ${warehouseCode} (${stocktakeCode})`, {
      stocktakeId,
      stocktakeCode,
      productIds,
    }),
  khoDaCoPhieuKiemKe: (warehouseCode: string, stocktakeId: string, stocktakeCode: string) =>
    codedError(409, 'KhoDaCoPhieuKiemKe', `Kho ${warehouseCode} đang có phiếu kiểm kê ${stocktakeCode} chưa kết thúc`, {
      stocktakeId,
    }),
  khongCoHangKiemKe: () =>
    codedError(400, 'KhongCoHangKiemKe', 'Phạm vi kiểm kê không có mặt hàng nào còn tồn'),
  ngoaiPhamViKiemKe: (productName: string, index: number) =>
    codedError(400, 'NgoaiPhamViKiemKe', `${productName} không thuộc phạm vi phiếu kiểm kê`, {
      errors: { [`entries[${index}].productId`]: `${productName} không thuộc phạm vi phiếu kiểm kê` },
    }),
  conDongChuaDem: (uncountedLineIds: string[]) =>
    codedError(400, 'ConDongChuaDem', `Còn ${uncountedLineIds.length} dòng chưa đếm`, { uncountedLineIds }),
  thieuNguyenNhan: (
    requiredLines: { lineId: string; productName: string; difference: number; differencePercent?: number | null; differenceValue?: number | null }[]
  ) =>
    codedError(400, 'ThieuNguyenNhan', `Chọn nguyên nhân cho ${requiredLines.length} dòng chênh lệch lớn`, {
      requiredLines,
    }),
  phieuNguocDaCo: (originalCode: string, reversalCode?: string) =>
    codedError(409, 'PhieuNguocDaCo', `Phiếu ${originalCode} đã có phiếu ngược ${reversalCode ?? 'nháp'}`),
  khongTaoPhieuNguoc: () =>
    codedError(400, 'KhongTaoPhieuNguoc', 'Chỉ tạo phiếu ngược từ phiếu đã duyệt, không phải phiếu điều chỉnh'),
  maVachKhongTonTai: (barcode: string) => codedError(404, 'MaVachKhongTonTai', `Không tìm thấy mã ${barcode}`),
}
