import { isApiError } from '@/lib/api-error'

/**
 * Mã lỗi nghiệp vụ (07 §2.12): ProblemDetails có trường mở rộng `code` để FE rẽ nhánh mà không so chuỗi.
 */
export type InventoryErrorCode =
  | 'DuLieuCu'
  | 'PhieuDaDuyet'
  | 'TrangThaiKhongHopLe'
  | 'KhongPhaiNguoiLap'
  | 'NguoiDuyetTrungNguoiLap'
  | 'KhongPhuTrachKho'
  | 'VuotTonKhaDung'
  | 'KhongDuTonThuc'
  | 'DangKiemKe'
  | 'KhoDaCoPhieuKiemKe'
  | 'KhongCoHangKiemKe'
  | 'NgoaiPhamViKiemKe'
  | 'ConDongChuaDem'
  | 'ThieuNguyenNhan'
  | 'KhoConTon'
  | 'DaCoChungTu'
  | 'NhomConHang'
  | 'DonViDaDung'
  | 'MaVachTrung'
  | 'MaVachKhongTonTai'
  | 'PhieuNguocDaCo'
  | 'KhongTaoPhieuNguoc'

/** Mã lỗi nghiệp vụ của lỗi API (không có thì null) */
export function errorCode(error: unknown): InventoryErrorCode | null {
  if (!isApiError(error)) return null
  const code = error.problem.code
  return typeof code === 'string' ? (code as InventoryErrorCode) : null
}

/** Trường mở rộng của ProblemDetails (vd `lines`, `shortages`, `uncountedLineIds`, `requiredLines`) */
export function errorExtension<T>(error: unknown, key: string): T | undefined {
  if (!isApiError(error)) return undefined
  return error.problem[key] as T | undefined
}

/** Lỗi phiếu đã đổi ở nơi khác: cần tải lại phiếu (07 §4.3) */
export const isStaleDocError = (error: unknown) => {
  const code = errorCode(error)
  return code === 'DuLieuCu' || code === 'PhieuDaDuyet' || code === 'TrangThaiKhongHopLe'
}
