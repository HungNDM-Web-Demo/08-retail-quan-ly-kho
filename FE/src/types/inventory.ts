/**
 * Hợp đồng dữ liệu nghiệp vụ Quản lý Kho, chép đúng docs/07-DANH-SACH-API.md §2 (07 là nguồn; đổi DTO thì sửa 07
 * trước rồi sửa file này). BE `Application/DTOs/*` khớp từng trường.
 * Dùng chung cho FE-Phiếu và FE-Danh mục & Báo cáo (07 §4.9): không tách bản sao trong features/*.
 * Quy ước: `?` là có thể null hoặc vắng; ngày giờ chuỗi ISO UTC; ngày `yyyy-MM-dd` theo giờ Việt Nam;
 * tiền là số nguyên đồng; số lượng là số nguyên. Trường giá trị (giá vốn, giá trị) là null khi người gọi không có
 * quyền xem (BR-25) — FE dựa vào `canViewValues` để ẩn cột, không tự đoán theo vai trò.
 */

import type { PaginatedResult, PaginationQuery } from '@/types/api'

// ============================================================ Enum (06 §4, 07 §2)

/** Loại phiếu nhập (FR-11, BR-12) */
export type ReceiptType = 'MuaHang' | 'HangBanTraLai' | 'NhapKhac' | 'NhapDieuChinh'
/** Loại phiếu xuất (FR-14, BR-12) */
export type IssueType = 'XuatBan' | 'TraNhaCungCap' | 'DungNoiBo' | 'XuatHuy' | 'XuatDieuChinh'
/** Trạng thái phiếu nhập, phiếu xuất (SRS §5.2) */
export type DocStatus = 'Nhap' | 'ChoDuyet' | 'TuChoi' | 'DaDuyet' | 'DaHuy'
/** Trạng thái phiếu chuyển kho (SRS §5.2) */
export type TransferStatus = 'Nhap' | 'ChoDuyet' | 'TuChoi' | 'DangChuyen' | 'DaNhan' | 'DaHuy'
/** Trạng thái phiếu kiểm kê (SRS §5.2) */
export type StocktakeStatus = 'DangKiem' | 'ChoDuyet' | 'DaCanBang' | 'DaHuy'
/** Trạng thái tồn của một mặt hàng tại một kho (BR-18) */
export type StockStatus = 'BinhThuong' | 'HetHang' | 'DuoiToiThieu' | 'VuotToiDa'
/** Nguyên nhân chênh lệch kiểm kê (BR-16) */
export type VarianceReason = 'HuHong' | 'MatMat' | 'NhapXuatChuaLapPhieu' | 'NhamMaHang' | 'Khac'
/** Loại dòng thẻ kho (BR-11) */
export type LedgerDocType = 'PhieuNhap' | 'PhieuXuat' | 'ChuyenDi' | 'ChuyenDen' | 'KiemKe'
/** Loại chứng từ, dùng ở Phiếu chờ duyệt, Việc cần làm, liên kết thẻ kho */
export type DocKind = 'GoodsReceipt' | 'GoodsIssue' | 'Transfer' | 'Stocktake'
/** Nhóm hàng chậm luân chuyển (BR-22) */
export type SlowMovingBucket = 'Tu30' | 'Tu60' | 'Tu90'
/** Cách ghi số đếm kiểm kê: cộng thêm (quét mã, "nhập thêm") hoặc đặt bằng (gõ tổng số) */
export type CountMode = 'Cong' | 'Dat'

// ============================================================ Chung

/** Mọi thao tác ghi trên một phiếu có sẵn (07 §3.8): chống ghi đè và chống bấm lặp */
export type DocActionRequest = {
  /** `version` của phiếu lúc người dùng mở; lệch → 409 `DuLieuCu` */
  version: number
  /** Sinh bằng `crypto.randomUUID()` khi mở hộp thao tác, giữ nguyên khi bấm lại; trùng → trả kết quả cũ */
  clientRequestId: string
}

