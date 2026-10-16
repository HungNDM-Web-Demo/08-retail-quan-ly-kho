# Danh sách API — Quản lý Kho

> Base URL dev: `https://localhost:7108` · Swagger: `https://localhost:7108/swagger`
> Demo công khai (chế độ `mock`, không có BE): `https://pum-quan-ly-kho.vercel.app`.
> Quy ước chung (đường dẫn, phân trang, lỗi) và API nền (auth, users, roles, settings, audit-logs, demo): xem `ZDOCS/03-KIEN-TRUC/QUY-UOC-API.md`.
> File này là **hợp đồng giữa BE và FE**: BE (`Application/DTOs`) và FE (`FE/src/types/inventory.ts`, chép đúng các khối `ts` dưới đây) phải khớp từng trường. Ở chế độ `mock`, handler trả đúng các kiểu này, áp đúng công thức ở §3 và câu lỗi ở §2.12. Bảng, enum, dữ liệu mẫu, số đối chiếu: `06-THIET-KE-CSDL.md`.

---

## 1. Mã quyền nghiệp vụ

Đúng `02-SRS.md` §7; các mã ghép `create / update / delete` tách thành từng mã. `ADMIN` luôn đủ quyền. Khai báo trong `FE/src/mock/seed/project.json` (đã có), `Application/Constants/Permissions.cs`, FE `config/permissions.ts` (đã có). Vai trò đổi tên: `MANAGER` "Quản lý kho", `STAFF` "Thủ kho".

| Nhóm | Mã quyền | Tên hiển thị | ADMIN | MANAGER | STAFF |
| :--- | :--- | :--- | :---: | :---: | :---: |
| Hàng hóa | `products.view` | Xem hàng hóa, nhóm hàng | ✓ | ✓ | ✓ |
| Hàng hóa | `products.create` | Thêm nhóm hàng, mặt hàng | ✓ | ✓ | |
| Hàng hóa | `products.update` | Sửa, ngừng mặt hàng; đặt tồn tối thiểu, tối đa | ✓ | ✓ | |
| Hàng hóa | `products.delete` | Xóa mặt hàng, nhóm hàng chưa có chứng từ | ✓ | ✓ | |
| Kho | `warehouses.view` | Xem kho | ✓ | ✓ | ✓ |
| Kho | `warehouses.create` | Thêm kho | ✓ | ✓ | |
| Kho | `warehouses.update` | Sửa, ngừng hoạt động kho | ✓ | ✓ | |
| Kho | `warehouses.delete` | Xóa kho chưa có chứng từ | ✓ | ✓ | |
| Kho | `warehouses.assign` | Gán kho cho thủ kho | ✓ | ✓ | |
| Nhà cung cấp | `suppliers.view` | Xem nhà cung cấp | ✓ | ✓ | ✓ |
| Nhà cung cấp | `suppliers.create` | Thêm nhà cung cấp | ✓ | ✓ | |
| Nhà cung cấp | `suppliers.update` | Sửa, ngừng giao dịch nhà cung cấp | ✓ | ✓ | |
| Nhà cung cấp | `suppliers.delete` | Xóa nhà cung cấp chưa có chứng từ | ✓ | ✓ | |
| Phiếu nhập | `goods-receipts.view` | Xem, in phiếu nhập | ✓ | ✓ | ✓ |
| Phiếu nhập | `goods-receipts.create` | Lập phiếu nhập | ✓ | ✓ | ✓ |
| Phiếu nhập | `goods-receipts.update` | Sửa, gửi duyệt, rút lại phiếu nhập | ✓ | ✓ | ✓ |
| Phiếu nhập | `goods-receipts.delete` | Hủy phiếu nhập nháp hoặc bị từ chối | ✓ | ✓ | ✓ |
| Phiếu nhập | `goods-receipts.approve` | Duyệt, từ chối phiếu nhập | ✓ | ✓ | |
| Phiếu nhập | `goods-receipts.reverse` | Tạo phiếu ngược của phiếu nhập | ✓ | ✓ | |
| Phiếu xuất | `goods-issues.view` | Xem, in phiếu xuất | ✓ | ✓ | ✓ |
| Phiếu xuất | `goods-issues.create` | Lập phiếu xuất | ✓ | ✓ | ✓ |
| Phiếu xuất | `goods-issues.update` | Sửa, gửi duyệt, rút lại phiếu xuất | ✓ | ✓ | ✓ |
| Phiếu xuất | `goods-issues.delete` | Hủy phiếu xuất nháp hoặc bị từ chối | ✓ | ✓ | ✓ |
| Phiếu xuất | `goods-issues.approve` | Duyệt, từ chối phiếu xuất | ✓ | ✓ | |
| Phiếu xuất | `goods-issues.reverse` | Tạo phiếu ngược của phiếu xuất | ✓ | ✓ | |
| Chuyển kho | `transfers.view` | Xem, in phiếu chuyển kho | ✓ | ✓ | ✓ |
| Chuyển kho | `transfers.create` | Lập phiếu chuyển kho | ✓ | ✓ | ✓ |
| Chuyển kho | `transfers.update` | Sửa, gửi duyệt, rút lại phiếu chuyển | ✓ | ✓ | ✓ |
| Chuyển kho | `transfers.delete` | Hủy phiếu chuyển nháp hoặc bị từ chối | ✓ | ✓ | ✓ |
| Chuyển kho | `transfers.approve` | Duyệt, từ chối phiếu chuyển | ✓ | ✓ | |
| Chuyển kho | `transfers.receive` | Xác nhận nhận hàng chuyển đến | ✓ | ✓ | ✓ |
| Tồn kho | `stock-levels.view` | Xem tồn kho, thẻ kho, cảnh báo | ✓ | ✓ | ✓ |
| Tồn kho | `stock-values.view` | Xem giá vốn, giá trị tồn, giá trị xuất | ✓ | ✓ | |
| Kiểm kê | `stocktakes.view` | Xem phiếu kiểm kê | ✓ | ✓ | ✓ |
| Kiểm kê | `stocktakes.create` | Tạo phiếu kiểm kê | ✓ | ✓ | ✓ |
| Kiểm kê | `stocktakes.count` | Nhập số đếm, gửi duyệt kiểm kê | ✓ | ✓ | ✓ |
| Kiểm kê | `stocktakes.approve` | Duyệt, trả lại đếm lại phiếu kiểm kê | ✓ | ✓ | |
| Kiểm kê | `stocktakes.cancel` | Hủy phiếu kiểm kê chưa duyệt | ✓ | ✓ | |
| Báo cáo | `reports.view` | Xem tổng quan quản lý, báo cáo | ✓ | ✓ | |

Quyền nền `dashboard.view` có sẵn ở `MANAGER` và `STAFF` (`system.json`): trang `/dashboard` gắn quyền này; trang tự hiện Tổng quan quản lý khi có `reports.view`, còn lại hiện Việc cần làm của thủ kho (§4.1).

**Phạm vi kho** (BR-23, FR-05): người có `warehouses.assign` (Quản lý, Quản trị viên) thấy và thao tác mọi kho. Người không có quyền này (Thủ kho) chỉ thấy kho được gán ở `Inventory_WarehouseKeepers`:

- API danh sách (kho, tồn kho, cảnh báo, thẻ kho, phiếu, kiểm kê, Việc cần làm) chỉ trả dữ liệu của kho trong phạm vi; `warehouseId` ngoài phạm vi bị bỏ qua như không lọc (UC-08 E1, TC-06); FE xóa tham số đó khỏi URL.
- Phiếu chuyển thấy được khi kho đi **hoặc** kho đến trong phạm vi. Lập, sửa, gửi, rút, hủy phiếu chuyển cần kho đi trong phạm vi; nhận hàng cần kho đến trong phạm vi.
- Mở chi tiết, thao tác trên phiếu, kho ngoài phạm vi → 403 `KhongPhuTrachKho`.
- `ProductDto.stocks`, `byWarehouse`, `sources` chỉ gồm kho trong phạm vi.

---

## 2. API nghiệp vụ

Bảng tra enum dùng chung (chuỗi PascalCase, khớp `06` §4); chữ hiển thị, tông màu huy hiệu đặt sẵn ở `FE/src/config/inventory-labels.ts`:

```ts
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
```

Kiểu dùng chung cho mọi thao tác:

```ts
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
```

Quy ước chung của các API dưới đây:

- Tham số ngày `from`, `to` dạng `yyyy-MM-dd`, hiểu theo giờ Việt Nam (00:00 `from` đến hết 23:59:59 `to`). Khoảng dài hơn 366 ngày → 400 `errors.from` "Khoảng ngày tối đa 366 ngày" (UC-09 E2, UC-13 E1); `to` nhỏ hơn `from` → 400 `errors.to` "Ngày kết thúc phải sau ngày bắt đầu". Lọc phiếu theo ngày dùng **ngày chứng từ** = ngày của `approvedAt` (đã ghi sổ), không có thì `submittedAt`, không có thì `createdAt`.
- Thao tác đổi trạng thái (`PATCH …/{hanh-dong}`) trả **200 kèm DTO mới** (không 204) để FE thay cache ngay; tạo phiếu (kể cả phiếu ngược) trả 201. Mọi thao tác trên phiếu có sẵn gửi `version` và `clientRequestId` (§3.8).
- Trường giá trị (đơn giá, giá vốn, giá trị) là null khi người gọi không được xem (BR-25): cần `stock-values.view`; riêng phiếu nhập do chính mình lập thì thấy và nhập được đơn giá, chi phí mua hàng. Mỗi DTO có `canViewValues` để FE ẩn cột. BE không nhận đơn giá, chi phí từ người không được xem (bỏ qua, giữ giá trị cũ).
- Danh sách phiếu mặc định sắp `createdAt` giảm dần; `search` theo mã phiếu và các ô chữ chính ghi ở từng mục.

