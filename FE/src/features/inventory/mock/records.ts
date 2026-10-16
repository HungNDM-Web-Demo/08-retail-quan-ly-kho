import type {
  DocKind,
  DocStatus,
  GoodsIssueLineDto,
  GoodsReceiptLineDto,
  IssueType,
  LedgerDocType,
  ReceiptType,
  StocktakeStatus,
  TransferLineDto,
  TransferStatus,
  VarianceReason,
} from '@/types/inventory'

/**
 * Bản ghi trong mock-db và kho lịch sử trong bộ nhớ (07 §4.8). Gần DTO, thêm cột nội bộ (người thao tác,
 * `clientRequestId`, `lastRequestId`); bỏ trường tính khi đọc (`canViewValues`, `lineCount`, `preview`,
 * `isLate`, tên kho, tên nhà cung cấp, phiếu ngược đã có). Bảng gốc: 06 §4.
 */

export type WarehouseRecord = {
  id: string
  code: string
  name: string
  address?: string
  phone?: string
  isActive: boolean
  sortOrder: number
  /** Inventory_WarehouseKeepers */
  keeperUserIds: string[]
  createdAt: string
  isDeleted?: boolean
}

export type SupplierRecord = {
  id: string
  code: string
  name: string
  taxCode?: string
  phone?: string
  address?: string
  contactName?: string
  isActive: boolean
  createdAt: string
  isDeleted?: boolean
}

export type ProductGroupRecord = {
  id: string
  code: string
  name: string
  color: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  isDeleted?: boolean
}

export type ProductUnitRecord = {
  id: string
  name: string
  factor: number
  barcode?: string
  /** 1 hoặc 2, theo hệ số tăng dần */
  sortOrder: number
}

export type ProductRecord = {
  id: string
  code: string
  name: string
  groupId: string
  baseUnit: string
  barcode?: string
  spec?: string
  imageUrl?: string
  isActive: boolean
  /** Đơn vị quy đổi lồng trong mặt hàng (tối đa 2) */
  units: ProductUnitRecord[]
  createdAt: string
  isDeleted?: boolean
}

/** Inventory_StockLevels: tồn, giá trị, giá vốn của mặt hàng tại kho; không lưu khả dụng, trạng thái */
export type StockLevelRecord = {
  id: string
  warehouseId: string
  productId: string
  onHand: number
  stockValue: number
  avgCost: number
  minQty?: number | null
  maxQty?: number | null
  lastIssueAt?: string | null
  firstReceiptAt?: string | null
  version: number
}

/** Cột chung của phiếu nhập, xuất, chuyển */
type DocRecordBase = {
  id: string
  code?: string
  version: number
  createdById: string
  createdByName: string
  createdAt: string
  updatedAt: string
  submittedAt?: string
  approvedById?: string
  approvedByName?: string
  approvedAt?: string
  rejectedById?: string
  rejectedByName?: string
  rejectedAt?: string
  rejectReason?: string
  cancelledById?: string
  cancelledByName?: string
  cancelledAt?: string
  /** Tạo phiếu (07 §3.8) */
  clientRequestId?: string | null
  /** Thao tác gần nhất */
  lastRequestId?: string | null
}

/** Dòng phiếu nhập: đủ trường của DTO (giá trị luôn có, ẩn khi đọc theo BR-25) */
export type GoodsReceiptLineRecord = Required<
  Pick<GoodsReceiptLineDto, 'unitPrice' | 'amount' | 'allocatedCost' | 'value' | 'landedUnitPrice'>
> &
  Omit<GoodsReceiptLineDto, 'unitPrice' | 'amount' | 'allocatedCost' | 'value' | 'landedUnitPrice'>