/** Dòng gửi lên khi tạo, sửa phiếu nhập, xuất, chuyển */
export type DocLineInput = {
  productId: string
  /** null = đơn vị cơ bản */
  unitId?: string | null
  /** Số nguyên > 0 theo đơn vị đã chọn (BR-07) */
  quantity: number
}

/** Kho ngắn gọn cho ô chọn, bộ lọc (thủ kho chỉ nhận kho được gán, BR-23) */
export type WarehouseOption = { id: string; code: string; name: string; isActive: boolean }

export type UserRef = { id: string; username: string; fullName: string }

/** Đơn vị quy đổi (FR-07); `isUsed` = đã có trong chứng từ → khóa hệ số (BR-24, TC-03) */
export type ProductUnitDto = {
  id: string
  name: string
  factor: number
  barcode?: string
  sortOrder: number
  isUsed: boolean
}

/** Đơn vị dùng để đọc số lượng quy đổi ("23 thùng 16 chai", BR-01) */
export type UnitReading = { name: string; factor: number }

// ============================================================ Kho (07 §2.1)

export type WarehouseDto = {
  id: string
  code: string
  name: string
  address?: string
  phone?: string
  isActive: boolean
  sortOrder: number
  keepers: UserRef[]
  stockedProductCount: number // số mặt hàng tồn > 0
  stockValue?: number // null khi không có stock-values.view
  openDocumentCount: number // phiếu chưa kết thúc liên quan kho (BR-24)
  hasDocuments: boolean // đã có chứng từ → không xóa, chỉ ngừng
}
export type SaveWarehouseRequest = { code: string; name: string; address?: string; phone?: string }
export type SetActiveRequest = { isActive: boolean }
export type AssignKeepersRequest = { userIds: string[] }
export type KeeperCandidate = UserRef & { warehouseCodes: string[] }

// ============================================================ Nhà cung cấp (07 §2.2)

export type SupplierDto = {
  id: string
  code: string
  name: string
  taxCode?: string
  phone?: string
  address?: string
  contactName?: string
  isActive: boolean
  receiptCount: number // phiếu nhập đã duyệt
  lastReceiptAt?: string
  hasDocuments: boolean
}
export type SupplierQuery = PaginationQuery & { isActive?: boolean }
/** Ô chọn nhà cung cấp (`GET /api/suppliers/options`); chỉ chọn được `isActive` vào phiếu mới */
export type SupplierOption = { id: string; code: string; name: string; isActive: boolean }
export type SaveSupplierRequest = {
  code?: string // bỏ trống khi tạo → BE cấp NCC + 3 số kế tiếp
  name: string
  taxCode?: string
  phone?: string
  address?: string
  contactName?: string
}

// ============================================================ Nhóm hàng, mặt hàng (07 §2.3)

export type ProductGroupDto = {
  id: string
  code: string
  name: string
  color: string // #RRGGBB
  isActive: boolean
  sortOrder: number
  productCount: number
}
export type SaveProductGroupRequest = { code: string; name: string; color: string }

export type ProductStockCell = {
  warehouseId: string
  warehouseCode: string
  onHand: number
  status: StockStatus
}
export type ProductDto = {
  id: string
  code: string
  name: string
  groupId: string
  groupName: string
  groupColor: string
  baseUnit: string
  barcode?: string
  spec?: string
  imageUrl?: string
  isActive: boolean
  units: ProductUnitDto[] // tối đa 2, theo sortOrder
  stocks: ProductStockCell[] // kho người gọi được xem (FR-09)
  totalOnHand: number
  hasDocuments: boolean
}
export type ProductLevelDto = {
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  minQty?: number
  maxQty?: number
  onHand: number
}
export type ProductDetailDto = ProductDto & { levels: ProductLevelDto[] } // đủ mọi kho đang hoạt động
export type ProductQuery = PaginationQuery & { groupId?: string; isActive?: boolean }
export type SaveProductRequest = {
  code: string
  name: string
  groupId: string
  baseUnit: string
  barcode?: string
  spec?: string
  /** Có id: sửa; không id: thêm; đơn vị cũ vắng mặt: xóa (chỉ khi chưa dùng) */
  units: { id?: string; name: string; factor: number; barcode?: string }[]
  levels: { warehouseId: string; minQty?: number | null; maxQty?: number | null }[]
}