### 2.1. Kho — `/api/warehouses`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/warehouses` | `warehouses.view` | Kho trong phạm vi, cả kho ngừng, theo `sortOrder` → `WarehouseDto[]` |
| GET | `/api/warehouses/my` | Đã đăng nhập | Kho trong phạm vi → `WarehouseOption[]`; dùng cho mọi ô chọn kho, bộ lọc kho (TC-04, TC-06). FE chỉ cho chọn kho `isActive` vào phiếu mới |
| GET | `/api/warehouses/options` | `transfers.view` | Mọi kho **đang hoạt động**, không theo phạm vi → `WarehouseOption[]`; chỉ dùng cho ô "Kho đến" của phiếu chuyển (§5 #46) |
| GET | `/api/warehouses/keeper-candidates` | `warehouses.assign` | Tài khoản vai trò `STAFF` đang hoạt động kèm kho đang phụ trách → `KeeperCandidate[]` |
| GET | `/api/warehouses/{id}` | `warehouses.view` | → `WarehouseDto` |
| POST | `/api/warehouses` | `warehouses.create` | `SaveWarehouseRequest` → `WarehouseDto` (201), `sortOrder` = max + 10 |
| PUT | `/api/warehouses/{id}` | `warehouses.update` | → `WarehouseDto`; đổi mã kho đã có chứng từ → 400 `errors.code` "Kho đã có chứng từ, không đổi mã được" |
| PATCH | `/api/warehouses/{id}/status` | `warehouses.update` | `SetActiveRequest` → `WarehouseDto`; ngừng khi còn tồn hoặc phiếu chưa kết thúc → 400 `KhoConTon` (TC-05) |
| PUT | `/api/warehouses/{id}/keepers` | `warehouses.assign` | `AssignKeepersRequest` (đủ danh sách) → `WarehouseDto`; có id không phải thủ kho đang hoạt động → 400 `errors.userIds` "Chỉ gán tài khoản vai trò Thủ kho đang hoạt động". Có hiệu lực ở request kế tiếp của thủ kho (UC-02 bước 4) |
| DELETE | `/api/warehouses/{id}` | `warehouses.delete` | Chưa có chứng từ, tồn → 204; có → 400 `DaCoChungTu` |

```ts
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
```

Lỗi: `code` sai dạng → 400 `errors.code` "Mã kho 2–10 ký tự chữ in hoa và số"; trùng → 409 `errors.code` "Mã kho đã tồn tại" (UC-02 E1); `name` trống → `errors.name` "Nhập tên kho"; `phone` sai → `errors.phone` "Số điện thoại không hợp lệ" (`lib/validators.ts` của nền).

### 2.2. Nhà cung cấp — `/api/suppliers`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/suppliers?page&pageSize&search&isActive` | `suppliers.view` | `search` theo mã, tên (không dấu), mã số thuế, số điện thoại; mặc định sắp `code` tăng → `PaginatedResult<SupplierDto>` |
| GET | `/api/suppliers/options` | `suppliers.view` hoặc `goods-receipts.create` hoặc `goods-issues.create` | Mọi nhà cung cấp chưa xóa → `SupplierOption[]` cho ô chọn (chỉ chọn được `isActive`) |
| GET | `/api/suppliers/{id}` | `suppliers.view` | → `SupplierDto` |
| POST | `/api/suppliers` | `suppliers.create` | `SaveSupplierRequest` → `SupplierDto` (201); `code` trống → BE cấp `NCC` + 3 số kế tiếp |
| PUT | `/api/suppliers/{id}` | `suppliers.update` | → `SupplierDto` |
| PATCH | `/api/suppliers/{id}/status` | `suppliers.update` | `SetActiveRequest` → `SupplierDto` ("Ngừng giao dịch") |
| DELETE | `/api/suppliers/{id}` | `suppliers.delete` | Chưa có chứng từ → 204; có → 400 `DaCoChungTu` |

```ts
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
```

Lỗi: `code` sai dạng → `errors.code` "Mã nhà cung cấp dạng NCC001"; trùng → 409 `errors.code` "Mã nhà cung cấp đã tồn tại"; `name` trống → `errors.name` "Nhập tên nhà cung cấp"; `taxCode` sai → `errors.taxCode` "Mã số thuế gồm 10 hoặc 13 chữ số".

### 2.3. Nhóm hàng, mặt hàng — `/api/product-groups`, `/api/products`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/product-groups` | Đã đăng nhập | Mọi nhóm chưa xóa theo `sortOrder` → `ProductGroupDto[]` (bộ lọc ở nhiều màn, phạm vi kiểm kê) |
| POST | `/api/product-groups` | `products.create` | `SaveProductGroupRequest` → `ProductGroupDto` (201), cuối danh sách |
| PUT | `/api/product-groups/{id}` | `products.update` | → `ProductGroupDto` |
| PATCH | `/api/product-groups/{id}/status` | `products.update` | `SetActiveRequest` → `ProductGroupDto` |
| DELETE | `/api/product-groups/{id}` | `products.delete` | Không còn mặt hàng → 204; còn → 400 `NhomConHang` |
| GET | `/api/products?page&pageSize&search&groupId&isActive` | `products.view` | `search` theo mã, tên gõ không dấu, mã vạch mọi đơn vị (FR-09); mặc định sắp `code` tăng → `PaginatedResult<ProductDto>` |
| GET | `/api/products/catalog` | `products.view` hoặc `goods-receipts.create` hoặc `goods-issues.create` hoặc `transfers.create` hoặc `stocktakes.count` | Mọi mặt hàng chưa xóa, gọn, theo `code` → `CatalogProduct[]`; FE giữ trong bộ nhớ để quét mã tại máy (NFR-02) |
| GET | `/api/products/by-barcode/{barcode}` | như `catalog` | → `BarcodeMatch`; không có → 404 `MaVachKhongTonTai` |
| GET | `/api/products/{id}` | `products.view` | → `ProductDetailDto` (`levels` đủ mọi kho đang hoạt động trong phạm vi) |
| POST | `/api/products` | `products.create` | `SaveProductRequest` → `ProductDetailDto` (201); tồn 0 ở mọi kho (UC-01 bước 6) |
| PUT | `/api/products/{id}` | `products.update` | → `ProductDetailDto`; chứng từ cũ giữ nguyên tên, đơn vị đã chụp (UC-01 1b) |
| PATCH | `/api/products/{id}/status` | `products.update` | `SetActiveRequest` → `ProductDto` ("Ngừng sử dụng", UC-01 1c) |
| DELETE | `/api/products/{id}` | `products.delete` | Chưa có chứng từ → 204; có → 400 `DaCoChungTu` (UC-01 E3) |

```ts
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
```

Lỗi (thứ tự: định dạng 400 → tham chiếu 400 → trùng 409):

- `code` sai dạng → `errors.code` "Mã hàng 3–20 ký tự gồm chữ in hoa, số, dấu -"; trùng → 409 `errors.code` "Mã hàng đã dùng cho {tên mặt hàng}" (TC-02 bước 1).
- `name` trống → `errors.name` "Nhập tên mặt hàng"; `baseUnit` trống → `errors.baseUnit` "Nhập đơn vị cơ bản"; `groupId` không có hoặc nhóm ngừng → `errors.groupId` "Chọn nhóm hàng đang sử dụng".
- Mã vạch sai dạng → `errors.barcode` hoặc `errors["units[i].barcode"]` "Mã vạch chỉ gồm chữ số, dài 8–14 ký tự"; trùng với đơn vị bất kỳ của mặt hàng khác hoặc của chính mặt hàng → 409 cùng key "Mã vạch đã dùng cho {tên mặt hàng} – {tên đơn vị}" (TC-02 bước 2: "Mã vạch đã dùng cho Nước tăng lực hương dâu chai 330ml – Thùng 24").
- Quá 2 đơn vị → `errors.units` "Tối đa 2 đơn vị quy đổi"; `factor` ngoài 2–10.000 hoặc không nguyên → `errors["units[i].factor"]` "Hệ số là số nguyên từ 2 đến 10.000"; hai đơn vị trùng tên hoặc trùng hệ số → `errors["units[i].name"]` "Đơn vị bị trùng"; đổi hệ số hoặc xóa đơn vị `isUsed` → 400 `DonViDaDung`, `errors["units[i].factor"]` "Đơn vị đã có chứng từ" (TC-03; FE khóa ô hệ số trước khi gửi).
- Ngưỡng: số âm hoặc không nguyên → `errors["levels[i].minQty"]` "Tồn tối thiểu là số nguyên không âm"; `minQty ≥ maxQty` (cả hai có) → `errors["levels[i].minQty"]` "Tồn tối thiểu phải nhỏ hơn tồn tối đa" (TC-03, UC-01 E2).

### 2.4. Phiếu nhập — `/api/goods-receipts`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/goods-receipts?page&pageSize&search&warehouseId&type&status&supplierId&createdById&from&to` | `goods-receipts.view` | `search` theo mã phiếu, số hóa đơn, tên nhà cung cấp → `PaginatedResult<GoodsReceiptListItem>` (FR-20) |
| GET | `/api/goods-receipts/{id}` | `goods-receipts.view` | → `GoodsReceiptDto` |
| POST | `/api/goods-receipts` | `goods-receipts.create` | `SaveGoodsReceiptRequest` → `GoodsReceiptDto` (201) ở `Nhap`, hoặc `ChoDuyet` khi `submit = true` (cần thêm `goods-receipts.update`) |
| PUT | `/api/goods-receipts/{id}` | `goods-receipts.update` | Chỉ người lập, phiếu `Nhap` hoặc `TuChoi`; thay toàn bộ dòng; `submit = true` gửi luôn → `GoodsReceiptDto` |
| PATCH | `/api/goods-receipts/{id}/submit` | `goods-receipts.update` | `DocActionRequest`; người lập; `Nhap`/`TuChoi` → `ChoDuyet`, cấp mã nếu chưa có |
| PATCH | `/api/goods-receipts/{id}/withdraw` | `goods-receipts.update` | `DocActionRequest`; người lập; `ChoDuyet` → `Nhap` (UC-03 6b) |
| PATCH | `/api/goods-receipts/{id}/approve` | `goods-receipts.approve` | `DocActionRequest`; người duyệt khác người lập (BR-06); kiểm khóa kiểm kê (BR-14), ghi sổ (§3.3) → `DaDuyet` |
| PATCH | `/api/goods-receipts/{id}/reject` | `goods-receipts.approve` | `RejectRequest`; khác người lập → `TuChoi` |
| PATCH | `/api/goods-receipts/{id}/cancel` | `goods-receipts.delete` | `DocActionRequest`; `Nhap`/`TuChoi` → `DaHuy`; người lập, hoặc người có `goods-receipts.approve` (hủy phiếu của thủ kho đã bị bỏ gán, UC-02 3a) |
| POST | `/api/goods-receipts/{id}/reverse` | `goods-receipts.reverse` | `DocActionRequest` (`version` của phiếu gốc); phiếu `DaDuyet`, chưa có phiếu ngược → `GoodsIssueDto` (201): phiếu xuất nháp loại `XuatDieuChinh`, cùng kho, mỗi dòng gốc thành một dòng **đơn vị cơ bản** với `quantity = baseQuantity` gốc, `reason` "Phiếu ngược của {mã gốc}", người lập là người gọi (BR-12, UC-07 bước 3) |

```ts
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
```

Quy tắc khi lưu (lưu nháp chỉ kiểm định dạng; gửi duyệt kiểm đủ):

| Kiểm | Lưu nháp | Gửi duyệt | Lỗi |
| :--- | :---: | :---: | :--- |
| `warehouseId` trong phạm vi, đang hoạt động | ✓ | ✓ | 403 `KhongPhuTrachKho`; 400 `errors.warehouseId` "Kho {mã} đã ngừng hoạt động" |
| `type` là `MuaHang`, `HangBanTraLai`, `NhapKhac` (không tạo tay `NhapDieuChinh`) | ✓ | ✓ | `errors.type` "Chọn loại nhập" |
| `MuaHang` có `supplierId` đang giao dịch | | ✓ | `errors.supplierId` "Chọn nhà cung cấp" (TC-09 bước 1); ngừng → "Nhà cung cấp {mã} đã ngừng giao dịch" |
| `sourceDocDate` ≤ hôm nay | ✓ | ✓ | `errors.sourceDocDate` "Ngày chứng từ không được sau hôm nay" (TC-09 bước 3) |
| 1–200 dòng | ✓ (0 dòng được) | ✓ | `errors.lines` "Phiếu phải có ít nhất 1 dòng"; "Phiếu tối đa 200 dòng, hãy tách phiếu" (UC-03 E3) |
| `quantity` nguyên > 0 | ✓ | ✓ | `errors["lines[i].quantity"]` "Số lượng phải là số nguyên lớn hơn 0" (TC-09 bước 2) |
| `unitPrice` ≥ 0 | ✓ | ✓ | `errors["lines[i].unitPrice"]` "Đơn giá không được âm" |
| `unitId` thuộc mặt hàng; mặt hàng đang sử dụng | ✓ | ✓ | `errors["lines[i].productId"]` "{tên} đã ngừng sử dụng" |
| `freightCost` ≥ 0, số nguyên | ✓ | ✓ | `errors.freightCost` "Chi phí mua hàng không được âm" |

`HangBanTraLai`: FE điền sẵn đơn giá = giá vốn bình quân hiện tại của kho × hệ số đơn vị (lấy từ `GET /api/stock-levels?warehouseId` với người có quyền xem giá trị; thủ kho không thấy giá vốn thì để 0 cho quản lý sửa khi duyệt — xem §5 quyết định 9). `NhapKhac` cho đơn giá 0 (BR-07).

### 2.5. Phiếu xuất — `/api/goods-issues`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/goods-issues?page&pageSize&search&warehouseId&type&status&createdById&from&to` | `goods-issues.view` | `search` theo mã phiếu, người nhận, số đơn hàng → `PaginatedResult<GoodsIssueListItem>` |
| GET | `/api/goods-issues/{id}` | `goods-issues.view` | → `GoodsIssueDto`; phiếu `ChoDuyet` và người gọi có `goods-issues.approve` thì dòng có `preview` (UC-05 bước 2) |
| POST | `/api/goods-issues` | `goods-issues.create` | `SaveGoodsIssueRequest` → `GoodsIssueDto` (201) |
| PUT | `/api/goods-issues/{id}` | `goods-issues.update` | Như phiếu nhập |
| PATCH | `/api/goods-issues/{id}/submit` | `goods-issues.update` | Kiểm tồn khả dụng BR-04 → `ChoDuyet`, giữ chỗ (UC-04 bước 5) |
| PATCH | `/api/goods-issues/{id}/withdraw` | `goods-issues.update` | `ChoDuyet` → `Nhap`, bỏ giữ chỗ |
| PATCH | `/api/goods-issues/{id}/approve` | `goods-issues.approve` | Khác người lập; kiểm tồn thực (UC-05 E2), khóa kiểm kê (E3); ghi sổ §3.4 → `DaDuyet` |
| PATCH | `/api/goods-issues/{id}/reject` | `goods-issues.approve` | `RejectRequest` → `TuChoi`, giải phóng giữ chỗ (UC-05 3a) |
| PATCH | `/api/goods-issues/{id}/cancel` | `goods-issues.delete` | Như phiếu nhập |
| POST | `/api/goods-issues/{id}/reverse` | `goods-issues.reverse` | Phiếu `DaDuyet`, chưa có phiếu ngược → `GoodsReceiptDto` (201): phiếu nhập nháp loại `NhapDieuChinh`, cùng kho, mỗi dòng gốc thành một dòng đơn vị cơ bản với `quantity = baseQuantity`, `unitPrice = unitCost` gốc, `note` "Phiếu ngược của {mã gốc}" (BR-12, TC-20) |

```ts
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
```

Quy tắc khi lưu: kho như phiếu nhập; `type` là `XuatBan`, `TraNhaCungCap`, `DungNoiBo`, `XuatHuy`; dòng 1–200, số lượng nguyên > 0, mặt hàng đang sử dụng. Gửi duyệt thêm:

- `XuatBan` thiếu `recipientName` → `errors.recipientName` "Nhập người nhận" (TC-12 bước 1, UC-04 E2).
- `XuatHuy` thiếu `reason` → `errors.reason` "Nhập lý do xuất hủy" (TC-12 bước 2).
- `TraNhaCungCap` thiếu `supplierId` → `errors.supplierId` "Chọn nhà cung cấp nhận hàng trả".
- Tổng số lượng quy đổi theo mặt hàng vượt tồn khả dụng → 400 `VuotTonKhaDung` (§3.6, TC-11).

### 2.6. Chuyển kho — `/api/transfers`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/transfers?page&pageSize&search&warehouseId&fromWarehouseId&toWarehouseId&status&isLate&createdById&from&to` | `transfers.view` | `warehouseId` = kho đi hoặc kho đến; `isLate=true` lọc phiếu trễ (Tổng quan bấm thẻ "Đang chuyển") → `PaginatedResult<TransferListItem>` |
| GET | `/api/transfers/{id}` | `transfers.view` | → `TransferDto` (kèm `preview` như phiếu xuất khi `ChoDuyet` và người gọi có `transfers.approve`) |
| POST | `/api/transfers` | `transfers.create` | `SaveTransferRequest` → `TransferDto` (201) |
| PUT | `/api/transfers/{id}` | `transfers.update` | Như phiếu nhập |
| PATCH | `/api/transfers/{id}/submit` | `transfers.update` | Kiểm tồn khả dụng kho đi (BR-04) → `ChoDuyet` |
| PATCH | `/api/transfers/{id}/withdraw` | `transfers.update` | `ChoDuyet` → `Nhap` |
| PATCH | `/api/transfers/{id}/approve` | `transfers.approve` | Khác người lập; kiểm tồn thực, khóa kiểm kê ở kho đi; trừ kho đi (§3.5) → `DangChuyen` |
| PATCH | `/api/transfers/{id}/reject` | `transfers.approve` | `RejectRequest` → `TuChoi` |
| PATCH | `/api/transfers/{id}/cancel` | `transfers.delete` | `Nhap`/`TuChoi` → `DaHuy` |
| PATCH | `/api/transfers/{id}/receive` | `transfers.receive` | `ReceiveTransferRequest`; kho đến trong phạm vi; `DangChuyen`; kiểm khóa kiểm kê ở kho đến; cộng kho đến, ghi hao hụt (§3.5) → `DaNhan` (UC-06 bước 4) |

```ts
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
```

Lỗi riêng: kho đến trùng kho đi → `errors.toWarehouseId` "Kho đến phải khác kho đi" (TC-19 bước 1); kho đến ngừng → `errors.toWarehouseId` "Kho {mã} đã ngừng hoạt động"; nhận thiếu dòng → `errors.lines` "Nhập số thực nhận cho mọi dòng"; `receivedBaseQuantity` âm hoặc lớn hơn `baseQuantity` → `errors["lines[i].receivedBaseQuantity"]` "Không vượt số lượng chuyển {baseQuantity} {đơn vị cơ bản}" (TC-19 bước 2: "Không vượt số lượng chuyển 480 chai"); kho đến ngoài phạm vi → 403 `KhongPhuTrachKho` "Chỉ thủ kho phụ trách {mã kho đến} được xác nhận nhận hàng".

### 2.7. Duyệt, Phiếu chờ duyệt — `/api/approvals`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/approvals?kind&warehouseId&createdById` | Một trong `goods-receipts.approve`, `goods-issues.approve`, `transfers.approve`, `stocktakes.approve` | Mọi phiếu `ChoDuyet` thuộc loại người gọi duyệt được, sắp `submittedAt` tăng dần (gửi trước lên trước, UC-05 bước 1) → `ApprovalItem[]` (không phân trang) |

Duyệt, từ chối gọi đúng endpoint của từng loại (§2.4–2.6, §2.9). Quy tắc chung:

1. Người duyệt khác người lập, kể cả khi người lập là quản lý (BR-06); kiểm kê: khác người đếm (`counterId` và mọi người đã gửi lượt đếm). Vi phạm → 400 `NguoiDuyetTrungNguoiLap` "Người duyệt phải khác người lập" / "Người duyệt phải khác người đếm" (TC-16, UC-11 E4). FE đã khóa nút nhờ `ApprovalItem.canApprove`, `blockedReason`.
2. Lý do từ chối bắt buộc, sau khi bỏ khoảng trắng hai đầu tối thiểu 10 ký tự → 400 `errors.reason` "Lý do từ chối tối thiểu 10 ký tự" (TC-15 bước 1, UC-05 E4).
3. Duyệt kiểm tra lại BR-04 (tồn thực) và BR-14 (khóa kiểm kê), rồi ghi sổ và đổi trạng thái **trong một transaction** (NFR-03). Lỗi giữa chừng không đổi gì.
4. Phiếu không còn `ChoDuyet` (người khác vừa duyệt, người lập vừa rút): 409 `PhieuDaDuyet` hoặc 400 `TrangThaiKhongHopLe` (§3.8).

```ts
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
```

`typeText`: phiếu nhập "Phiếu nhập · {loại nhập}", phiếu xuất "Phiếu xuất · {loại xuất}", chuyển kho "Chuyển kho {mã kho đi} → {mã kho đến}", kiểm kê "Kiểm kê · Toàn kho" hoặc "Kiểm kê · {tên nhóm, ngăn bằng dấu phẩy}". `totalValue` của phiếu xuất, phiếu chuyển là giá trị dự kiến theo giá vốn hiện tại (null nếu người gọi không được xem giá trị).

### 2.8. Tồn kho, cảnh báo, thẻ kho — `/api/stock-levels`, `/api/stock-cards`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/stock-levels?page&pageSize&search&warehouseId&groupId&status&inStockOnly&sortBy&sortDir` | `stock-levels.view` | Một kho: mỗi dòng tồn của kho; trống `warehouseId`: mỗi mặt hàng có dòng tồn ở kho trong phạm vi một dòng, `byWarehouse` từng kho (UC-08 1a) → `StockListResult`; `search` mã, tên không dấu, mã vạch; mặc định sắp `productCode` tăng; `status` ở "Tất cả kho" lọc mặt hàng có ít nhất một kho mang trạng thái đó |
| GET | `/api/stock-levels/available?warehouseId` | `goods-issues.create` hoặc `transfers.create` hoặc `stock-levels.view` | Mọi dòng tồn của kho → `AvailabilityRow[]`; màn lập phiếu xuất, chuyển hiển thị khả dụng từng dòng (FR-14) |
| GET | `/api/stock-levels/reservations?warehouseId&productId` | `stock-levels.view` | Phiếu xuất, phiếu chuyển `ChoDuyet` đang giữ chỗ mặt hàng tại kho → `ReservationDto[]` (UC-08 bước 4, TC-21) |
| GET | `/api/stock-levels/alerts?warehouseId&status&groupId` | `stock-levels.view` | Dòng tồn có trạng thái khác `BinhThuong` **và có ngưỡng tương ứng** (§3.9) → `StockAlertDto[]`, sắp (`HetHang`, `DuoiToiThieu`, `VuotToiDa`), rồi mã hàng (FR-26) |
| GET | `/api/stock-cards?productId&warehouseId&from&to` | `stock-levels.view` | `warehouseId` trống = mọi kho trong phạm vi (UC-09 1a) → `StockCardDto` (FR-25, BR-20) |

```ts
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
```

Không có endpoint ghi tồn trực tiếp: tồn chỉ đổi qua duyệt phiếu, nhận hàng chuyển, duyệt kiểm kê (BR-05). Ngưỡng tồn sửa qua `PUT /api/products/{id}`.

### 2.9. Kiểm kê — `/api/stocktakes`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/stocktakes?page&pageSize&search&warehouseId&status&from&to` | `stocktakes.view` | → `PaginatedResult<StocktakeListItem>` |
| GET | `/api/stocktakes/{id}` | `stocktakes.view` | → `StocktakeDto`; kiểm kê mù (§3.7) |
| POST | `/api/stocktakes` | `stocktakes.create` | `CreateStocktakeRequest` → `StocktakeDto` (201) `DangKiem`, chốt sổ sách, cấp mã `KK` (UC-11 bước 2) |
| POST | `/api/stocktakes/{id}/counts` | `stocktakes.count` | `SubmitCountsRequest` (không cần `version`, nhiều máy đếm cùng lúc) → `StocktakeDto`; chỉ `DangKiem`; kho trong phạm vi |
| PATCH | `/api/stocktakes/{id}/fill-uncounted` | `stocktakes.count` | `DocActionRequest`; dòng chưa đếm lấy số đếm = sổ sách (BR-16, TC-27 bước 3) → `StocktakeDto` |
| PATCH | `/api/stocktakes/{id}/submit` | `stocktakes.count` | `SubmitStocktakeRequest` → `ChoDuyet` (UC-11 bước 5–6) |
| PATCH | `/api/stocktakes/{id}/approve` | `stocktakes.approve` | `DocActionRequest`; khác người đếm; điều chỉnh tồn, ghi thẻ kho, mở khóa (BR-17) → `DaCanBang` |
| PATCH | `/api/stocktakes/{id}/return` | `stocktakes.approve` | `ReturnStocktakeRequest`; `ChoDuyet` → `DangKiem`, dòng được chọn đánh dấu cần đếm lại (UC-11 7a) |
| PATCH | `/api/stocktakes/{id}/cancel` | `stocktakes.cancel` | `DocActionRequest`; `DangKiem`/`ChoDuyet` → `DaHuy`, không điều chỉnh, mở khóa (FR-31, TC-29) |

```ts
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
```

Lỗi riêng:

- Tạo khi kho đã có phiếu `DangKiem`/`ChoDuyet` → 409 `KhoDaCoPhieuKiemKe` (UC-11 E1, TC-29 bước 1).
- `scopeAll = false` mà `groupIds` rỗng → `errors.groupIds` "Chọn ít nhất một nhóm hàng"; phạm vi không có mặt hàng nào tồn ≠ 0 → 400 `KhongCoHangKiemKe`.
- `counterId` không phải người tạo và không phải thủ kho phụ trách kho → `errors.counterId` "Người đếm phải là thủ kho phụ trách kho {mã}".
- Lượt đếm: mặt hàng ngoài phạm vi → 400 `NgoaiPhamViKiemKe`, `errors["entries[i].productId"]`; số lượng âm hoặc không nguyên → `errors["entries[i].quantity"]` "Số lượng phải là số nguyên không âm"; `Dat` làm kết quả âm không thể xảy ra; `Cong` cộng vào dòng chưa đếm tính từ 0.
- Gửi duyệt còn dòng chưa đếm → 400 `ConDongChuaDem` (UC-11 E2, TC-27 bước 2); dòng bắt buộc nguyên nhân chưa chọn → 400 `ThieuNguyenNhan` (E3); `Khac` thiếu ghi chú → `errors["reasons[i].note"]` "Nhập ghi chú cho nguyên nhân Khác".
- Trả lại không chọn dòng → `errors.lineIds` "Chọn ít nhất một dòng cần đếm lại"; thiếu ghi chú → `errors.note` "Nhập ghi chú cho người đếm".

### 2.10. Tổng quan, báo cáo — `/api/reports`

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/reports/dashboard` | `reports.view` | Tổng quan quản lý (FR-01, FR-02, §3.11) → `DashboardReport` |
| GET | `/api/reports/staff-todo` | `dashboard.view` | Việc cần làm của người gọi tại kho trong phạm vi (FR-03) → `StaffTodo`; không có số giá trị |
| GET | `/api/reports/inventory-movement?from&to&warehouseId&groupId` | `reports.view` | Xuất nhập tồn (FR-32, BR-21, §3.10) → `MovementReport` |
| GET | `/api/reports/slow-moving?warehouseId&groupId` | `reports.view` | Chậm luân chuyển (FR-34, BR-22) → `SlowMovingRow[]` sắp `stockValue` giảm dần |
| GET | `/api/reports/receipts-by-supplier?from&to&warehouseId` | `reports.view` | Phiếu nhập `MuaHang` đã duyệt trong kỳ theo nhà cung cấp → `SupplierReceiptRow[]` sắp `totalValue` giảm |
| GET | `/api/reports/issues-by-type?from&to&warehouseId` | `reports.view` | Phiếu xuất đã duyệt trong kỳ theo loại → `IssueTypeRow[]` (đủ 5 loại, kể cả 0) |
| GET | `/api/reports/stocktake-variances?from&to&warehouseId` | `reports.view` | Phiếu kiểm kê `DaCanBang` có `approvedAt` trong kỳ → `StocktakeVarianceRow[]` |
| GET | `/api/reports/transfer-losses?from&to&fromWarehouseId&toWarehouseId` | `reports.view` | Phiếu chuyển `DaNhan` có `receivedAt` trong kỳ, gom theo tuyến → `TransferLossRow[]` (chỉ tuyến có phiếu) |

```ts
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
```

Không gửi `from`, `to` ở báo cáo theo kỳ → 400 `errors.from` "Chọn khoảng ngày". FE mặc định "Tháng này" (UC-13 bước 1). Báo cáo chỉ thống kê theo `approvedAt` / `receivedAt` (thời điểm ghi sổ, BR-11). Xuất Excel (FR-36) và "Xuất dữ liệu kế toán" giả lập (SRS §2.4) làm ở FE từ các DTO này (§4.6), không có endpoint riêng.

### 2.11. Bản in và đơn vị in trên chứng từ

| Method | Đường dẫn | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| GET | `/api/store-profile` | Đã đăng nhập | Khóa `Store.*` và `Brand.LogoUrl` → `StoreProfile` (thủ kho in phiếu không cần `settings.view`) |

Bản in không có endpoint riêng: route group `app/(print)` có `AuthGuard`, không sidebar, khổ A4 dọc `@page { size: A4 portrait; margin: 12mm }`, chữ ≥ 11 pt, bảng có `thead { display: table-header-group }` để lặp tiêu đề cột khi nhiều trang (NFR-06); tự `window.print()` khi mở với `?print=1`. Mở từ nút "In" bằng tab mới. Phiếu chưa duyệt vẫn in được, có dòng chữ chìm "CHƯA DUYỆT". Người không được xem giá trị: cột đơn giá, thành tiền để trống, không có dòng tiền bằng chữ.

| Route | Quyền | Nội dung (theo bố cục mẫu, không ghi số hiệu thông tư) |
| :--- | :--- | :--- |
| `/print/goods-receipts/[id]` | `goods-receipts.view` | **01-VT** "PHIẾU NHẬP KHO": góc trái "Đơn vị: {Store.Name}", "Địa chỉ: {Store.Address}"; góc phải "Mẫu số 01 - VT"; ngày ghi sổ (chưa duyệt: ngày lập), "Số: {mã}", "Nợ: …… Có: ……" để trống; "Họ và tên người giao: {delivererName}"; "Theo {số chứng từ gốc} ngày {ngày} của {nhà cung cấp}"; "Nhập tại kho: {tên kho} – Địa điểm: {địa chỉ kho}". Bảng: STT, Tên hàng, Mã số, Đơn vị tính, Số lượng (Theo chứng từ, Thực nhập — cùng `quantity`), Đơn giá (`landedUnitPrice`), Thành tiền (`value`); dòng Cộng; dòng nhỏ "Đã gồm chi phí mua hàng {freightCost} ₫ phân bổ theo giá trị"; "Tổng số tiền (viết bằng chữ): …" (§3.13); "Số chứng từ gốc kèm theo: …". Chữ ký: Người lập phiếu ({createdByName}), Người giao hàng ({delivererName}), Thủ kho, Kế toán trưởng ({Store.ChiefAccountantName}); dòng "Duyệt bởi {approvedByName} lúc {HH:mm dd/MM/yyyy}" |
| `/print/goods-issues/[id]` | `goods-issues.view` | **02-VT** "PHIẾU XUẤT KHO": như trên; "Họ và tên người nhận hàng: {recipientName hoặc tên nhà cung cấp}"; "Lý do xuất kho: {loại xuất}{ – reason}{ – Đơn hàng orderRef}"; "Xuất tại kho". Bảng: STT, Tên, Mã số, ĐVT, Số lượng (Yêu cầu, Thực xuất), Đơn giá (= `unitCost × factor`), Thành tiền (`value`); Cộng; tiền bằng chữ (TC-20: "Hai mươi hai triệu sáu trăm tám mươi nghìn đồng"). Chữ ký: Người lập phiếu, Người nhận hàng, Thủ kho, Kế toán trưởng, Giám đốc ({Store.DirectorName}) |
| `/print/transfers/[id]` | `transfers.view` | "PHIẾU CHUYỂN KHO NỘI BỘ": từ kho, tới kho, ngày duyệt, ngày nhận; bảng STT, Tên, Mã số, ĐVT, Số lượng chuyển, Thực nhận, Thiếu, Giá vốn chuyển, Giá trị; dòng "Hao hụt vận chuyển: {shortageValue}". Chữ ký: Người lập phiếu, Thủ kho xuất, Người vận chuyển, Thủ kho nhập |
| `/print/stocktakes/[id]` | `stocktakes.view` | **05-VT** "BIÊN BẢN KIỂM KÊ VẬT TƯ, CÔNG CỤ, SẢN PHẨM, HÀNG HÓA": "Thời điểm kiểm kê: {HH} giờ {mm} ngày {dd} tháng {MM} năm {yyyy}" (= `snapshotAt`); "Ban kiểm kê gồm: Ông/Bà {createdByName} – Trưởng ban; Ông/Bà {counterName} – Ủy viên"; "Đã kiểm kê kho {tên kho} có những mặt hàng dưới đây". Bảng: STT, Tên, Mã số, ĐVT, Đơn giá, Theo sổ sách (SL, Thành tiền), Theo kiểm kê (SL, Thành tiền), Chênh lệch Thừa (SL, Thành tiền), Thiếu (SL, Thành tiền), Nguyên nhân; dòng Cộng. Chữ ký: Giám đốc ("Ý kiến giải quyết số chênh lệch"), Kế toán trưởng, Thủ kho, Trưởng ban kiểm kê. Chỉ in khi `DaCanBang` hoặc `ChoDuyet` (FR-31); phiếu `DangKiem` in "Danh sách đếm" không có cột sổ sách |
| `/print/stock-card/[productId]?warehouseId&from&to` | `stock-levels.view` | "THẺ KHO": tên mặt hàng, mã, ĐVT, kho (hoặc "Mọi kho"), kỳ; bảng STT, Ngày ghi sổ, Số phiếu (Nhập, Xuất), Diễn giải, Số lượng (Nhập, Xuất, Tồn), Ký xác nhận của kế toán; dòng tồn đầu kỳ, cộng phát sinh, tồn cuối kỳ (UC-09 4a). Không in giá trị |

### 2.12. Bảng mã lỗi nghiệp vụ

Lỗi 400/403/404/409 nghiệp vụ có trường mở rộng `code` trong ProblemDetails để FE rẽ nhánh mà không so chuỗi; `detail` đúng câu dưới đây (FE hiển thị nguyên văn). Lỗi validate theo trường dùng `errors` như `QUY-UOC-API.md` §1.3; khi chỉ có một lỗi thì `detail` là chính câu đó. Số lượng trong câu là số nguyên định dạng `1.200`, đơn vị cơ bản viết thường ("chai", "túi"); tiền dạng `1.000.000 ₫`; giờ, ngày giờ Việt Nam.

| `code` | HTTP | `detail` | Nơi phát sinh, trường mở rộng |
| :--- | :---: | :--- | :--- |
| `DuLieuCu` | 409 | Phiếu vừa được cập nhật, đang tải lại | Mọi thao tác có `version` khi lệch; kèm `currentVersion` (§3.8) |
| `PhieuDaDuyet` | 409 | Phiếu {mã} đã được {họ tên} duyệt lúc {HH:mm dd/MM/yyyy} | Sửa, gửi, rút, duyệt, từ chối, hủy phiếu đã duyệt (hoặc đang chuyển, đã nhận, đã cân bằng) |
| `TrangThaiKhongHopLe` | 400 | Phiếu đang ở trạng thái {tên trạng thái}, không thực hiện được thao tác này | Mọi thao tác sai trạng thái khác (§3.8); kèm `docStatus` (§5 #48) |
| `KhongPhaiNguoiLap` | 400 | Chỉ người lập được sửa, gửi hoặc rút phiếu này | BR-05 |
| `NguoiDuyetTrungNguoiLap` | 400 | Người duyệt phải khác người lập · kiểm kê: Người duyệt phải khác người đếm | BR-06 (TC-16, UC-11 E4) |
| `KhongPhuTrachKho` | 403 | Bạn không phụ trách kho {mã kho} · nhận hàng: Chỉ thủ kho phụ trách {mã kho} được xác nhận nhận hàng | BR-23 |
| `VuotTonKhaDung` | 400 | Vượt tồn khả dụng {n} {đơn vị cơ bản} · nhiều dòng: Có {k} dòng vượt tồn khả dụng | Gửi duyệt phiếu xuất, chuyển (BR-04, TC-11: "Vượt tồn khả dụng 20 túi"); `errors["lines[i].quantity"]` cùng câu cho từng dòng; kèm `lines: { index, productId, requested, available, excess }[]` |
| `KhongDuTonThuc` | 400 | Không đủ tồn thực: {tên hàng} thiếu {n} {đơn vị cơ bản} | Duyệt phiếu xuất, chuyển (UC-05 E2); dòng đầu tiên thiếu trong câu, kèm `shortages: { productId, productName, required, onHand, missing }[]` |
| `DangKiemKe` | 400 | {tên hàng} đang kiểm kê tại {mã kho} ({mã phiếu kiểm kê}) | Duyệt nhập, xuất, chuyển đi; nhận chuyển đến (BR-14, TC-28: "Dầu ăn thực vật chai 1L đang kiểm kê tại KTD (KK…)"); kèm `stocktakeId`, `stocktakeCode`, `productIds` |
| `KhoDaCoPhieuKiemKe` | 409 | Kho {mã kho} đang có phiếu kiểm kê {mã} chưa kết thúc | Tạo kiểm kê (TC-29); kèm `stocktakeId` |
| `KhongCoHangKiemKe` | 400 | Phạm vi kiểm kê không có mặt hàng nào còn tồn | Tạo kiểm kê |
| `NgoaiPhamViKiemKe` | 400 | {tên hàng} không thuộc phạm vi phiếu kiểm kê | Lượt đếm |
| `ConDongChuaDem` | 400 | Còn {n} dòng chưa đếm | Gửi duyệt kiểm kê (TC-27); kèm `uncountedLineIds` |
| `ThieuNguyenNhan` | 400 | Chọn nguyên nhân cho {n} dòng chênh lệch lớn | Gửi duyệt kiểm kê (UC-11 E3); kèm `requiredLines: { lineId, productName, difference, differencePercent, differenceValue? }[]` |
| `KhoConTon` | 400 | Kho {mã} còn {n} mặt hàng tồn và {m} phiếu chưa kết thúc, không ngừng hoạt động được | Ngừng kho (BR-24, TC-05); kèm `productCount`, `openDocumentCount` |
| `DaCoChungTu` | 400 | {Mặt hàng / Kho / Nhà cung cấp} đã có chứng từ, không xóa được. Hãy dùng Ngừng | Xóa danh mục (BR-24, UC-01 E3) |
| `NhomConHang` | 400 | Nhóm hàng đang có {n} mặt hàng, chuyển mặt hàng sang nhóm khác trước | Xóa nhóm; kèm `productCount` |
| `DonViDaDung` | 400 | Đơn vị đã có chứng từ | Đổi hệ số, xóa đơn vị đã dùng (TC-03); `errors["units[i].factor"]` |
| `MaVachTrung` | 409 | Mã vạch đã dùng cho {tên mặt hàng} – {tên đơn vị} | Lưu mặt hàng (TC-02); `errors` tại ô mã vạch |
| `MaVachKhongTonTai` | 404 | Không tìm thấy mã {mã vạch} | Tra mã vạch (UC-03 E2) |
| `PhieuNguocDaCo` | 409 | Phiếu {mã gốc} đã có phiếu ngược {mã hoặc "nháp"} | Tạo phiếu ngược lần hai (BR-12) |
| `KhongTaoPhieuNguoc` | 400 | Chỉ tạo phiếu ngược từ phiếu đã duyệt, không phải phiếu điều chỉnh | Phiếu chưa duyệt, hoặc chính là phiếu ngược (§5 quyết định 7) |

---

## 3. Công thức và quy tắc (nguồn sự thật chung của BE, FE và mock)

FE mock dùng **một** thư viện `FE/src/features/inventory/lib/` (`uom.ts`, `costing.ts`, `stock-rules.ts`, `doc-codes.ts`, `amount-in-words.ts`) cho cả giao diện (tính trước khi gửi) và handler; BE dùng `Domain/Entities/Inventory/StockMath.cs`, `InventoryRules.cs` và `StockPostingService`. Mọi số tiền là số nguyên đồng.

### 3.1. Quy đổi và cách đọc (BR-01)

- `baseQuantity = quantity × factor`; đơn vị cơ bản có `factor = 1`, `unitId = null`.
- **Cách đọc** `readQuantity(q, baseUnit, units)`: lấy các đơn vị quy đổi xếp hệ số giảm dần; với mỗi đơn vị `n = floor(q ÷ factor)`, `n > 0` thì ghi "`n` `tên ngắn`" rồi `q −= n × factor`; cuối cùng `q > 0` thì ghi "`q` `đơn vị cơ bản`"; nối bằng khoảng trắng; tổng 0 thì "0 {đơn vị cơ bản}". **Tên ngắn** = tên đơn vị bỏ phần số cuối, viết thường ("Thùng 24" → "thùng"); đơn vị cơ bản viết thường ("Chai" → "chai"). Ví dụ: 568 chai, Thùng 24 → "23 thùng 16 chai"; 4.800 → "200 thùng"; 90 → "3 thùng 18 chai"; 80 túi, Thùng 4 → "20 thùng"; 30 lon, Lốc 6 và Thùng 24 → "1 thùng 1 lốc"; 7 lon → "1 lốc 1 lon".
- Ô nhập số lượng theo "thùng + lẻ" (kiểm kê, nhận hàng): `baseQuantity = thùng × factor + lẻ`.

### 3.2. Chi phí mua hàng (BR-08)

```
amount[i]   = quantity[i] × unitPrice[i]
total       = Σ amount
allocated[i] = round(freight × amount[i] ÷ total)      với mọi dòng trừ dòng cuối (theo lineNo)
allocated[last] = freight − Σ allocated[các dòng khác]
value[i]    = amount[i] + allocated[i]
landedUnitPrice[i] = round(value[i] ÷ quantity[i])      // "đơn giá nhập kho", chỉ hiển thị
```

`total = 0` (mọi dòng giá 0) mà có chi phí: phân bổ theo `baseQuantity` thay cho `amount`. `round` là làm tròn tới 1 ₫, từ 0,5 làm tròn lên; viết bằng số nguyên để tránh sai số dấu phẩy động: `round(a ÷ b) = floor((2a + b) ÷ (2b))` với `a ≥ 0`, `b > 0`.

### 3.3. Duyệt phiếu nhập: giá vốn bình quân gia quyền tức thời (BR-09)

Với từng dòng theo `lineNo`, tại kho của phiếu (`Q` tồn, `V` giá trị tồn, `C` giá vốn của dòng tồn):

```
q = baseQuantity, v = value (đã gồm chi phí phân bổ)
C ← round((V + v) ÷ (Q + q))
V ← V + v
Q ← Q + q
thẻ kho: InQuantity = q, InValue = v, UnitCost = round(v ÷ q), BalanceQuantity = Q, BalanceValue = V, AvgCostAfter = C
FirstReceiptAt ← ApprovedAt nếu đang null
```

Nhiều dòng cùng mặt hàng trong một phiếu tính lần lượt (mỗi dòng một dòng thẻ kho). `V` cộng đúng `v`, **không** tính lại bằng `Q × C`, nên giá trị tồn có thể lệch `Q × C` vài đồng do làm tròn giá vốn; tồn về 0 thì giá trị luôn về 0 (§3.4).

### 3.4. Duyệt phiếu xuất (BR-10)

Với từng dòng theo `lineNo`: `q = baseQuantity`; kiểm `q ≤ Q` (đã kiểm cả phiếu trước khi ghi).

```
out = (q == Q) ? V : q × C          // xuất hết thì lấy đúng giá trị còn lại
V ← V − out;  Q ← Q − q              // C giữ nguyên
dòng phiếu: UnitCost = C, Value = out
thẻ kho: OutQuantity = q, OutValue = out, UnitCost = C
LastIssueAt ← ApprovedAt nếu loại là XuatBan hoặc DungNoiBo
```

### 3.5. Chuyển kho (BR-13)

- **Duyệt** (thời điểm ghi sổ = `approvedAt`): mỗi dòng xuất khỏi kho đi đúng như §3.4; dòng ghi `UnitCost = C` kho đi (giá vốn chuyển), `Value = out`; thẻ kho kho đi loại `ChuyenDi`; `LastIssueAt` kho đi cập nhật. `TotalValue = Σ Value` là giá trị hàng trên xe.
- **Nhận** (thời điểm ghi sổ = `receivedAt`): mỗi dòng `r = receivedBaseQuantity` (0…`baseQuantity`); `r > 0` thì nhập vào kho đến như §3.3 với `v = r × UnitCost`; thẻ kho kho đến loại `ChuyenDen`. `ShortageQuantity = baseQuantity − r`, `ShortageValue = ShortageQuantity × UnitCost`. Hao hụt không vào thẻ kho kho nào.
- Ví dụ TC-18: kho đi `KTONG` 2.400 chai × 7.200; chuyển 20 Thùng 24 = 480 chai → `KTONG` còn 1.920, giá trị chuyển 480 × 7.200 = **3.456.000**; nhận 478 chai ở `KTD` (90 chai, 657.000): giá vốn mới round((657.000 + 478 × 7.200) ÷ 568) = round(4.098.600 ÷ 568) = round(7.215,85) = **7.216**; hao hụt 2 chai, **14.400 ₫**.

### 3.6. Tồn khả dụng, giữ chỗ (BR-03, BR-04)

```
reserved(kho, hàng)  = Σ baseQuantity các dòng của: phiếu xuất ChoDuyet tại kho + phiếu chuyển ChoDuyet có kho đi là kho
available(kho, hàng) = onHand − reserved
```

- **Gửi duyệt** phiếu xuất, chuyển: với mỗi mặt hàng, `Σ baseQuantity` các dòng của phiếu ≤ `available` (phiếu đang gửi chưa ở `ChoDuyet` nên không tự trừ chính nó). Vượt → `VuotTonKhaDung` với `excess = Σ − available`; câu dùng số vượt (TC-11: khả dụng 80, gửi 100 → "Vượt tồn khả dụng 20 túi"). Lỗi gắn vào **mọi** dòng của mặt hàng đó.
- **Duyệt**: `Σ baseQuantity` theo mặt hàng ≤ `onHand` (có thể vượt khả dụng vì phiếu khác cùng giữ chỗ — điều đó chỉ chặn phiếu kia ở lúc duyệt). Không đủ → `KhongDuTonThuc`.
- Màn lập phiếu hiển thị khả dụng của mỗi dòng = `available` (phiếu đang mở ở `ChoDuyet` thì cộng lại số của chính phiếu); dòng vượt tô đỏ ngay (UC-04 bước 4).
- Phiếu `Nhap`, `TuChoi`, `DaHuy` không giữ chỗ (UC-04 5a). Rút lại, từ chối giải phóng giữ chỗ ngay.

### 3.7. Kiểm kê (BR-14 → BR-17)

- **Tạo**: kiểm không có phiếu chưa kết thúc ở kho; chốt dòng = mặt hàng thuộc phạm vi có `onHand ≠ 0` tại kho, `BookQuantity = onHand`, `BookCost = AvgCost`, xếp (thứ tự nhóm, mã hàng). Phạm vi = toàn kho hoặc mặt hàng có nhóm hiện tại thuộc `groupIds`.
- **Khóa**: từ lúc tạo tới khi `DaCanBang` hoặc `DaHuy`, duyệt phiếu nhập, xuất, chuyển đi tại kho và nhận chuyển đến kho có mặt hàng thuộc phạm vi → `DangKiemKe` (lập, sửa, gửi duyệt vẫn được; TC-28).
- **Đếm** (`POST counts`): mỗi entry quy về đơn vị cơ bản `b = quantity × factor(unitId)`; `Cong`: `counted = (counted ?? 0) + b` (mỗi lần quét = 1 đơn vị của mã vừa quét, BR-15: quét mã thùng 12 chai cộng 12); `Dat`: `counted = b`. Mặt hàng thuộc phạm vi chưa có dòng → thêm dòng `IsAdded`, `BookQuantity = 0`, `BookCost = AvgCost` hiện tại (chưa có thì 0). Đếm một dòng `NeedsRecount` thì bỏ cờ. Ghi `LastCountedBy`, `LastCountedAt`. Cùng `clientRequestId` → trả kết quả, không cộng lần hai.
- **Kiểm kê mù** (BR-15): khi phiếu `DangKiem`, người gọi không có `stocktakes.approve` nhận `bookQuantity`, `bookCost`, `difference`, `differencePercent`, `differenceValue`, `reasonRequired` = null và `isBlind = true`. Từ `ChoDuyet` trở đi trả đủ số lượng (giá trị vẫn theo BR-25).
- **Chênh lệch** (BR-16), tính lại mỗi lần đổi số đếm:

```
difference      = counted − book
differenceValue = (counted == 0 && book > 0) ? −(StockValue hiện tại của dòng tồn) : difference × bookCost
differencePercent = book > 0 ? round1(|difference| × 100 ÷ book) : null
reasonRequired  = |differenceValue| ≥ 1.000.000  hoặc  |difference| × 100 ≥ 5 × book  (book > 0)  hoặc  (book == 0 và counted > 0)
surplusValue    = Σ differenceValue > 0;   shortageValue = Σ |differenceValue < 0|
```

- **Gửi duyệt**: còn dòng `counted = null` → `ConDongChuaDem`; `reasons` gán vào dòng; dòng `reasonRequired` thiếu nguyên nhân → `ThieuNguyenNhan`. FE gọi gửi lần đầu không kèm nguyên nhân, nhận `requiredLines` để hiện các dòng bắt buộc (UC-11 bước 5), người đếm chọn rồi gửi lại cùng `version`, `clientRequestId` mới.
- **Duyệt** (BR-17): với mỗi dòng `difference ≠ 0`, theo `SortOrder`: `onHand ← counted`, `StockValue ± |differenceValue|`, giá vốn giữ nguyên; thẻ kho một dòng loại `KiemKe` (thừa ghi `InQuantity`, thiếu ghi `OutQuantity`, `UnitCost = bookCost`). Dòng chênh 0 không ghi thẻ kho. Kiểm kê thiếu không đổi `LastIssueAt`; kiểm kê thừa ở dòng tồn mới đặt `FirstReceiptAt`.
- **Trả lại đếm lại**: `ChoDuyet → DangKiem`; dòng được chọn `NeedsRecount = true`, `RecountNote = note`, `countedQuantity`, `reason` về null (người đếm phải đếm lại); dòng khác giữ số (TC-30).
- **Hủy**: không điều chỉnh, mở khóa.
- Ví dụ TC-26 (`KTD`, nhóm Dầu ăn, gia vị): `DAU-1L` sổ 240, giá 52.000; quét `12058100000890` 19 lần = 228, nhập thêm 9 → 237; chênh −3, giá trị **−156.000**, 1,3%, không bắt buộc. `NMAM-750` sổ 120, giá 33.000, đếm 150 → +30, **+990.000**, 25,0% → bắt buộc. Tổng thừa 990.000, tổng thiếu 156.000.

### 3.8. Vòng đời phiếu, phiên bản, chống bấm lặp

| Thao tác | Từ trạng thái | Sang | Ai |
| :--- | :--- | :--- | :--- |
| Tạo (`POST`) | — | `Nhap` (hoặc `ChoDuyet` với `submit`) | Có quyền `create`, kho trong phạm vi |
| Sửa (`PUT`) | `Nhap`, `TuChoi` | giữ nguyên (hoặc `ChoDuyet`) | Người lập |
| Gửi duyệt | `Nhap`, `TuChoi` | `ChoDuyet` | Người lập |
| Rút lại | `ChoDuyet` | `Nhap` | Người lập |
| Duyệt | `ChoDuyet` | `DaDuyet` (chuyển kho: `DangChuyen`) | Có quyền `approve`, khác người lập |
| Từ chối | `ChoDuyet` | `TuChoi` | Có quyền `approve`, khác người lập |
| Hủy | `Nhap`, `TuChoi` | `DaHuy` | Người lập hoặc người có quyền `approve` |
| Nhận hàng | `DangChuyen` | `DaNhan` | `transfers.receive`, kho đến trong phạm vi |
| Tạo phiếu ngược | `DaDuyet` (không phải phiếu ngược) | phiếu mới `Nhap` | Quyền `reverse` |
| Kiểm kê: gửi / trả lại / duyệt / hủy | `DangKiem` / `ChoDuyet` / `ChoDuyet` / `DangKiem`, `ChoDuyet` | `ChoDuyet` / `DangKiem` / `DaCanBang` / `DaHuy` | `count` / `approve` / `approve` khác người đếm / `cancel` |

Xử lý một thao tác có `version`, `clientRequestId` (BE trong transaction, mock giống hệt), theo thứ tự:

1. `clientRequestId == LastRequestId` của phiếu (hoặc `ClientRequestId` của phiếu đã tạo, với `POST`) → trả DTO hiện tại 200 (tạo: 200 thay vì 201), không làm gì thêm. Nhờ vậy bấm "Duyệt" hai lần, mạng chập chờn gửi lại, đều chỉ ghi sổ một lần.
2. Trạng thái không cho thao tác → `PhieuDaDuyet` (phiếu đã ghi sổ) hoặc `TrangThaiKhongHopLe`.
3. Quyền người thao tác (người lập, BR-06, phạm vi kho).
4. `version != Version` → 409 `DuLieuCu` kèm `currentVersion`; FE báo, tải lại phiếu, người dùng xem rồi bấm lại.
5. Quy tắc nghiệp vụ (tồn, khóa kiểm kê…), rồi ghi; `Version += 1`, `LastRequestId = clientRequestId`.

FE sinh `clientRequestId` bằng `crypto.randomUUID()` khi mở form hoặc hộp xác nhận, giữ nguyên khi bấm lại hoặc thử lại sau lỗi mạng, đổi mới sau khi thành công hoặc khi gặp lỗi nghiệp vụ cần sửa dữ liệu. Nút khóa trong lúc chờ phản hồi. BE dùng thêm concurrency token của EF: hai quản lý duyệt cùng lúc hai phiếu cùng mặt hàng, cùng kho thì giao dịch sau đọc lại dòng tồn, kiểm lại tồn rồi mới ghi (NFR-03).

### 3.9. Trạng thái tồn, cảnh báo, đề xuất nhập (BR-18, BR-19)

```
status = onHand == 0                         → HetHang
       : min != null && available ≤ min       → DuoiToiThieu
       : max != null && onHand > max          → VuotToiDa
       : BinhThuong
```

- Danh sách tồn hiện mọi trạng thái. **Cảnh báo** và các số đếm trên Tổng quan chỉ lấy dòng có ngưỡng tương ứng: `HetHang` khi `min` hoặc `max` khác null, `DuoiToiThieu` khi `min` khác null, `VuotToiDa` khi `max` khác null ("để trống thì không cảnh báo").
- **Đề xuất nhập** (dòng `HetHang`, `DuoiToiThieu` có `max`): `F` = hệ số đơn vị quy đổi lớn nhất (không có thì 1); `raw = max − available`; `suggested = floor(raw ÷ F) × F`; `suggested ≤ 0` thì `F`. Không có `max` → null. Ví dụ TC-25: max 720, khả dụng 90, F 24 → 630 → **624 chai (26 thùng)**.
- **Nguồn chuyển** (`sources`): kho khác trong phạm vi, đang hoạt động, `available > 0` của mặt hàng. "Tạo phiếu chuyển" tạo phiếu nháp từ kho nguồn tới kho thiếu, số lượng `min(suggested ?? F, available nguồn)`; đặt vào dòng theo đơn vị lớn nhất nếu chia hết, không thì đơn vị cơ bản (TC-25: 26 Thùng 24).

### 3.10. Thẻ kho, xuất nhập tồn (BR-11, BR-20, BR-21)

- Dòng thẻ kho xếp `(postedAt, docCode, seq)`. **Một kho**: `opening` = tồn, giá trị sau dòng cuối cùng trước `from` (không có thì 0); dòng trong kỳ; `closing = opening + Σ in − Σ out` (số lượng và giá trị). **Mọi kho**: gộp dòng của mọi kho trong phạm vi, `balanceQuantity` là lũy kế cộng dồn các kho (tồn đầu = tổng tồn đầu các kho), `balanceValue` tương tự, `avgCostAfter` null, có cột Kho. Kỳ kết thúc hôm nay: `closing` = tồn thực trên màn tồn kho (NFR-05).
- **Diễn giải** (chụp vào `Description` lúc ghi sổ): phiếu nhập "{loại nhập} – {tên nhà cung cấp | người giao | ghi chú}"; phiếu ngược "Nhập điều chỉnh – phiếu ngược của {mã}" / "Xuất điều chỉnh – phiếu ngược của {mã}"; phiếu xuất "Xuất bán – {người nhận}", "Trả nhà cung cấp – {tên}", "Dùng nội bộ – {lý do}", "Xuất hủy – {lý do}"; chuyển "Chuyển đến {mã kho đến} – {tên kho đến}", "Nhận từ {mã kho đi} – {tên kho đi}" (thiếu thì thêm " (thiếu {n} {đơn vị cơ bản})"); kiểm kê "Điều chỉnh kiểm kê {mã phiếu} – {nguyên nhân | Chênh lệch kiểm kê}".
- **Xuất nhập tồn** (theo `postedAt` của thẻ kho, kho trong phạm vi, lọc nhóm theo nhóm hiện tại): `opening` như thẻ kho; `in` = Σ `InQuantity`, `InValue` trong kỳ (phiếu nhập, chuyển đến, kiểm kê thừa); `out` = Σ `OutQuantity`, `OutValue` (phiếu xuất, chuyển đi, kiểm kê thiếu); `closing = opening + in − out`. "Tất cả kho" là cộng các kho: chuyển kho vẫn tính cả xuất ở kho đi và nhập ở kho đến.
- **Hàng đang chuyển cuối kỳ** (chỉ "Tất cả kho"): phiếu chuyển có `approvedAt ≤ cuối kỳ` và (`receivedAt` null hoặc `> cuối kỳ`); số lượng = Σ `baseQuantity`, giá trị = Σ `value` theo mặt hàng. Đồng nhất: Σ `closing` các kho + hàng đang chuyển = Σ `opening` + nhập từ ngoài − xuất ra ngoài − hao hụt.
- Ví dụ TC-34 (sau TC-18 bước 2, Tất cả kho, Hôm nay): `NTL-330` tồn đầu 2.400 + 90 + 360 = **2.850**; nhập 0; xuất 480; tồn cuối **2.370**; "Hàng đang chuyển cuối kỳ: 480 chai, 3.456.000 ₫".

### 3.11. Tổng quan quản lý (FR-01, FR-02), chậm luân chuyển (BR-22)

- `warehouses[]`: mọi kho đang hoạt động trong phạm vi, `stockValue = Σ StockValue`, `stockedProductCount` = số dòng `onHand > 0`. `totalStockValue` = tổng, không gồm hàng đang chuyển.
- `belowMinCount`, `outOfStockCount`, `overMaxCount`: số dòng cảnh báo theo §3.9. `pending`: số phiếu `ChoDuyet` từng loại. `inTransit`: số phiếu `DangChuyen`, Σ `totalValue`, số phiếu trễ.
- `daily`: 30 ngày tới hôm nay (giờ Việt Nam), đủ mọi ngày; `inValue` = Σ `totalValue` phiếu nhập duyệt trong ngày; `outValue` = Σ `totalValue` phiếu xuất duyệt trong ngày, trừ loại `XuatDieuChinh`. Chuyển kho, kiểm kê không tính (chỉ là luân chuyển nội bộ).
- `topIssued`: 10 mặt hàng có Σ `value` dòng phiếu xuất (trừ `XuatDieuChinh`) lớn nhất 30 ngày, kèm Σ `baseQuantity`.
- **Chậm luân chuyển**: dòng tồn `onHand > 0`; mốc = `LastIssueAt` (duyệt xuất bán, dùng nội bộ, chuyển đi; không tính xuất hủy, xuất điều chỉnh, trả nhà cung cấp, kiểm kê thiếu), chưa có thì `FirstReceiptAt`; `daysSince` = số ngày lịch giữa ngày của mốc và hôm nay (giờ Việt Nam); lấy dòng `daysSince ≥ 30`: `Tu30` (30–59), `Tu60` (60–89), `Tu90` (từ 90). Ví dụ TC-35: `NRC-36` tại `KBH` xuất lần cuối 75 ngày trước, 48 can × 85.000 = **4.080.000 ₫**, nhóm `Tu60`.

### 3.12. Mã chứng từ (SRS §5.3, BR-02)

`PN`, `PX`, `PC` + `yyMMdd` + 3 số (001–999); `KK` + `yyMMdd` + 2 số. Ngày là ngày gửi duyệt lần đầu (kiểm kê: ngày tạo) theo giờ Việt Nam; số thứ tự = số lớn nhất đã cấp cùng tiền tố, cùng ngày + 1. Mock lấy số lớn nhất trên cả kho lịch sử trong bộ nhớ và mock-db (§4.8).

### 3.13. Số tiền bằng chữ (NFR-06)

`amountInWords(n)` (`lib/amount-in-words.ts`): đọc theo nhóm 3 chữ số với "nghìn", "triệu", "tỷ" (lặp "nghìn tỷ"…); "mươi" từ 20, "mười" cho 10–19; hàng đơn vị: 1 sau "mươi" đọc "mốt", 5 sau "mươi"/"mười" đọc "lăm", 4 sau "mươi" đọc "tư"; hàng chục 0 mà đơn vị khác 0 đọc "linh"; nhóm sau nhóm đầu có trăm 0 đọc "không trăm"; nhóm 000 bỏ qua; viết hoa chữ đầu, thêm " đồng"; 0 → "Không đồng".

| Số | Chữ |
| :--- | :--- |
| 22.680.000 | Hai mươi hai triệu sáu trăm tám mươi nghìn đồng (TC-20) |
| 18.000.000 | Mười tám triệu đồng |
| 49.200.000 | Bốn mươi chín triệu hai trăm nghìn đồng (TC-08, tổng giá trị nhập kho) |
| 3.456.000 | Ba triệu bốn trăm năm mươi sáu nghìn đồng |
| 1.050.000 | Một triệu không trăm năm mươi nghìn đồng |
| 105 | Một trăm linh năm đồng |
| 21.515 | Hai mươi mốt nghìn năm trăm mười lăm đồng |
| 24.000.000.000 | Hai mươi tư tỷ đồng |

### 3.14. Số tính sẵn cho test

| Ca | Phép tính | Kết quả |
| :--- | :--- | ---: |
| TC-07 | 100 × 180.000 | 18.000.000 |
| TC-08 phân bổ | 1.200.000 × 18.000.000 ÷ 48.000.000; dòng cuối 1.200.000 − 450.000 | **450.000**; **750.000** |
| TC-08 giá trị nhập kho | 18.000.000 + 450.000; 30.000.000 + 750.000 | 18.450.000; 30.750.000 |
| TC-08 giá vốn `NTL-330` `KTONG` | round((17.280.000 + 18.450.000) ÷ 4.800) = round(7.443,75) | **7.444** |
| TC-08 giá vốn `DAU-1L` `KTONG` | (31.200.000 + 30.750.000) ÷ 1.200 | **51.625** |
| TC-10 | 100 × 178.000 | 17.800.000 |
| TC-11 | khả dụng 200 − 120 = 80; 100 − 80 | **80**; vượt **20** túi |
| TC-13 | (17.280.000 + 18.000.000) ÷ 4.800; giá trị 35.280.000 | **7.350** |
| TC-14 | 120 × 189.000; 37.800.000 − 22.680.000 | **22.680.000**; còn **15.120.000** |
| TC-16 | 10 × 390.000 = 3.900.000; (3.960.000 + 3.900.000) ÷ 240 | **32.750** |
| TC-18 | 480 × 7.200; round((657.000 + 478 × 7.200) ÷ 568); 2 × 7.200 | **3.456.000**; **7.216**; **14.400** |
| TC-20 | phiếu ngược 120 túi × 189.000; (15.120.000 + 22.680.000) ÷ 200 | 22.680.000; **189.000** |
| TC-23, TC-33 | chuyển 480 × 7.350; 35.280.000 − 3.528.000 | **3.528.000**; tồn cuối 4.320 / **31.752.000** |
| TC-25 | floor((720 − 90) ÷ 24) × 24 | **624** (26 thùng) |
| TC-26 | −3 × 52.000; +30 × 33.000; 30 ÷ 120 | **−156.000**; **+990.000**; 25,0% |
| TC-29 | 240 − 24 | `DAU-1L` `KTD` **216** |
| TC-30 | +5 × 33.000; 5 ÷ 120 | **+165.000**; 4,2% (không bắt buộc) |
| TC-34 | 2.400 + 90 + 360; 2.850 − 480 | **2.850**; **2.370**; đang chuyển 3.456.000 |
| TC-35 | 48 × 85.000 | **4.080.000** |
| BR-01 | 568 = 23 × 24 + 16 | "23 thùng 16 chai" |

---

## 4. Quy ước riêng cho FE

### 4.1. Trang sau đăng nhập, menu

- **Menu** (`config/routes/`, đã khai báo): Tổng quan `/dashboard` (`dashboard.view`); nhóm **Chứng từ**: Phiếu nhập, Phiếu xuất, Chuyển kho, Phiếu chờ duyệt (`approvalPermissions`, Thủ kho không thấy), Kiểm kê; nhóm **Tồn kho**: Tồn kho (cả thẻ kho `/stock/[productId]`), Báo cáo (`reports.view`); nhóm **Danh mục**: Hàng hóa, Kho, Nhà cung cấp; rồi nhóm Cài đặt của nền. Bản in khai báo trong `hidden.routes.ts`.
- **Trang sau đăng nhập**: `homeAfterLogin = /dashboard` cho mọi vai trò. `/dashboard` (thay nội dung `app/(protected)/dashboard/page.tsx` của nền): có `reports.view` → Tổng quan quản lý; không có → Việc cần làm (FR-03). Thủ kho gõ `/approvals`, `/reports` → `/forbidden` (TC-17).
- Thông báo mặc định: `toast` theo `getErrorMessage`; lỗi theo ô bằng `applyFieldErrors` (key `lines[1].quantity` → `lines.1.quantity` của nền). Lỗi có `code` xử lý riêng ở §4.3–4.5.

### 4.2. Trình diễn trên một trình duyệt (chế độ `mock` trên Vercel)

Người xem `https://pum-quan-ly-kho.vercel.app` thường chỉ có một trình duyệt, không có BE. Mock-db nằm trong localStorage nên **mọi tab cùng trình duyệt thấy cùng dữ liệu**; vai trò đổi bằng `DemoToolbar` chỉ áp cho tab hiện tại (sessionStorage). Luồng "thủ kho lập phiếu → quản lý duyệt → tồn cập nhật" chạy được theo hai cách:

1. **Một tab, đổi vai trò**: đăng nhập nhanh Thủ kho → lập phiếu, gửi duyệt → `DemoToolbar` đổi sang Quản lý → Phiếu chờ duyệt → Duyệt → mở Tồn kho thấy số mới → đổi lại Thủ kho. Đổi vai trò giữ nguyên trang nếu vai trò mới có quyền (chi tiết phiếu, tồn kho), không thì về trang chủ.
2. **Hai tab song song**: tab 1 Thủ kho, tab 2 Quản lý. `lib/providers.tsx` đã tự `invalidateQueries` khi tab khác ghi mock-db, nên tab Quản lý thấy phiếu mới trong Phiếu chờ duyệt, tab Thủ kho thấy trạng thái "Đã duyệt" mà không cần tải lại.

Hỗ trợ thêm (FE-Phiếu làm, chỉ hiện khi `appConfig.demoToolbar`):

- Sau khi gửi duyệt thành công, thông báo nổi có nút **"Đổi sang Quản lý để duyệt"** (gọi đúng hàm đổi vai trò của `DemoToolbar`, rồi mở chi tiết phiếu). Sau khi quản lý duyệt, nút **"Đổi lại Thủ kho"**. Hai nút này là lối tắt, không thay quy trình.
- Phiếu chờ duyệt do chính người đang đăng nhập lập: nút Duyệt khóa, chú thích "Người duyệt phải khác người lập" kèm liên kết nhỏ "Đổi sang Quản trị viên để duyệt" (TC-16).
- Màn đếm kiểm kê có nút "Mở chế độ tablet" (mở tab mới cùng URL thêm `?tablet=1`, giao diện khóa khổ 800 px giữa màn hình để chiếu như tablet; điện thoại, tablet thật không cần).
- Gợi ý đầu trang Phiếu chờ duyệt khi trống: "Chưa có phiếu chờ duyệt. Đổi sang Thủ kho để lập phiếu".

### 4.3. Lập phiếu nhập, xuất, chuyển (SCR-05…SCR-10)

- **Tablet** (NFR-01): bố cục một cột ở 800 px dọc, hai cột ở ngang; ô quét mã luôn ở trên cùng, tự lấy lại tiêu điểm sau mỗi lần thêm dòng; vùng chạm ≥ 44 px; ô số lượng `inputMode="numeric"`.
- **Quét mã**: ô quét nhận chuỗi số + Enter (máy quét giả lập bàn phím, SRS §2.4). Tra trong `CatalogProduct[]` đã nạp (`GET /api/products/catalog`, giữ `staleTime` 5 phút) theo mã vạch đơn vị cơ bản và đơn vị quy đổi, rồi theo mã hàng; thấy → thêm dòng đúng đơn vị, số lượng 1, hoặc cộng 1 vào dòng cùng mặt hàng cùng đơn vị (UC-03 bước 3); không thấy hoặc hàng ngừng → âm báo lỗi ngắn (Web Audio, không tệp âm thanh) và thông báo "Không tìm thấy mã {mã}" / "{tên} đã ngừng sử dụng", không thêm dòng (UC-03 E2). Phản hồi < 150 ms vì không gọi mạng (NFR-02).
- **Tìm tên**: ô tìm gõ không dấu theo mã, tên, mã vạch (`matchesSearch` của nền) trên catalog, chọn đơn vị trong dòng.
- **Phiếu nhập**: cột đơn vị, số lượng, đơn giá, thành tiền; ô chi phí mua hàng; cột chi phí phân bổ và đơn giá nhập kho tính ngay bằng `costing.ts` (§3.2). Thủ kho thấy các cột giá ở phiếu mình lập (BR-25).
- **Phiếu xuất, chuyển**: cột "Khả dụng" đọc từ `GET /api/stock-levels/available` (đọc quy đổi, §3.1), dòng vượt tô đỏ kèm "Vượt {n} {đơn vị}" (§3.6). Phiếu chuyển: chọn kho đến khác kho đi.
- Nút: "Lưu nháp", "Gửi duyệt" (gửi `submit = true` trong cùng `POST`/`PUT`), "Rút lại", "Hủy phiếu", "In", "Tạo phiếu ngược" (quyền `reverse`, phiếu đã duyệt, chưa có phiếu ngược; TC-20 bước 3 hết nút). Phiếu bị từ chối hiện khung lý do, người từ chối, giờ.
- Lỗi `VuotTonKhaDung` gắn vào dòng theo `errors`; `DuLieuCu`, `PhieuDaDuyet` → thông báo rồi tải lại phiếu.
- `/transfers/new?fromWarehouseId&toWarehouseId&lines={productId}:{baseQuantity},…&rid={uuid}`: trang tự tạo phiếu nháp (`POST` với `clientRequestId = rid`, nên tải lại trang không tạo trùng) rồi chuyển tới `/transfers/{id}` (UC-10 bước 3, TC-25). Hàm dựng URL: `buildTransferDraftUrl()` trong `features/inventory/lib/links.ts`.
- Phiếu chuyển `DangChuyen` ở kho đến của người xem: nút "Xác nhận nhận hàng" mở bảng số thực nhận (mặc định bằng số chuyển, nhập theo thùng + lẻ), cột thiếu tự tính, "Hoàn tất nhận". Nhãn "Trễ" màu cảnh báo.

### 4.4. Duyệt (SCR-11), kiểm kê (SCR-14, SCR-15)

- **Phiếu chờ duyệt** `/approvals`: bảng theo `ApprovalItem`, lọc loại, kho, người lập; bấm dòng mở ngăn kéo xem chi tiết phiếu (gọi chi tiết đúng loại, có `preview`: tồn hiện tại, thiếu, giá vốn dự kiến), nút Duyệt, Từ chối (hộp lý do có gợi ý `rejectReasonSuggestions`, đếm ký tự, khóa nút dưới 10 ký tự). Duyệt xong dòng biến mất, thông báo "Đã duyệt {mã}".
- **Kiểm kê**: danh sách; "Tạo phiếu kiểm kê" (kho, toàn kho hoặc chọn nhóm, người đếm mặc định là thủ kho đầu tiên của kho). Màn đếm (người không có `stocktakes.approve` khi `DangKiem`): gom theo nhóm, mỗi dòng tên, mã, ô "thùng + lẻ", số đã đếm, người đếm cuối; **không** có cột sổ sách, chênh lệch (BR-15, TC-26 bước 2). Ô quét gửi `Cong` 1 đơn vị của mã; nhập tay gửi `Dat`; gửi theo lô mỗi 1 giây hoặc khi rời ô, mỗi lô một `clientRequestId`, giữ hàng đợi khi mất mạng ngắn và gửi lại cùng mã. Dòng `needsRecount` tô vàng kèm ghi chú. Nút "Điền bằng sổ sách cho dòng chưa đếm" (hộp xác nhận), "Gửi duyệt": lỗi `ConDongChuaDem` liệt kê dòng; `ThieuNguyenNhan` hiện các dòng bắt buộc với chênh lệch, ô chọn nguyên nhân, ghi chú (dòng chưa chọn tô đỏ), rồi gửi lại.
- Màn duyệt kiểm kê (có `stocktakes.approve`): bảng sổ sách, đếm, chênh lệch, %, giá trị, nguyên nhân, **sắp theo |giá trị chênh| giảm dần** (UC-11 bước 7); tổng thừa, tổng thiếu; nút Duyệt (khóa khi người xem là người đếm), "Trả lại đếm lại" (chọn dòng + ghi chú), "Hủy phiếu", "In biên bản".

### 4.5. Tồn kho, thẻ kho, danh mục (SCR-02…SCR-04, SCR-12, SCR-13)

- **Tồn kho** `/stock`: bộ lọc kho (mặc định Tất cả kho với người thấy mọi kho, kho đầu tiên với thủ kho; UC-08 bước 1), nhóm, trạng thái, tìm; tham số lưu trên URL (`?warehouseId=…`). Cột: mặt hàng (ảnh, tên, mã), tồn thực + cách đọc, chờ xuất (bấm mở ngăn kéo `reservations`), khả dụng, giá vốn, giá trị (chỉ `canViewValues`), trạng thái (`StatusBadge` tông theo `stockStatusBadge`). Dòng tổng giá trị đầu bảng. Tab **Cảnh báo**: `alerts`, cột đề xuất (§3.9), kho nguồn còn hàng, nút "Tạo phiếu chuyển" (`buildTransferDraftUrl`, chỉ khi có `transfers.create` và kho nguồn trong phạm vi).
- **Thẻ kho** `/stock/[productId]?warehouseId&from&to`: mặc định kho đang chọn ở trang trước, 30 ngày; chọn nhanh Hôm nay, 7 ngày, 30 ngày, Tháng này, Tháng trước, Tùy chọn; "Mọi kho" có cột Kho; dòng tồn đầu kỳ, các dòng, dòng cộng, tồn cuối; kỳ không phát sinh ghi "Không có phát sinh trong kỳ" (UC-09 E1); số phiếu là liên kết (`docPath(docKind, docId)`); nút "In thẻ kho".
- **Hàng hóa** `/products`: tab Mặt hàng (bảng có cột tồn từng kho trong phạm vi, lọc nhóm, trạng thái, tìm theo mã vạch) và Nhóm hàng. Form mặt hàng: thông tin, tối đa 2 đơn vị quy đổi (ô hệ số khóa khi `isUsed`, chú thích "Đơn vị đã có chứng từ"), "Ngưỡng tồn theo kho" một dòng mỗi kho. Thủ kho chỉ xem (không nút Thêm, Sửa).
- **Kho** `/warehouses`: bảng kho, thủ kho phụ trách, số mặt hàng còn tồn, giá trị tồn; form kho; hộp "Thủ kho phụ trách" (`keeper-candidates`, quyền `warehouses.assign`); công tắc ngừng hoạt động (lỗi `KhoConTon` hiện nguyên câu).
- **Nhà cung cấp** `/suppliers`: bảng, form, công tắc "Ngừng giao dịch".

### 4.6. Tổng quan, báo cáo, xuất Excel

- **Tổng quan quản lý**: thẻ giá trị tồn từng kho và tổng; thẻ "Phiếu chờ duyệt" chia nhập, xuất, chuyển, kiểm kê (bấm → `/approvals?kind=…`); thẻ "Đang chuyển" (số phiếu, giá trị, số trễ; bấm → `/transfers?status=DangChuyen`); thẻ "Dưới tối thiểu", "Hết hàng", "Vượt tối đa" (bấm → `/stock?tab=alerts&status=…`); biểu đồ cột nhập/xuất 30 ngày (Recharts, màu từ token `--chart-*`); bảng top 10 xuất. Trống → trạng thái trống (UC-12 E1).
- **Việc cần làm** (thủ kho): bốn khối phiếu nháp, bị từ chối (kèm lý do, người, giờ), chờ nhận (kèm "Trễ"), đang đếm; thêm khối "Đang chờ duyệt" của mình; không số tiền.
- **Báo cáo** `/reports`: tab Xuất nhập tồn (mặc định Tháng này, Tất cả kho; nhóm theo nhóm hàng mở rộng được (UC-13 2a); dòng tổng; khối "Hàng đang chuyển cuối kỳ"; bấm số nhập, xuất mở thẻ kho cùng kho, kỳ (FR-33)), Chậm luân chuyển, Nhập theo nhà cung cấp, Xuất theo loại, Chênh lệch kiểm kê, Hao hụt vận chuyển. FE chặn khoảng > 366 ngày trước khi gọi.
- **Xuất Excel** (FR-36): gói `write-excel-file` (đã thêm `4.1.1` vào `package.json`), xuất đúng bảng đang xem (cột, bộ lọc ghi ở dòng đầu), tên tệp không dấu `xuat-nhap-ton-2026-10-01-2026-10-31.xlsx`. Nút "Xuất dữ liệu kế toán" (SRS §2.4, P3) ở tab Xuất nhập tồn: tệp `.xlsx` gồm hai trang Phiếu nhập, Phiếu xuất đã duyệt trong kỳ (mã, ngày ghi sổ, kho, loại, đối tác, mã hàng, tên, ĐVT, số lượng, đơn giá, thành tiền) lấy từ `GET /api/goods-receipts`, `GET /api/goods-issues` (lặp trang `pageSize=100`) và chi tiết phiếu; ghi chú "Tệp mẫu để nhập vào phần mềm kế toán, không gửi đi đâu".
- Định dạng: tiền `formatVnd`, số lượng `formatNumber` kèm cách đọc quy đổi, phần trăm 1 chữ số thập phân dấu phẩy.

### 4.7. Bản in

Route ở `app/(print)/print/...` theo §2.11; `app/(print)/layout.tsx` (FE-Phiếu, mốc 1) bọc `AuthGuard`, nạp `StoreProfile` và cài đặt thương hiệu, không sidebar, CSS in A4 dọc; component dùng chung `PrintHeader`, `PrintSignatures`, `PrintTable` trong `features/inventory/components/print/`. Nút "In" trên trang chi tiết mở tab mới với `?print=1`.

### 4.8. Mock

- **Collection** (`mockDb.collection`, scope `business`, khai báo duy nhất ở `features/inventory/mock/`): `warehouses` (kèm `keeperUserIds`), `suppliers`, `product-groups`, `products` (đơn vị lồng trong bản ghi), `stock-levels`, `goods-receipts`, `goods-issues`, `transfers`, `stocktakes` (dòng, `countRequestIds` lồng trong bản ghi), `stock-ledger` (chỉ dòng thẻ kho ghi trong phiên demo). Kiểu bản ghi `*Record` khai báo trong `features/inventory/mock/records.ts` (gần DTO, thêm cột nội bộ như `lastRequestId`, `clientRequestId`, `createdById`).
- **Seed**: `mockDb.registerSeed('demo-data', demoData)`, suy ra trường đúng `06` §5 (mốc thời gian, `stableId`, trạng thái, mã chứng từ, nạp lại theo thời gian). Danh mục và dòng tồn (số dư cuối của lần nạp) vào mock-db.
- **Bộ nhớ** (localStorage khoảng 5 MB): lịch sử đã kết thúc (phiếu `DaDuyet`, `DaHuy`, `DaNhan`, kiểm kê `DaCanBang`, `DaHuy`, cùng 3.484 dòng thẻ kho) là dữ liệu **chỉ đọc**, giữ ở kho trong bộ nhớ dựng lại từ seed mỗi lần tải trang (một lần, khi mock được gọi lần đầu; khoảng 30 ms), **không** ghi localStorage. Mock-db chỉ chứa danh mục, dòng tồn, phiếu chưa kết thúc của seed (11 phiếu §06 §5.6) và mọi thứ tạo hoặc đổi trong phiên demo. Handler danh sách, báo cáo, thẻ kho đọc hợp hai nguồn (mock-db đè bản bộ nhớ cùng id, nhưng phiếu lịch sử không bao giờ bị sửa). "Phiếu ngược đã có" của phiếu lịch sử tra từ mock-db. Đặt lại dữ liệu xóa mock-db và dựng lại kho bộ nhớ (`mockDb.onReset`).
- Ghi sổ ở mock: một hàm `postDocument()` trong `mockDb.batch` (đổi phiếu + dòng tồn + thêm dòng thẻ kho cùng lúc), kiểm `version` của phiếu như §3.8; mock chạy một luồng nên không cần khóa dòng tồn.
- Lỗi trả đúng ProblemDetails, có `code` và trường mở rộng như §2.12 (`domain(detail, { code, … })`, `conflict`, `notFound`, `forbidden` của `mock-errors.ts`; 409 có `code` thì dùng `ApiError.fromStatus(409, detail, { code, … })`). Kiểm quyền `requirePermission` như BE; phạm vi kho bằng `warehouseScope()` của lõi.
- Độ trễ giả `mockDelay()` của nền; riêng lượt đếm kiểm kê, tra catalog không trễ (màn tablet cần nhanh).

### 4.9. Chia việc FE (hai agent làm song song)

Đã viết sẵn, **dùng chung, không agent nào tự đổi cấu trúc** (cần đổi hợp đồng thì sửa 07 trước, báo bên kia): `src/types/inventory.ts` (mọi DTO, enum), `src/types/inventory-seed.ts` (kiểu file seed), `src/config/inventory-labels.ts`, `src/config/permissions.ts`, `src/config/route-path.ts`, `src/config/routes/*.ts`, `src/config/api-routes.ts`, `src/config/setting-labels.ts`, `src/mock/seed/project.json`, `src/mock/seed/demo-data.json`, `scripts/generate-documents.mjs`. Được **thêm** hằng mới vào các file config (nối cuối nhóm của mình), không sửa dòng của bên kia. `package.json` đã có `write-excel-file`, script `seed:documents`; cần gói mới thì FE-Phiếu thêm (người duy nhất sửa `package.json`, `pnpm-lock.yaml`), FE-Danh mục & Báo cáo nhắn để thêm.

| | **FE-Phiếu** | **FE-Danh mục & Báo cáo** |
| :--- | :--- | :--- |
| Màn hình | Phiếu nhập (SCR-05, 06), Phiếu xuất (SCR-07, 08), Chuyển kho (SCR-09, 10), Phiếu chờ duyệt (SCR-11), Kiểm kê (SCR-14, 15); bản in phiếu nhập, xuất, chuyển, biên bản kiểm kê; lối tắt đổi vai trò §4.2 | Tổng quan + Việc cần làm (SCR-01), Hàng hóa (SCR-02), Nhà cung cấp (SCR-03), Kho (SCR-04), Tồn kho + Cảnh báo (SCR-12), Thẻ kho (SCR-13), Báo cáo + Excel (SCR-16); bản in thẻ kho; nhãn Cài đặt chung (đã có) |
| Thư mục feature sở hữu | `features/inventory/` (lõi, xem dưới), `features/goods-receipts/`, `features/goods-issues/`, `features/transfers/`, `features/approvals/`, `features/stocktakes/` | `features/products/` (mặt hàng, nhóm hàng), `features/warehouses/`, `features/suppliers/`, `features/stock/` (tồn, cảnh báo, giữ chỗ, thẻ kho), `features/reports/` (tổng quan, việc cần làm, báo cáo, Excel) |
| Route `app/` | `app/(protected)/goods-receipts/**`, `goods-issues/**`, `transfers/**`, `approvals/**`, `stocktakes/**`; `app/(print)/layout.tsx`; `app/(print)/print/{goods-receipts,goods-issues,transfers,stocktakes}/**` | `app/(protected)/dashboard/page.tsx` (thay nội dung), `products/**`, `warehouses/**`, `suppliers/**`, `stock/**`, `reports/**`; `app/(print)/print/stock-card/**` |
| Collection mock-db | **Tất cả**, khai báo và nạp seed trong `features/inventory/mock/` | Không khai báo collection; handler của mình đọc, ghi qua API của store lõi |
| Handler mock | `features/inventory/mock/` (catalog, `warehouses/my`, `stock-levels/available`, `store-profile`), `features/{goods-receipts,goods-issues,transfers,approvals,stocktakes}/mock/` | `features/products/mock/` (nhóm, mặt hàng, `by-barcode`), `features/warehouses/mock/` (kho, thủ kho phụ trách, `keeper-candidates`), `features/suppliers/mock/` (kể cả `options`), `features/stock/mock/` (`stock-levels`, `reservations`, `alerts`, `stock-cards`), `features/reports/mock/` |
| File nền được sửa | `components/demo/DemoToolbar.tsx` (xuất hàm đổi vai trò cho lối tắt §4.2, nếu chưa có), `app/theme.css` (thêm token `--stock-*` nếu cần), `package.json` | Không sửa file nền ngoài trang dashboard |

**Lõi `features/inventory/` (FE-Phiếu viết, FE-Danh mục & Báo cáo chỉ import).** Mốc 1, làm **trước tiên** để bên kia dùng được ngay:

| File | Xuất ra |
| :--- | :--- |
| `lib/vn-time.ts` | Chép `features/pos/lib/vn-time.ts` của demo Menu QR: `vnDateKey`, `vnYyMMdd`, `vnStartOfDay`, `vnAt`, `addDaysKey`, `diffDaysKey`, `vnHhmm`; thêm `vnRange(from, to)` → [ISO đầu ngày, ISO cuối ngày] |
| `lib/uom.ts` | `toBase(qty, factor)`, `readQuantity(q, baseUnit, units)` (§3.1), `unitShortName(name)`, `splitCartons(q, factor)` |
| `lib/costing.ts` | `roundVnd(a, b)`, `allocateFreight(amounts, baseQtys, freight)`, `receiptLineTotals(lines, freight)`, `applyIn(level, q, v)`, `applyOut(level, q)`, `applyAdjust(level, diff, bookCost)` (§3.2–3.7) |
| `lib/stock-rules.ts` | `stockStatus(level, reserved)`, `isAlert(level, status)`, `suggestQuantity(level, available, units)` (§3.9), `varianceOf(line, stockValue)`, `reasonRequired(...)` (§3.7), `slowBucket(days)` (§3.11), `isLate(approvedAt, now)` |
| `lib/doc-codes.ts` | `nextDocCode(prefix, dateKey, existingCodes)`, tiền tố `PN`, `PX`, `PC`, `KK` |
| `lib/amount-in-words.ts` | `amountInWords(n)` (§3.13) |
| `lib/links.ts` | `docPath(kind, id)`, `printPath(kind, id)`, `buildTransferDraftUrl({ fromWarehouseId, toWarehouseId, lines })` |
| `lib/scope.ts` | `canSeeAllWarehouses(permissions)` (có `warehouses.assign`) |
| `mock/records.ts` | Kiểu `*Record` của mọi collection |
| `mock/catalog.store.ts` | Collection `warehouses`, `suppliers`, `product-groups`, `products`, `stock-levels`; `ids.warehouse(code)`…; `warehouseScope()` (kho người đang đăng nhập được thấy), `findByBarcode(code)`, `stockLevel(wId, pId)` |
| `mock/history.store.ts` | Kho bộ nhớ: `historyDocs()`, `historyLedger()`; dựng bằng `seed-loader.ts` |
| `mock/seed-loader.ts`, `mock/posting.ts` | Nạp seed theo `06` §5 bằng chính `posting.ts` (`postReceipt`, `postIssue`, `postTransferOut`, `postTransferIn`, `postStocktake`) |
| `mock/documents.store.ts` | Collection phiếu; `allReceipts()`, `allIssues()`, `allTransfers()`, `allStocktakes()`, `allLedger()` (hợp bộ nhớ + mock-db), `reservations(wId, pId?)`, `activeStocktakeLock(wId, pId)` |
| `services/inventory.service.ts`, `hooks/` | `useCatalog()`, `useMyWarehouses()`, `useAvailability(warehouseId)`, `useStoreProfile()`, `useProductGroups()` (đọc `GET /api/product-groups`; handler mock của endpoint này thuộc FE-Danh mục, trước khi có thì lõi đọc thẳng store) |
| `components/` | `ProductThumb` (ảnh hoặc ô màu nhóm), `QuantityReading`, `DocStatusBadge`, `WarehouseSelect`, `ScanInput`, `CartonInput` (thùng + lẻ), `print/*` |

Mốc 2 (FE-Phiếu): hoàn thiện phiếu nhập, xuất, duyệt (luồng demo chính), rồi chuyển kho, kiểm kê. FE-Danh mục & Báo cáo trước mốc 1 làm giao diện bằng kiểu trong `types/inventory.ts` với dữ liệu rỗng; sau mốc 1 viết handler đọc `allLedger()`, `stock-levels`, `allTransfers()`… và đối chiếu số `06` §5.7.

Service: mỗi feature có `services/*.service.ts` riêng, chỉ gọi đường dẫn trong `apiRoutes`. Query key: `['catalog']`, `['warehouses', 'my']`, `['warehouses']`, `['suppliers', query]`, `['product-groups']`, `['products', query]`, `['product', id]`, `['availability', warehouseId]`, `['goods-receipts', query]`, `['goods-receipt', id]`, `['goods-issues', query]`, `['goods-issue', id]`, `['transfers', query]`, `['transfer', id]`, `['approvals', query]`, `['stocktakes', query]`, `['stocktake', id]`, `['stock-levels', query]`, `['stock-alerts', query]`, `['reservations', warehouseId, productId]`, `['stock-card', query]`, `['reports', loại, query]`, `['store-profile']`. Thao tác ghi sổ (duyệt, nhận, duyệt kiểm kê) làm mới các khóa bắt đầu bằng `stock-levels`, `stock-alerts`, `availability`, `stock-card`, `reports`, `approvals` và phiếu liên quan; FE-Phiếu gọi `invalidateInventoryQueries(queryClient)` xuất từ `features/inventory/hooks/`.

### 4.10. Thứ tự làm BE (một agent)

Namespace theo `BE-CAU-TRUC-THU-MUC.md`; Area `Inventory`, module `Warehouses`, `Suppliers`, `Products`, `Stock`, `GoodsReceipts`, `GoodsIssues`, `Transfers`, `Approvals`, `Stocktakes`, `Reports`. Chép từ demo Quản lý Nhà hàng: `Application/Common/Time/VietnamTime.cs`, `VietnamDates.cs`.

1. **Domain**: `Domain/Enums/Inventory/*` (mọi enum `06` §4); `Domain/Entities/Inventory/{Warehouses,Suppliers,Products,Stock,GoodsReceipts,GoodsIssues,Transfers,Stocktakes}/*.cs`; `InventoryRules.cs` (hằng số `06` §3), `InventoryErrors.cs` (mã lỗi §2.12), `StockMath.cs` (§3.1–3.4, §3.7, §3.9 dạng hàm thuần, có test đơn vị theo bảng §3.14), `AmountInWords.cs` không cần (in ở FE).
2. **Persistence**: `Infrastructure/Persistence/Configurations/Inventory/*Configuration.cs` (index, unique, concurrency `06` §4); migration `Add_Inventory` (Postgres).
3. **Lõi ghi sổ**: `IWarehouseScope` (phạm vi kho theo `warehouses.assign` + `Inventory_WarehouseKeepers`), `IDocumentCodeGenerator`, `IStockPostingService` (ghi sổ một phiếu trong transaction, dòng tồn concurrency, thử lại một lần), `IStockQueries` (giữ chỗ, khả dụng, khóa kiểm kê), `DocActionGuard` (thứ tự kiểm §3.8 dùng chung mọi phiếu).
4. **Seed**: `InventorySeedRecords.cs` (kiểu đọc JSON `06` §5.4), `DemoDataSeeder` nạp theo `06` §5 **bằng `IStockPostingService`**; đối chiếu số `06` §5.7 (giá trị tồn từng kho, số dòng thẻ kho). `project.json` đã có quyền, tài khoản, cài đặt (SystemSeeder nền tự đồng bộ).
5. **Danh mục**: kho (+ thủ kho phụ trách, `my`, `keeper-candidates`), nhà cung cấp (+ `options`), nhóm hàng, mặt hàng (+ `catalog`, `by-barcode`, ngưỡng, `SearchText`); `Permissions.cs` thêm nhóm như §1.
6. **Phiếu nhập, phiếu xuất** (gồm phiếu ngược), **Phiếu chờ duyệt**: luồng demo chính, chạy tay TC-07…TC-17, TC-20.
7. **Chuyển kho** (TC-18, TC-19), **tồn kho, cảnh báo, giữ chỗ, thẻ kho** (TC-21…TC-25).
8. **Kiểm kê** (TC-26…TC-30).
9. **Báo cáo, Tổng quan, Việc cần làm, `store-profile`** (TC-31…TC-35).
10. Test tự động: `StockMath` theo §3.14; NFR-05 sau khi nạp seed (tồn cuối xuất nhập tồn = dòng tồn = tồn cuối thẻ kho, cả giá trị). Kiểm: `dotnet publish` không lỗi (máy dev không có Docker/Postgres; dùng Postgres portable nếu cần chạy), chạy tay TC trọng tâm qua Swagger.

---

## 5. Quyết định thiết kế (BE và FE làm theo)

Những điểm SRS, use case chưa nói rõ đã được chốt như sau; FE mock làm giống BE để hai chế độ ra cùng kết quả.

| # | Chỗ | Quyết định | Lý do |
| :---: | :--- | :--- | :--- |
| 1 | Phạm vi kho | Thấy mọi kho = có quyền `warehouses.assign`; không có thì chỉ kho được gán. Áp ở mọi API, kể cả danh sách kho, hàng hóa (cột tồn) | BR-23 nói theo vai trò; dùng quyền để vai trò tự tạo vẫn chạy đúng; kịch bản demo "kho biến mất khỏi mọi màn hình" |
| 2 | Tổng quan | `/dashboard` gắn `dashboard.view`; trang chọn nội dung theo `reports.view` | Thủ kho cần Việc cần làm (FR-03), quản lý cần số liệu (FR-01) |
| 3 | Tiền tố bảng | `Inventory_*` theo quy tắc `{Area}_{TenSoNhieu}`, Area `Inventory` | Giữ đúng quy ước dự án và `BE-CAU-TRUC-THU-MUC.md` |
| 4 | Giá vốn | Bình quân gia quyền tức thời theo từng kho (SRS §2.4), không FIFO, không lô | SRS chọn sẵn; FIFO, lô nói với khách là bản triển khai |
| 5 | Giá trị tồn | Lưu `StockValue` riêng, cộng trừ đúng giá trị từng nghiệp vụ; không tính lại bằng tồn × giá vốn | BR-10; báo cáo xuất nhập tồn khớp từng đồng với thẻ kho (NFR-05) |
| 6 | Mã chứng từ | Cấp khi gửi duyệt lần đầu; nháp không mã; kiểm kê cấp khi tạo | UC-03 bước 6; nháp bị hủy không làm thủng dãy số đã gửi |
| 7 | Phiếu ngược | Dòng theo đơn vị cơ bản; không tạo phiếu ngược của phiếu ngược; hủy phiếu ngược nháp thì tạo lại được | TC-20 ghi "120 túi, đơn giá 189.000"; tránh vòng lặp sửa sai |
| 8 | Phiếu ngược của phiếu xuất | Đơn giá = `UnitCost` dòng gốc; phiếu ngược của phiếu nhập tính giá theo BR-10 lúc duyệt | BR-12 |
| 9 | Đơn giá hàng bán bị trả lại | (Đã chỉnh ở #47: FE không điền sẵn cho ai.) Thủ kho (không xem được giá vốn) để 0, BE khi **duyệt** phiếu `HangBanTraLai` có dòng giá 0 thì thay bằng giá vốn bình quân hiện tại của kho × hệ số | BR-07 "mặc định bằng giá vốn"; BR-25 không cho thủ kho thấy giá vốn |
| 10 | Thủ kho thấy giá | Thấy, nhập đơn giá, chi phí ở phiếu **nhập** do mình lập; không thấy giá trị ở phiếu xuất, chuyển, kiểm kê, tồn kho, thẻ kho, kể cả phiếu mình lập | BR-25 |
| 11 | Lọc phiếu theo ngày | Ngày chứng từ = ngày ghi sổ, chưa ghi sổ thì ngày gửi, chưa gửi thì ngày lập | Kế toán đối chiếu theo ngày ghi sổ (BR-11) |
| 12 | Gửi duyệt trong lúc lưu | `POST`/`PUT` nhận `submit = true` | Một lần bấm "Gửi duyệt" từ form mới; tránh trạng thái nửa vời khi mạng lỗi |
| 13 | Thao tác đổi trạng thái | `PATCH` trả 200 kèm DTO, không 204 | FE thay cache ngay; như demo Menu QR |
| 14 | Chống ghi đè | `version` bắt buộc ở mọi thao tác trên phiếu, kể cả duyệt | Hai quản lý duyệt cùng lúc, người lập rút lại đúng lúc quản lý duyệt |
| 15 | Chống bấm lặp | `clientRequestId`; trùng với thao tác gần nhất của phiếu thì trả kết quả cũ, không 409 | Bấm Duyệt hai lần không ghi sổ hai lần; không hiện lỗi "vừa cập nhật" vô lý |
| 16 | Giữ chỗ | Chỉ phiếu `ChoDuyet` (xuất, chuyển); kiểm theo tổng các dòng cùng mặt hàng | BR-03, BR-04 |
| 17 | Lỗi vượt khả dụng | Câu nêu **số vượt**, gắn vào mọi dòng của mặt hàng | TC-11 "Vượt tồn khả dụng 20 túi" |
| 18 | Duyệt vượt khả dụng | Cho duyệt nếu đủ tồn thực, kể cả khi làm phiếu chờ khác vượt khả dụng | BR-04 chỉ kiểm tồn thực khi duyệt; phiếu kia bị chặn ở lúc duyệt của nó |
| 19 | Khóa kiểm kê | Tính lúc thao tác từ phiếu kiểm kê đang mở, không lưu cờ; theo nhóm hiện tại của mặt hàng hoặc có dòng trong phiếu | Không lệch khi đổi nhóm giữa chừng; mặt hàng thêm ngoài danh sách cũng bị khóa |
| 20 | Nhận hàng chuyển khi kho đến đang kiểm kê | Chặn bằng `DangKiemKe` | BR-14 nêu rõ |
| 21 | Người đếm | Mặc định thủ kho đầu tiên của kho; người duyệt khác `counterId` và mọi người đã gửi lượt đếm | BR-06 "khác người đếm"; nhiều người đếm (UC-11 4a) |
| 22 | Kiểm kê mù | Ẩn sổ sách với người không có `stocktakes.approve` khi `DangKiem`; quản lý vẫn thấy | BR-15 nói "màn đếm của thủ kho"; quản lý cần theo dõi |
| 23 | Dòng bị trả lại đếm lại | Xóa số đếm, nguyên nhân của dòng đó | UC-11 7a "chỉ các dòng đó... cần đếm lại", BR-17 giữ số dòng khác |
| 24 | Kiểm kê về 0 | Giá trị chênh = −giá trị tồn còn lại | Không để số dư lẻ khi tồn về 0, như BR-10 |
| 25 | Chênh lệch theo % | Dùng số nguyên: \|chênh\| × 100 ≥ 5 × sổ sách | Tránh sai số làm tròn ở biên 5% |
| 26 | Lần xuất gần nhất (chậm luân chuyển) | Xuất bán, dùng nội bộ, chuyển đi; không tính trả nhà cung cấp | BR-22 liệt kê; trả NCC không phải nhu cầu bán |
| 27 | Cảnh báo không ngưỡng | Danh sách tồn vẫn hiện trạng thái; tab Cảnh báo, số trên Tổng quan chỉ đếm dòng có ngưỡng | BR-18 "để trống thì không cảnh báo" |
| 28 | Đề xuất khi không có tồn tối đa | Không đề xuất (null) | BR-19 cần tồn tối đa |
| 29 | Biểu đồ nhập, xuất | Chỉ phiếu nhập, phiếu xuất (trừ Xuất điều chỉnh); không tính chuyển kho, kiểm kê | Chuyển kho là luân chuyển nội bộ, không phải mua bán; TC-31 nhập hôm nay tăng đúng 18.000.000 |
| 30 | Hàng đang chuyển trong báo cáo | Chỉ ở "Tất cả kho"; một kho thì không | BR-21 hàng đang chuyển không thuộc kho nào |
| 31 | Hao hụt vận chuyển | Không ghi thẻ kho; ghi ở dòng phiếu chuyển | Kho đi đã trừ đủ, kho đến chỉ nhận số thực; báo cáo hao hụt đọc phiếu |
| 32 | In phiếu chưa duyệt | Cho in, chữ chìm "CHƯA DUYỆT" | Thủ kho cần bản in để đối chiếu khi giao nhận |
| 33 | Mẫu in | Theo bố cục 01-VT, 02-VT, 05-VT, không ghi số hiệu thông tư | Chế độ kế toán đổi theo thời gian; bố cục là thứ khách quen |
| 34 | Dữ liệu mẫu hôm nay | Không ghi sổ chứng từ nào trong hôm nay; phiếu hôm nay chỉ ở trạng thái chưa kết thúc | Số "Hôm nay" của TC-23, TC-33, TC-34 bắt đầu sạch |
| 35 | Lịch sử ở mock | Phiếu đã kết thúc và thẻ kho của seed giữ trong bộ nhớ, không ghi localStorage | Giới hạn ~5 MB; 3.484 dòng thẻ kho và 592 phiếu đã kết thúc |
| 36 | Tên hàng, mã vạch mẫu | Tên chung không nhãn hiệu; mã vạch tiền tố 20 | Không dùng nhãn hiệu thật trong demo công khai |
| 37 | Ảnh hàng hóa | Theo kiểu hàng (25 ảnh), không theo từng mặt hàng; không tải ảnh lên | Đủ trực quan, nhẹ; SRS không yêu cầu |
| 38 | Nhập Excel danh mục (FR-10, P3) | Chưa có endpoint; làm sau cùng nếu còn thời gian theo mẫu cột của danh sách hàng hóa | P3 |
| 39 | Đếm kiểm kê (`POST counts`) | Không tăng `version` của phiếu (nhiều máy đếm cùng lúc); thao tác khác trên phiếu kiểm kê vẫn tăng | Máy đếm không làm phiếu "cũ" với người gửi duyệt |
| 40 | Dòng "Tất cả kho" ở tồn kho | `avgCost`, `minQty`, `maxQty`, `status` null; `stockValue` là tổng; `sortBy` nhận `productCode` (mặc định), `productName`, `groupName`, `onHand`, `reserved`, `available`, `stockValue` | Giá vốn, ngưỡng là của từng kho |
| 41 | `ApprovalItem.totalValue` của kiểm kê | Chênh lệch thuần `surplusValue − shortageValue` (null khi không xem được giá trị) | Quản lý thấy độ lớn điều chỉnh trước khi mở phiếu |
| 42 | Tổng quan khi không có `stock-values.view` | `topIssued` rỗng (giá trị tồn từng kho vẫn trả vì đã cần `reports.view`) | BR-25 |
| 43 | Câu lỗi thêm (BE, mock dùng giống) | "Mặt hàng không tồn tại", "Đơn vị không thuộc mặt hàng", "Chọn kho", "Chọn kho đến", "Nhà cung cấp không tồn tại", "Nhập lý do xuất điều chỉnh", "Dòng kiểm kê không tồn tại", "Ngày không hợp lệ (yyyy-MM-dd)", "Thiếu mã yêu cầu (clientRequestId)" | Các trường hợp 07 §2 chưa ghi câu |
| 44 | Việc cần làm | `toReceive[].warehouseCode` = kho đến; `counting[].typeText` "Kiểm kê · Toàn kho" hoặc "Kiểm kê · Theo nhóm hàng"; danh sách nháp, bị từ chối, chờ duyệt xếp `updatedAt` giảm dần | Thống nhất với FE-Danh mục & Báo cáo |
| 45 | Đặt lại dữ liệu demo | `POST /api/demo/reset` theo quyền của nền (Quản trị viên) | Không đổi phần nền |
| 46 | Kho đến của phiếu chuyển | Ô "Kho đến" chọn trong mọi kho đang hoạt động (`GET /api/warehouses/options`, mock giống), không chỉ kho được gán. Kho đi vẫn trong phạm vi; nhận hàng vẫn cần kho đến trong phạm vi (thủ kho `KTONG` chuyển tới `KBH` thì `thukho.bh` nhận). Mã kho trên Việc cần làm, Phiếu chờ duyệt tra trên mọi kho | UC-06 "kho đi lập, kho đến nhận" là hai thủ kho khác nhau; dữ liệu mẫu đã có phiếu `KTONG → KBH` do `nhanvien` lập |
| 47 | Đơn giá hàng bán bị trả lại trên form | FE không điền sẵn giá vốn cho ai (cả quản lý); dòng để 0 thì BE, mock thay bằng giá vốn bình quân × hệ số **khi duyệt** như #9, rồi tính lại thành tiền, giá trị phiếu | Một cách cho mọi vai trò; số ghi sổ giống hệt #9 |
| 48 | Trường mở rộng của `TrangThaiKhongHopLe` | Trạng thái phiếu ghi ở `docStatus`, không dùng `status` | `status` là mã HTTP của ProblemDetails; trùng khóa làm FE đọc sai `ApiError.status` |
| 49 | 409 `DuLieuCu` khi tranh chấp ghi lần hai | Vẫn kèm `currentVersion` (đọc lại từ CSDL), như §2.12 | FE có thể báo phiên bản mới mà không cần tải lại |
| 50 | Lỗi theo ô khi gán thủ kho | API trả `errors.userIds` (§2.1); form FE gắn vào ô `keeperIds` | Giữ tên trường request chuẩn |
| 51 | Ô kho trống trên form phiếu chuyển | FE chặn trước khi gửi ("Chọn kho", "Chọn kho đến"); không gửi chuỗi rỗng vì BE đọc kho là `Guid` | Chuỗi rỗng bị chặn ở bước đọc JSON với câu chung "Giá trị không hợp lệ." |
| 52 | Sắp danh sách nhà cung cấp | Cột "Phiếu nhập đã duyệt" không sắp được (số tính từ phiếu, không phải cột của bảng) | BE chỉ sắp theo cột của bảng |
| 53 | Id sau khi đặt lại dữ liệu ở chế độ `api` | BE cấp Guid mới mỗi lần nạp dữ liệu mẫu (mock dùng `stableId`); liên kết lưu trước lần đặt lại không còn đúng | Không ảnh hưởng nghiệp vụ; đặt lại xong tải lại trang |
