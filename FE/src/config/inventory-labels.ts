import type { StatusTone } from '@/components/shared/StatusBadge'
import type {
  CountMode,
  DocKind,
  DocStatus,
  IssueType,
  LedgerDocType,
  ReceiptType,
  SlowMovingBucket,
  StockStatus,
  StocktakeStatus,
  TransferStatus,
  VarianceReason,
} from '@/types/inventory'

/**
 * Chữ hiển thị của enum nghiệp vụ (docs/07-DANH-SACH-API.md §2), dùng chung FE-Phiếu và FE-Danh mục & Báo cáo.
 * BE trả enum dạng chuỗi; câu hiển thị lấy ở đây, không ghép tay trong component.
 */
export const receiptTypeLabels: Record<ReceiptType, string> = {
  MuaHang: 'Mua hàng',
  HangBanTraLai: 'Hàng bán bị trả lại',
  NhapKhac: 'Nhập khác',
  NhapDieuChinh: 'Nhập điều chỉnh',
}
export const issueTypeLabels: Record<IssueType, string> = {
  XuatBan: 'Xuất bán',
  TraNhaCungCap: 'Trả nhà cung cấp',
  DungNoiBo: 'Dùng nội bộ',
  XuatHuy: 'Xuất hủy',
  XuatDieuChinh: 'Xuất điều chỉnh',
}
/** Loại người dùng chọn được khi lập phiếu (loại điều chỉnh chỉ sinh từ "Tạo phiếu ngược", BR-12) */
export const selectableReceiptTypes: ReceiptType[] = ['MuaHang', 'HangBanTraLai', 'NhapKhac']
export const selectableIssueTypes: IssueType[] = [
  'XuatBan',
  'TraNhaCungCap',
  'DungNoiBo',
  'XuatHuy',
]

export const docStatusLabels: Record<DocStatus, string> = {
  Nhap: 'Nháp',
  ChoDuyet: 'Chờ duyệt',
  TuChoi: 'Từ chối',
  DaDuyet: 'Đã duyệt',
  DaHuy: 'Đã hủy',
}
export const transferStatusLabels: Record<TransferStatus, string> = {
  Nhap: 'Nháp',
  ChoDuyet: 'Chờ duyệt',
  TuChoi: 'Từ chối',
  DangChuyen: 'Đang chuyển',
  DaNhan: 'Đã nhận',
  DaHuy: 'Đã hủy',
}
export const stocktakeStatusLabels: Record<StocktakeStatus, string> = {
  DangKiem: 'Đang kiểm',
  ChoDuyet: 'Chờ duyệt',
  DaCanBang: 'Đã cân bằng',
  DaHuy: 'Đã hủy',
}
export const stockStatusLabels: Record<StockStatus, string> = {
  BinhThuong: 'Bình thường',
  HetHang: 'Hết hàng',
  DuoiToiThieu: 'Dưới tối thiểu',
  VuotToiDa: 'Vượt tối đa',
}
export const varianceReasonLabels: Record<VarianceReason, string> = {
  HuHong: 'Hư hỏng',
  MatMat: 'Mất mát',
  NhapXuatChuaLapPhieu: 'Nhập xuất chưa lập phiếu',
  NhamMaHang: 'Nhầm mã hàng',
  Khac: 'Khác',
}
export const ledgerDocTypeLabels: Record<LedgerDocType, string> = {
  PhieuNhap: 'Phiếu nhập',
  PhieuXuat: 'Phiếu xuất',
  ChuyenDi: 'Chuyển đi',
  ChuyenDen: 'Chuyển đến',
  KiemKe: 'Điều chỉnh kiểm kê',
}
export const docKindLabels: Record<DocKind, string> = {
  GoodsReceipt: 'Phiếu nhập',
  GoodsIssue: 'Phiếu xuất',
  Transfer: 'Phiếu chuyển kho',
  Stocktake: 'Phiếu kiểm kê',
}
export const slowMovingBucketLabels: Record<SlowMovingBucket, string> = {
  Tu30: '30–59 ngày',
  Tu60: '60–89 ngày',
  Tu90: 'Từ 90 ngày',
}
export const countModeLabels: Record<CountMode, string> = { Cong: 'Cộng thêm', Dat: 'Đặt bằng' }

/** Tông màu StatusBadge (prop `tone`) theo trạng thái; luôn kèm chữ */
export const docStatusBadge: Record<DocStatus, StatusTone> = {
  Nhap: 'neutral',
  ChoDuyet: 'warning',
  TuChoi: 'danger',
  DaDuyet: 'success',
  DaHuy: 'neutral',
}
export const transferStatusBadge: Record<TransferStatus, StatusTone> = {
  Nhap: 'neutral',
  ChoDuyet: 'warning',
  TuChoi: 'danger',
  DangChuyen: 'info',
  DaNhan: 'success',
  DaHuy: 'neutral',
}
export const stocktakeStatusBadge: Record<StocktakeStatus, StatusTone> = {
  DangKiem: 'info',
  ChoDuyet: 'warning',
  DaCanBang: 'success',
  DaHuy: 'neutral',
}
export const stockStatusBadge: Record<StockStatus, StatusTone> = {
  BinhThuong: 'success',
  HetHang: 'danger',
  DuoiToiThieu: 'warning',
  VuotToiDa: 'info',
}

/** Lý do gợi ý (vẫn nhập tự do) */
export const rejectReasonSuggestions = [
  'Sai đơn giá so với hóa đơn, kiểm tra lại',
  'Đại lý đổi số lượng đặt hàng, sửa lại phiếu',
  'Thiếu số hóa đơn của nhà cung cấp',
  'Nhập nhầm đơn vị tính, sửa lại theo thùng',
]
export const scrapReasonSuggestions = [
  'Hết hạn sử dụng',
  'Hư hỏng, móp méo khi bốc xếp',
  'Bao bì rách, không bán được',
]

/** Nhãn trạng thái phiếu chuyển "Trễ" (BR-13) */
export const lateTransferLabel = 'Trễ'