/** Danh mục gọn cho màn lập phiếu, quét mã tại máy (NFR-02) */
export type CatalogProduct = {
  id: string
  code: string
  name: string
  groupId: string
  baseUnit: string
  barcode?: string
  spec?: string
  imageUrl?: string
  isActive: boolean
  units: { id: string; name: string; factor: number; barcode?: string }[]
}
/** Kết quả tra mã vạch: `unitId` null = mã của đơn vị cơ bản */
export type BarcodeMatch = { product: CatalogProduct; unitId?: string }

// ============================================================ Phiếu nhập (07 §2.4)

export type GoodsReceiptLineDto = {
  id: string
  lineNo: number
  productId: string
  productCode: string
  productName: string
  baseUnit: string
  unitId?: string
  unitName: string // chụp lúc lập; đơn vị cơ bản thì bằng baseUnit
  factor: number
  quantity: number
  baseQuantity: number // quantity × factor
  unitPrice?: number // theo đơn vị đã chọn
  amount?: number // quantity × unitPrice
  allocatedCost?: number // BR-08
  value?: number // amount + allocatedCost
  landedUnitPrice?: number // round(value ÷ quantity), "đơn giá nhập kho"
}
export type GoodsReceiptDto = {
  id: string
  code?: string // cấp khi gửi duyệt lần đầu; nháp chưa gửi thì null
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  type: ReceiptType
  supplierId?: string
  supplierCode?: string
  supplierName?: string
  delivererName?: string // người giao hàng (01-VT)
  sourceDocNo?: string // số hóa đơn, chứng từ gốc
  sourceDocDate?: string // yyyy-MM-dd
  note?: string
  freightCost?: number
  totalAmount?: number
  totalValue?: number
  status: DocStatus
  version: number
  createdById: string
  createdByName: string
  createdAt: string
  submittedAt?: string
  approvedById?: string
  approvedByName?: string
  approvedAt?: string // thời điểm ghi sổ
  rejectedByName?: string
  rejectedAt?: string
  rejectReason?: string // lần từ chối gần nhất; còn giữ sau khi gửi lại
  cancelledByName?: string
  cancelledAt?: string
  reversalOfId?: string // phiếu gốc (phiếu xuất) khi đây là phiếu ngược
  reversalOfCode?: string
  reversedById?: string // phiếu ngược (phiếu xuất) đã lập từ phiếu này, chưa hủy
  reversedByCode?: string
  lineCount: number
  lines: GoodsReceiptLineDto[]
  canViewValues: boolean // BR-25: có stock-values.view hoặc là người lập
}
/** Dòng danh sách: không kèm `lines` */
export type GoodsReceiptListItem = Omit<GoodsReceiptDto, 'lines'>
export type GoodsReceiptQuery = PaginationQuery & {
  warehouseId?: string
  type?: ReceiptType
  status?: DocStatus
  supplierId?: string
  createdById?: string
  from?: string
  to?: string
}
export type SaveGoodsReceiptRequest = {
  warehouseId: string
  type: ReceiptType
  supplierId?: string | null
  delivererName?: string
  sourceDocNo?: string
  sourceDocDate?: string | null
  note?: string
  freightCost?: number
  lines: (DocLineInput & { unitPrice: number })[]
  /** true: lưu rồi gửi duyệt trong một lần (kiểm đủ quy tắc gửi) */
  submit?: boolean
  clientRequestId: string
  /** Bắt buộc khi sửa (PUT) */
  version?: number
}

// ============================================================ Phiếu xuất (07 §2.5)

