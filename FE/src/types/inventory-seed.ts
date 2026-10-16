/**
 * Kiểu của src/mock/seed/demo-data.json (docs/06-THIET-KE-CSDL.md §5). FE mock nạp file bằng các kiểu này;
 * BE DemoDataSeeder đọc cùng file với bản ghi C# cùng tên trường. Không dùng ngoài bộ nạp seed.
 *
 * Mốc thời gian (`TimeToken`):
 * - chuỗi `"{n}@HH:mm"`: n ngày trước hôm nay (ngày theo giờ Việt Nam), lúc HH:mm giờ Việt Nam;
 * - số nguyên âm: số phút so với lúc nạp (`now` làm tròn xuống phút), dùng cho chứng từ hôm nay.
 */
import type { IssueType, ReceiptType, VarianceReason } from '@/types/inventory'

export type TimeToken = string | number
/** [thời điểm, tên đăng nhập] */
export type ActedBy = [TimeToken, string]

export type SeedImageKind = { key: string; name: string; describe: string }
export type SeedProductGroup = { code: string; name: string; color: string }
export type SeedWarehouse = {
  code: string
  name: string
  address: string
  phone: string
  /** Tên đăng nhập thủ kho được gán */
  keepers: string[]
  active?: boolean
}
export type SeedSupplier = {
  code: string
  name: string
  taxCode: string
  phone: string
  address: string
  contactName: string
  active?: boolean
}
export type SeedRecipient = { name: string; warehouse: string }
export type SeedProduct = {
  code: string
  name: string
  group: string
  unit: string
  barcode: string
  spec: string
  /** Khóa trong imageKinds → ImageUrl = /seed/products/{image}.webp */
  image: string
  /** [tên, hệ số, mã vạch] theo thứ tự hệ số tăng dần, tối đa 2 */
  units: [string, number, string][]
  /** Kho có kinh doanh mặt hàng: [tồn tối thiểu, tồn tối đa] theo đơn vị cơ bản, null = không đặt */
  stock: Record<string, [number | null, number | null]>
  /** Nhà cung cấp chính, cỡ bán, giá tham chiếu: chỉ script sinh dữ liệu dùng, seeder bỏ qua */
  supplier: string
  tier: 'A' | 'B' | 'C'
  refCost: number
}

/** Chung của chứng từ; vắng `sb` = chưa từng gửi; có `rj` mà không `sb2` = đang Từ chối */
type SeedDocBase = {
  /** Khóa trong file, dùng cho stableId và tham chiếu phiếu ngược; không lưu */
  id: string
  by: string
  cr: TimeToken
  sb?: TimeToken
  /** [thời điểm, người từ chối, lý do] lần từ chối gần nhất */
  rj?: [TimeToken, string, string]
  /** Gửi lại sau khi bị từ chối */
  sb2?: TimeToken
  /** Duyệt = ghi sổ */
  ap?: ActedBy
  /** Hủy */
  cx?: ActedBy
}
export type SeedReceipt = SeedDocBase & {
  w: string
  t: ReceiptType
  s?: string
  /** [số chứng từ gốc, số ngày trước hôm nay] */
  inv?: [string, number]
  dl?: string
  f?: number
  nt?: string
  /** Khóa phiếu xuất gốc khi là phiếu ngược */
  rv?: string
  /** [mã hàng, chỉ số đơn vị (0 = cơ bản, 1 = units[0], 2 = units[1]), số lượng, đơn giá theo đơn vị đó] */
  ln: [string, number, number, number][]
}
export type SeedIssue = SeedDocBase & {
  w: string
  t: IssueType
  rc?: string
  s?: string
  or?: string
  why?: string
  rv?: string
  /** [mã hàng, chỉ số đơn vị, số lượng] */
  ln: [string, number, number][]
}
export type SeedTransfer = SeedDocBase & {
  fw: string
  tw: string
  nt?: string
  ln: [string, number, number][]
  /** Nhận hàng: [thời điểm, người nhận, [[chỉ số dòng, số lượng thiếu theo đơn vị cơ bản]]?] */
  re?: [TimeToken, string] | [TimeToken, string, [number, number][]]
}
export type SeedStocktake = {
  id: string
  w: string
  /** "all" hoặc mã nhóm hàng */
  sc: 'all' | string[]
  by: string
  /** Người đếm */
  ct: string
  cr: TimeToken
  sb?: TimeToken
  ap?: ActedBy
  cx?: ActedBy
  /** Dòng chênh lệch: [mã hàng, chênh lệch (đếm − sổ), nguyên nhân?, ghi chú?]; dòng vắng mặt đếm bằng sổ sách */
  df: [string, number, VarianceReason?, string?][]
}

export type DemoDataFile = {
  imageKinds: SeedImageKind[]
  productGroups: SeedProductGroup[]
  warehouses: SeedWarehouse[]
  suppliers: SeedSupplier[]
  recipients: SeedRecipient[]
  products: SeedProduct[]
  receipts: SeedReceipt[]
  issues: SeedIssue[]
  transfers: SeedTransfer[]
  stocktakes: SeedStocktake[]
}