export type GoodsReceiptRecord = DocRecordBase & {
  warehouseId: string
  type: ReceiptType
  status: DocStatus
  supplierId?: string
  delivererName?: string
  sourceDocNo?: string
  sourceDocDate?: string
  note?: string
  freightCost: number
  totalAmount: number
  totalValue: number
  /** Phiếu xuất gốc khi đây là phiếu ngược (Nhập điều chỉnh) */
  reversalOfId?: string
  lines: GoodsReceiptLineRecord[]
}

export type GoodsIssueLineRecord = Omit<GoodsIssueLineDto, 'preview'>

export type GoodsIssueRecord = DocRecordBase & {
  warehouseId: string
  type: IssueType
  status: DocStatus
  recipientName?: string
  supplierId?: string
  orderRef?: string
  reason?: string
  /** Có khi đã duyệt */
  totalValue?: number
  /** Phiếu nhập gốc khi đây là phiếu ngược (Xuất điều chỉnh) */
  reversalOfId?: string
  lines: GoodsIssueLineRecord[]
}

export type TransferLineRecord = Omit<TransferLineDto, 'preview'>

export type TransferRecord = DocRecordBase & {
  fromWarehouseId: string
  toWarehouseId: string
  status: TransferStatus
  note?: string
  receivedById?: string
  receivedByName?: string
  receivedAt?: string
  totalValue?: number
  shortageValue?: number
  lines: TransferLineRecord[]
}

export type StocktakeLineRecord = {
  id: string
  productId: string
  productCode: string
  productName: string
  groupId: string
  groupName: string
  baseUnit: string
  bookQuantity: number
  bookCost: number
  countedQuantity?: number | null
  difference?: number | null
  differenceValue?: number | null
  differencePercent?: number | null
  reasonRequired: boolean
  reason?: VarianceReason | null
  reasonNote?: string | null
  needsRecount: boolean
  recountNote?: string | null
  isAdded: boolean
  lastCountedById?: string | null
  lastCountedByName?: string | null
  lastCountedAt?: string | null
  sortOrder: number
}

export type StocktakeRecord = {
  id: string
  code: string
  warehouseId: string
  scopeAll: boolean
  /** Nhóm hàng khi không toàn kho */
  groupIds: string[]
  status: StocktakeStatus
  version: number
  snapshotAt: string
  createdById: string
  createdByName: string
  createdAt: string
  updatedAt: string
  counterId: string
  counterName: string
  /** Mọi người đã gửi lượt đếm (BR-06: người duyệt khác họ, quyết định 21) */
  counterIds: string[]
  submittedById?: string
  submittedByName?: string
  submittedAt?: string
  approvedById?: string
  approvedByName?: string
  approvedAt?: string
  cancelledById?: string
  cancelledByName?: string
  cancelledAt?: string
  note?: string
  returnNote?: string
  surplusValue?: number
  shortageValue?: number
  clientRequestId?: string | null
  lastRequestId?: string | null
  /** Inventory_StocktakeCounts: mã lượt đếm đã nhận (gửi lại cùng mã thì không cộng lần hai) */
  countRequestIds: string[]
  lines: StocktakeLineRecord[]
}

/** Inventory_StockLedger: dòng thẻ kho */
export type LedgerRecord = {
  id: string
  warehouseId: string
  productId: string
  postedAt: string
  /** LineNo của dòng phiếu */
  seq: number
  docType: LedgerDocType
  docKind: DocKind
  docId: string
  docCode: string
  docLineId: string
  /** ReceiptType hoặc IssueType của phiếu */
  subType?: ReceiptType | IssueType | null
  /** Kho kia của phiếu chuyển */
  counterpartWarehouseId?: string | null
  description: string
  inQuantity: number
  outQuantity: number
  balanceQuantity: number
  unitCost: number
  inValue: number
  outValue: number
  balanceValue: number
  avgCostAfter: number
}

/** Mốc nạp seed: mọi thời điểm tương đối trong demo-data.json tính theo `now` này (06 §5.3) */
export type SeedAnchorRecord = { id: 'anchor'; now: number }