/** Số liệu cho người duyệt (UC-05 bước 2): tồn hiện tại, giá vốn dự kiến; chỉ có khi phiếu Chờ duyệt */
export type ApprovalPreview = {
  onHand: number
  shortage: number // > 0: thiếu so với tồn thực (E2)
  avgCost?: number
  estimatedValue?: number
}
export type GoodsIssueLineDto = {
  id: string
  lineNo: number
  productId: string
  productCode: string
  productName: string
  baseUnit: string
  unitId?: string
  unitName: string
  factor: number
  quantity: number
  baseQuantity: number
  unitCost?: number // giá vốn một đơn vị cơ bản lúc duyệt
  value?: number
  preview?: ApprovalPreview
}
export type GoodsIssueDto = {
  id: string
  code?: string
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  type: IssueType
  recipientName?: string // bắt buộc với XuatBan
  supplierId?: string // TraNhaCungCap
  supplierCode?: string
  supplierName?: string
  orderRef?: string // số đơn hàng tham chiếu
  reason?: string // bắt buộc với XuatHuy, XuatDieuChinh; tùy chọn với loại khác
  totalValue?: number
  status: DocStatus
  version: number
  createdById: string
  createdByName: string
  createdAt: string
  submittedAt?: string
  approvedById?: string
  approvedByName?: string
  approvedAt?: string
  rejectedByName?: string
  rejectedAt?: string
  rejectReason?: string
  cancelledByName?: string
  cancelledAt?: string
  reversalOfId?: string // phiếu gốc (phiếu nhập)
  reversalOfCode?: string
  reversedById?: string // phiếu ngược (phiếu nhập)
  reversedByCode?: string
  lineCount: number
  lines: GoodsIssueLineDto[]
  canViewValues: boolean
}
export type GoodsIssueListItem = Omit<GoodsIssueDto, 'lines'>
export type GoodsIssueQuery = PaginationQuery & {
  warehouseId?: string
  type?: IssueType
  status?: DocStatus
  createdById?: string
  from?: string
  to?: string
}
export type SaveGoodsIssueRequest = {
  warehouseId: string
  type: IssueType
  recipientName?: string
  supplierId?: string | null
  orderRef?: string
  reason?: string
  lines: DocLineInput[]
  submit?: boolean
  clientRequestId: string
  version?: number
}

// ============================================================ Chuyển kho (07 §2.6)

export type TransferLineDto = {
  id: string
  lineNo: number
  productId: string
  productCode: string
  productName: string
  baseUnit: string
  unitId?: string
  unitName: string
  factor: number
  quantity: number
  baseQuantity: number
  receivedBaseQuantity?: number // có khi Đã nhận
  shortageQuantity?: number // baseQuantity − receivedBaseQuantity
  unitCost?: number // giá vốn chuyển (BR-13)
  value?: number
  shortageValue?: number
  preview?: ApprovalPreview
}
export type TransferDto = {
  id: string
  code?: string
  fromWarehouseId: string
  fromWarehouseCode: string
  fromWarehouseName: string
  toWarehouseId: string
  toWarehouseCode: string
  toWarehouseName: string
  note?: string
  status: TransferStatus
  isLate: boolean // Đang chuyển quá 3 ngày (BR-13)
  version: number
  createdById: string
  createdByName: string
  createdAt: string
  submittedAt?: string
  approvedById?: string
  approvedByName?: string
  approvedAt?: string
  rejectedByName?: string
  rejectedAt?: string
  rejectReason?: string
  cancelledByName?: string
  cancelledAt?: string
  receivedById?: string
  receivedByName?: string
  receivedAt?: string
  totalValue?: number
  shortageValue?: number
  lineCount: number
  lines: TransferLineDto[]
  canViewValues: boolean
}
export type TransferListItem = Omit<TransferDto, 'lines'>
export type TransferQuery = PaginationQuery & {
  warehouseId?: string // kho đi hoặc kho đến
  fromWarehouseId?: string
  toWarehouseId?: string
  status?: TransferStatus
  isLate?: boolean
  createdById?: string
  from?: string
  to?: string
}
export type SaveTransferRequest = {
  fromWarehouseId: string
  toWarehouseId: string
  note?: string
  lines: DocLineInput[]
  submit?: boolean
  clientRequestId: string
  version?: number
}
export type ReceiveTransferRequest = DocActionRequest & {
  lines: { lineId: string; receivedBaseQuantity: number }[] // đủ mọi dòng, 0…baseQuantity
}

