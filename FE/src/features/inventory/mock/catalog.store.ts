import { permissions } from '@/config/permissions'
import { mockDb } from '@/mock/mock-db'
import { usersDb } from '@/mock/system-data'
import type { MockSessionContext } from '@/mock/mock-auth'
import type { BarcodeMatch, CatalogProduct, UnitReading } from '@/types/inventory'
import { emptyLevel, levelId } from './posting'
import type {
  ProductGroupRecord,
  ProductRecord,
  StockLevelRecord,
  SupplierRecord,
  WarehouseRecord,
} from './records'
import { seedData } from './history.store'
import { seedIds } from './seed-loader'

/**
 * Collection danh mục và dòng tồn (07 §4.8, scope `business`). FE-Phiếu khai báo; FE-Danh mục & Báo cáo đọc, ghi
 * qua các collection và hàm dưới đây (không khai báo collection mới).
 */

export const warehousesDb = mockDb.collection<WarehouseRecord>('warehouses', () => seedData().warehouses)
export const suppliersDb = mockDb.collection<SupplierRecord>('suppliers', () => seedData().suppliers)
export const productGroupsDb = mockDb.collection<ProductGroupRecord>('product-groups', () => seedData().groups)
export const productsDb = mockDb.collection<ProductRecord>('products', () => seedData().products)
/** Tồn của mặt hàng tại kho; id = `levelId(warehouseId, productId)` */
export const stockLevelsDb = mockDb.collection<StockLevelRecord>('stock-levels', () => seedData().levels)

/** Id cố định theo mã của dữ liệu mẫu (06 §5.2) */
export const ids = seedIds

// ───────────────────────── Tra cứu

export const liveWarehouses = () =>
  warehousesDb.filter((w) => !w.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder)
export const liveProducts = () => productsDb.filter((p) => !p.isDeleted)
export const liveSuppliers = () => suppliersDb.filter((s) => !s.isDeleted)
export const liveGroups = () =>
  productGroupsDb.filter((g) => !g.isDeleted).sort((a, b) => a.sortOrder - b.sortOrder)

export const warehouseById = (id: string) => warehousesDb.get(id)
export const productById = (id: string) => productsDb.get(id)
export const supplierById = (id?: string | null) => (id ? suppliersDb.get(id) : undefined)
export const groupById = (id: string) => productGroupsDb.get(id)

/** Họ tên tài khoản (người thao tác đã chụp vào phiếu; dùng khi cần tên hiện tại) */
export const userFullName = (userId: string) => usersDb.get(userId)?.fullName ?? ''

/**
 * Phạm vi kho của người đăng nhập (BR-23, quyết định 1): có `warehouses.assign` (hoặc ADMIN) → mọi kho chưa xóa;
 * không có → kho có người đó trong `keeperUserIds`. Trả danh sách id theo `sortOrder`.
 */
export function warehouseScope(ctx: MockSessionContext): string[] {
  const all = ctx.isSuperAdmin || ctx.permissions.includes(permissions.warehouses.assign)
  return liveWarehouses()
    .filter((w) => all || w.keeperUserIds.includes(ctx.user.id))
    .map((w) => w.id)
}

/** Dòng tồn (không có thì null = coi như tồn 0, không ngưỡng) */
export function stockLevel(warehouseId: string, productId: string): StockLevelRecord | null {
  return stockLevelsDb.get(levelId(warehouseId, productId)) ?? null
}

/** Dòng tồn, chưa có thì trả bản rỗng (chưa lưu) */
export function stockLevelOrEmpty(warehouseId: string, productId: string): StockLevelRecord {
  return stockLevel(warehouseId, productId) ?? emptyLevel(warehouseId, productId)
}

/** Đơn vị quy đổi để đọc số lượng ("23 thùng 16 chai") */
export const unitReadings = (product: Pick<ProductRecord, 'units'>): UnitReading[] =>
  product.units.map((u) => ({ name: u.name, factor: u.factor }))

export function toCatalogProduct(p: ProductRecord): CatalogProduct {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    groupId: p.groupId,
    baseUnit: p.baseUnit,
    barcode: p.barcode,
    spec: p.spec,
    imageUrl: p.imageUrl,
    isActive: p.isActive,
    units: [...p.units]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((u) => ({ id: u.id, name: u.name, factor: u.factor, barcode: u.barcode })),
  }
}

/**
 * Tra mã vạch trên mọi đơn vị của mọi mặt hàng chưa xóa (BR-02); không thấy thì theo mã hàng.
 * `unitId` undefined = mã của đơn vị cơ bản. Không lọc hàng ngừng (người gọi tự báo "đã ngừng sử dụng").
 */
export function findByBarcode(code: string): BarcodeMatch | null {
  const text = code.trim()
  if (!text) return null
  const products = liveProducts()
  for (const p of products) {
    if (p.barcode === text) return { product: toCatalogProduct(p) }
    const unit = p.units.find((u) => u.barcode === text)
    if (unit) return { product: toCatalogProduct(p), unitId: unit.id }
  }
  const byCode = products.find((p) => p.code.toUpperCase() === text.toUpperCase())
  return byCode ? { product: toCatalogProduct(byCode) } : null
}