// ============================================================ Duyệt (07 §2.7)

export type RejectRequest = DocActionRequest & { reason: string } // ≥ 10 ký tự (BR-06)
export type ApprovalItem = {
  kind: DocKind
  id: string
  code?: string
  typeText: string // "Phiếu nhập · Mua hàng", "Phiếu chuyển KTONG → KTD", "Kiểm kê · Dầu ăn, gia vị"
  warehouseCode: string // kho của phiếu; chuyển kho là kho đi
  toWarehouseCode?: string
  createdById: string
  createdByName: string
  submittedAt: string
  lineCount: number
  totalValue?: number
  canApprove: boolean // có quyền duyệt loại này và khác người lập/người đếm (BR-06)
  blockedReason?: string // "Người duyệt phải khác người lập"
  version: number
}
export type ApprovalQuery = { kind?: DocKind; warehouseId?: string; createdById?: string }

// ============================================================ Tồn kho, cảnh báo, thẻ kho (07 §2.8)

export type AvailabilityRow = {
  productId: string
  onHand: number
  reserved: number
  available: number
}

export type StockRowDto = {
  productId: string
  productCode: string
  productName: string
  groupId: string
  groupName: string
  groupColor: string
  baseUnit: string
  units: UnitReading[] // để đọc quy đổi
  imageUrl?: string
  warehouseId?: string // null khi "Tất cả kho"
  onHand: number
  reserved: number // số lượng chờ xuất (BR-03)
  available: number
  reading: string // "23 thùng 16 chai" (BR-01)
  avgCost?: number // một kho: giá vốn bình quân; tất cả kho: null
  stockValue?: number
  minQty?: number
  maxQty?: number
  status?: StockStatus // một kho; tất cả kho: null
  byWarehouse?: {
    warehouseId: string
    warehouseCode: string
    onHand: number
    available: number
    status: StockStatus
  }[]
}
export type StockQuery = PaginationQuery & {
  warehouseId?: string // trống = tất cả kho người gọi được xem
  groupId?: string
  status?: StockStatus
  /** Chỉ dòng tồn > 0 */
  inStockOnly?: boolean
}
export type StockListResult = PaginatedResult<StockRowDto> & {
  totalValue?: number // tổng giá trị tồn theo bộ lọc (dòng tổng đầu bảng)
  canViewValues: boolean
}

export type ReservationDto = {
  kind: 'GoodsIssue' | 'Transfer'
  docId: string
  docCode?: string
  warehouseCode: string
  toWarehouseCode?: string
  createdByName: string
  submittedAt: string
  baseQuantity: number
}

export type StockAlertDto = {
  productId: string
  productCode: string
  productName: string
  groupName: string
  baseUnit: string
  units: UnitReading[]
  warehouseId: string
  warehouseCode: string
  onHand: number
  available: number
  minQty?: number
  maxQty?: number
  status: Exclude<StockStatus, 'BinhThuong'>
  suggestedQuantity?: number // BR-19, chỉ dòng thiếu có tồn tối đa
  suggestedReading?: string // "26 thùng"
  /** Kho khác (người gọi được thao tác) còn khả dụng > 0; chỉ dòng thiếu */
  sources: {
    warehouseId: string
    warehouseCode: string
    warehouseName: string
    available: number
  }[]
}
export type StockAlertQuery = {
  warehouseId?: string
  status?: Exclude<StockStatus, 'BinhThuong'>
  groupId?: string
}

export type StockCardLineDto = {
  id: string
  postedAt: string
  warehouseId: string
  warehouseCode: string
  docType: LedgerDocType
  docKind: DocKind
  docId: string
  docCode: string
  description: string // "Xuất bán – Đại lý Tạp hóa Thanh Hương"
  inQuantity: number
  outQuantity: number
  balanceQuantity: number // tồn sau (mọi kho: lũy kế các kho)
  unitCost?: number
  inValue?: number
  outValue?: number
  balanceValue?: number
  avgCostAfter?: number // chỉ khi xem một kho
}
export type StockCardDto = {
  product: { id: string; code: string; name: string; baseUnit: string; units: UnitReading[] }
  warehouseId?: string // null = mọi kho
  warehouseCode?: string
  from: string
  to: string
  opening: { quantity: number; value?: number }
  totals: { inQuantity: number; outQuantity: number; inValue?: number; outValue?: number }
  closing: { quantity: number; value?: number }
  lines: StockCardLineDto[]
  canViewValues: boolean
}
export type StockCardQuery = { productId: string; warehouseId?: string; from: string; to: string }

// ============================================================ Kiểm kê (07 §2.9)

export type StocktakeLineDto = {
  id: string
  productId: string
  productCode: string
  productName: string
  groupId: string
  groupName: string
  baseUnit: string
  units: { id: string; name: string; factor: number; barcode?: string }[]
  barcode?: string
  /** Ẩn (null) khi phiếu Đang kiểm và người gọi không có stocktakes.approve (kiểm kê mù, BR-15) */
  bookQuantity?: number
  bookCost?: number // thêm điều kiện stock-values.view
  countedQuantity?: number // null = chưa đếm
  difference?: number
  differencePercent?: number // |chênh| ÷ sổ sách × 100, 1 chữ số; sổ sách 0 → null
  differenceValue?: number
  reasonRequired?: boolean
  reason?: VarianceReason
  reasonNote?: string
  needsRecount: boolean
  recountNote?: string
  isAdded: boolean // thêm ngoài danh sách lúc đếm
  lastCountedByName?: string
  lastCountedAt?: string
}
export type StocktakeDto = {
  id: string
  code: string
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  scopeAll: boolean
  groups: { id: string; name: string }[] // phạm vi khi không toàn kho
  status: StocktakeStatus
  version: number
  snapshotAt: string // thời điểm chốt sổ sách = lúc tạo
  createdById: string
  createdByName: string
  counterId: string
  counterName: string
  submittedByName?: string
  submittedAt?: string
  approvedById?: string
  approvedByName?: string
  approvedAt?: string
  cancelledByName?: string
  cancelledAt?: string
  note?: string
  returnNote?: string // ghi chú lần trả lại đếm lại gần nhất
  totalLines: number
  countedLines: number
  surplusValue?: number // tổng thừa
  shortageValue?: number // tổng thiếu (số dương)
  isBlind: boolean
  canViewValues: boolean
  lines: StocktakeLineDto[]
}
export type StocktakeListItem = Omit<StocktakeDto, 'lines'>
export type StocktakeQuery = PaginationQuery & {
  warehouseId?: string
  status?: StocktakeStatus
  from?: string
  to?: string
}
export type CreateStocktakeRequest = {
  warehouseId: string
  scopeAll: boolean
  groupIds: string[] // bắt buộc ≥ 1 khi scopeAll = false
  counterId: string // tài khoản thủ kho được gán kho, hoặc chính người tạo
  note?: string
  clientRequestId: string
}
export type CountEntry = {
  productId: string
  unitId?: string | null
  quantity: number
  mode: CountMode
}
export type SubmitCountsRequest = { clientRequestId: string; entries: CountEntry[] } // không cần version
export type SubmitStocktakeRequest = DocActionRequest & {
  reasons: { lineId: string; reason: VarianceReason; note?: string }[]
}
export type ReturnStocktakeRequest = DocActionRequest & { lineIds: string[]; note: string }

// ============================================================ Tổng quan, báo cáo (07 §2.10)

export type DashboardReport = {
  asOf: string
  warehouses: {
    warehouseId: string
    code: string
    name: string
    stockValue: number
    stockedProductCount: number
  }[]
  totalStockValue: number
  belowMinCount: number
  outOfStockCount: number
  overMaxCount: number
  pending: {
    goodsReceipts: number
    goodsIssues: number
    transfers: number
    stocktakes: number
    total: number
  }
  inTransit: { count: number; value: number; lateCount: number }
  daily: { date: string; inValue: number; outValue: number }[] // 30 ngày tới hôm nay, đủ mọi ngày
  topIssued: {
    productId: string
    code: string
    name: string
    baseUnit: string
    quantity: number
    value: number
  }[]
}
export type TodoDoc = {
  kind: DocKind
  id: string
  code?: string
  warehouseCode: string
  toWarehouseCode?: string
  typeText: string
  createdAt: string
  updatedAt: string
  lineCount: number
}
export type StaffTodo = {
  warehouses: WarehouseOption[]
  drafts: TodoDoc[]
  rejected: (TodoDoc & { rejectReason: string; rejectedByName: string; rejectedAt: string })[]
  waiting: TodoDoc[] // phiếu của mình đang chờ duyệt
  toReceive: (TodoDoc & { fromWarehouseCode: string; approvedAt: string; isLate: boolean })[]
  counting: (TodoDoc & { counterName: string; countedLines: number; totalLines: number })[]
}

export type ReportPeriodQuery = { from: string; to: string; warehouseId?: string }
export type MovementRow = {
  productId: string
  productCode: string
  productName: string
  groupId: string
  groupName: string
  baseUnit: string
  openingQty: number
  openingValue: number
  inQty: number
  inValue: number
  outQty: number
  outValue: number
  closingQty: number
  closingValue: number
}
export type MovementReport = {
  from: string
  to: string
  warehouseId?: string
  rows: MovementRow[] // mặt hàng có ít nhất một số khác 0
  totals: Omit<
    MovementRow,
    'productId' | 'productCode' | 'productName' | 'groupId' | 'groupName' | 'baseUnit'
  >
  /** Chỉ khi "Tất cả kho": hàng đã xuất kho đi, chưa nhận ở kho đến tại cuối kỳ (BR-21) */
  inTransit?: {
    totalValue: number
    lines: {
      productId: string
      productCode: string
      productName: string
      baseUnit: string
      quantity: number
      value: number
    }[]
  }
}
export type MovementQuery = ReportPeriodQuery & { groupId?: string }

export type SlowMovingRow = {
  productId: string
  productCode: string
  productName: string
  groupName: string
  baseUnit: string
  warehouseId: string
  warehouseCode: string
  onHand: number
  stockValue?: number
  lastIssueAt?: string
  firstReceiptAt?: string
  daysSince: number
  bucket: SlowMovingBucket
}
export type SlowMovingQuery = { warehouseId?: string; groupId?: string }

export type SupplierReceiptRow = {
  supplierId: string
  supplierCode: string
  supplierName: string
  receiptCount: number
  totalAmount: number
  freightCost: number
  totalValue: number
  sharePercent: number // 1 chữ số
}
export type IssueTypeRow = {
  type: IssueType
  docCount: number
  baseQuantity: number
  value: number
  sharePercent: number
}
export type StocktakeVarianceRow = {
  stocktakeId: string
  code: string
  warehouseCode: string
  approvedAt: string
  lineCount: number
  varianceLineCount: number
  surplusValue: number
  shortageValue: number
  netValue: number
  byReason: { reason?: VarianceReason; lineCount: number; value: number }[] // reason null = không bắt buộc, không chọn
}
export type TransferLossRow = {
  fromWarehouseCode: string
  toWarehouseCode: string
  transferCount: number
  shortageLineCount: number
  shortageValue: number
  transfers: {
    id: string
    code: string
    receivedAt: string
    shortageQuantity: number
    shortageValue: number
  }[]
}
export type TransferLossQuery = {
  from: string
  to: string
  fromWarehouseId?: string
  toWarehouseId?: string
}

/** Đơn vị in trên chứng từ (Store.*), người đăng nhập nào cũng đọc được */
export type StoreProfile = {
  name: string
  address: string
  phone: string
  taxCode: string
  directorName: string
  chiefAccountantName: string
  logoUrl: string
}
