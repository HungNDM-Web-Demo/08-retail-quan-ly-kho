import { permissions } from '@/config/permissions'
import {
  findByBarcode,
  liveGroups,
  liveProducts,
  productGroupsDb,
  productsDb,
  stockLevel,
  stockLevelsDb,
} from '@/features/inventory/mock/catalog.store'
import { emptyLevel, levelId } from '@/features/inventory/mock/posting'
import type { ProductGroupRecord, ProductRecord, ProductUnitRecord } from '@/features/inventory/mock/records'
import { stockStatus } from '@/features/inventory/lib/stock-rules'
import {
  catalogUsage,
  conflictError,
  domainError,
  reservedByWarehouse,
  scopedWarehouses,
} from '@/features/stock/mock/inventory-queries'
import { ApiError } from '@/lib/api-error'
import { mockDelay } from '@/lib/data-source'
import { auditCreate, auditDelete, auditUpdate } from '@/mock/mock-audit'
import { requirePermission, type MockSessionContext } from '@/mock/mock-auth'
import { notFound, validation } from '@/mock/mock-errors'
import { listQuery, newId } from '@/mock/mock-helpers'
import type { PaginatedResult } from '@/types/api'
import type {
  BarcodeMatch,
  ProductDetailDto,
  ProductDto,
  ProductGroupDto,
  ProductQuery,
  ProductStockCell,
  SaveProductGroupRequest,
  SaveProductRequest,
  SetActiveRequest,
} from '@/types/inventory'
import {
  BARCODE_PATTERN,
  COLOR_PATTERN,
  GROUP_CODE_PATTERN,
  MAX_FACTOR,
  MAX_UNITS,
  MIN_FACTOR,
  PRODUCT_CODE_PATTERN,
  productMessages as M,
} from '../schemas/product.schema'

/** Handler mock nhóm hàng, mặt hàng, tra mã vạch (07 §2.3), đọc ghi collection của lõi. */

// ───────────────────────── Nhóm hàng

function groupDto(g: ProductGroupRecord, counts: Map<string, number>): ProductGroupDto {
  return {
    id: g.id,
    code: g.code,
    name: g.name,
    color: g.color,
    isActive: g.isActive,
    sortOrder: g.sortOrder,
    productCount: counts.get(g.id) ?? 0,
  }
}

function groupCounts(): Map<string, number> {
  const map = new Map<string, number>()
  for (const p of liveProducts()) map.set(p.groupId, (map.get(p.groupId) ?? 0) + 1)
  return map
}

function findGroup(id: string): ProductGroupRecord {
  const g = productGroupsDb.get(id)
  if (!g || g.isDeleted) throw notFound('Không tìm thấy nhóm hàng.')
  return g
}

function validateGroup(input: SaveProductGroupRequest, selfId?: string): SaveProductGroupRequest {
  const code = (input.code ?? '').trim().toUpperCase()
  const errors: Record<string, string> = {}
  if (!GROUP_CODE_PATTERN.test(code)) errors.code = M.groupCode
  if (!input.name?.trim()) errors.name = M.groupName
  if (!COLOR_PATTERN.test(input.color ?? '')) errors.color = M.color
  if (Object.keys(errors).length) throw validation(errors)
  if (liveGroups().some((g) => g.code === code && g.id !== selfId)) {
    throw conflictError('Mã nhóm hàng đã tồn tại', { code: 'Mã nhóm hàng đã tồn tại' })
  }
  return { code, name: input.name.trim(), color: input.color.toUpperCase() }
}

// ───────────────────────── Mặt hàng

type Ctx = {
  warehouses: ReturnType<typeof scopedWarehouses>
  reserved: Map<string, Map<string, number>>
  groups: Map<string, ProductGroupRecord>
  used: ReturnType<typeof catalogUsage>
}

function makeCtx(session: MockSessionContext): Ctx {
  const warehouses = scopedWarehouses(session)
  return {
    warehouses,
    reserved: reservedByWarehouse(warehouses.map((w) => w.id)),
    groups: new Map(productGroupsDb.all().map((g) => [g.id, g])),
    used: catalogUsage(),
  }
}

function productDto(p: ProductRecord, ctx: Ctx): ProductDto {
  const g = ctx.groups.get(p.groupId)
  const stocks: ProductStockCell[] = ctx.warehouses
    .map((w) => {
      const level = stockLevel(w.id, p.id)
      if (!w.isActive && !level?.onHand) return null
      const reserved = ctx.reserved.get(w.id)?.get(p.id) ?? 0
      return {
        warehouseId: w.id,
        warehouseCode: w.code,
        onHand: level?.onHand ?? 0,
        status: stockStatus({ onHand: level?.onHand ?? 0, minQty: level?.minQty, maxQty: level?.maxQty }, reserved),
      }
    })
    .filter((c): c is ProductStockCell => !!c)
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    groupId: p.groupId,
    groupName: g?.name ?? '',
    groupColor: g?.color ?? '#64748B',
    baseUnit: p.baseUnit,
    barcode: p.barcode,
    spec: p.spec,
    imageUrl: p.imageUrl,
    isActive: p.isActive,
    units: [...p.units]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((u) => ({ ...u, isUsed: ctx.used.unitIds.has(u.id) })),
    stocks,
    totalOnHand: stocks.reduce((s, c) => s + c.onHand, 0),
    hasDocuments: ctx.used.productIds.has(p.id),
  }
}

function detailDto(p: ProductRecord, ctx: Ctx): ProductDetailDto {
  return {
    ...productDto(p, ctx),
    levels: ctx.warehouses
      .filter((w) => w.isActive)
      .map((w) => {
        const l = stockLevel(w.id, p.id)
        return {
          warehouseId: w.id,
          warehouseCode: w.code,
          warehouseName: w.name,
          minQty: l?.minQty ?? undefined,
          maxQty: l?.maxQty ?? undefined,
          onHand: l?.onHand ?? 0,
        }
      }),
  }
}

function findProduct(id: string): ProductRecord {
  const p = productsDb.get(id)
  if (!p || p.isDeleted) throw notFound('Không tìm thấy mặt hàng.')
  return p
}

const isNonNegInt = (v: unknown) => v === null || v === undefined || (Number.isInteger(v) && (v as number) >= 0)

/** Thứ tự kiểm 07 §2.3: định dạng 400 → tham chiếu 400 → đơn vị đã dùng 400 → trùng 409 */
function validateProduct(input: SaveProductRequest, self?: ProductRecord): void {
  const errors: Record<string, string> = {}
  const code = (input.code ?? '').trim().toUpperCase()
  if (!PRODUCT_CODE_PATTERN.test(code)) errors.code = M.code
  if (!input.name?.trim()) errors.name = M.name
  if (!input.baseUnit?.trim()) errors.baseUnit = M.baseUnit
  if (input.barcode && !BARCODE_PATTERN.test(input.barcode)) errors.barcode = M.barcode
  const units = input.units ?? []
  if (units.length > MAX_UNITS) errors.units = M.units
  units.forEach((u, i) => {
    if (!u.name?.trim()) errors[`units[${i}].name`] = M.unitName
    if (!Number.isInteger(u.factor) || u.factor < MIN_FACTOR || u.factor > MAX_FACTOR) errors[`units[${i}].factor`] = M.factor
    if (u.barcode && !BARCODE_PATTERN.test(u.barcode)) errors[`units[${i}].barcode`] = M.barcode
    const dup = units.some(
      (o, j) => j < i && (o.name.trim().toLowerCase() === u.name.trim().toLowerCase() || o.factor === u.factor)
    )
    if (dup) errors[`units[${i}].name`] = M.duplicateUnit
  })
  ;(input.levels ?? []).forEach((l, i) => {
    if (!isNonNegInt(l.minQty)) errors[`levels[${i}].minQty`] = M.minQty
    if (!isNonNegInt(l.maxQty)) errors[`levels[${i}].maxQty`] = M.maxQty
    if (l.minQty != null && l.maxQty != null && isNonNegInt(l.minQty) && isNonNegInt(l.maxQty) && l.minQty >= l.maxQty) {
      errors[`levels[${i}].minQty`] = M.minBelowMax
    }
  })
  if (Object.keys(errors).length) throw validation(errors)

  // Tham chiếu: nhóm đang sử dụng (giữ nhóm cũ đã ngừng thì vẫn được)
  const group = productGroupsDb.get(input.groupId)
  if (!group || group.isDeleted || (!group.isActive && group.id !== self?.groupId)) {
    throw validation({ groupId: M.groupId })
  }

  // Đơn vị đã có chứng từ: không đổi hệ số, không xóa (BR-24, TC-03)
  if (self) {
    const used = catalogUsage().unitIds
    for (const old of self.units.filter((u) => used.has(u.id))) {
      const i = units.findIndex((u) => u.id === old.id)
      if (i < 0 || units[i].factor !== old.factor) {
        const key = i < 0 ? 'units' : `units[${i}].factor`
        throw ApiError.fromStatus(400, M.unitUsed, { code: 'DonViDaDung', errors: { [key]: [M.unitUsed] } })
      }
    }
  }

  // Trùng mã hàng (TC-02 bước 1)
  const others = liveProducts().filter((p) => p.id !== self?.id)
  const sameCode = others.find((p) => p.code === code)
  if (sameCode) throw conflictError(`Mã hàng đã dùng cho ${sameCode.name}`, { code: `Mã hàng đã dùng cho ${sameCode.name}` })

  // Trùng mã vạch giữa mọi đơn vị của mọi mặt hàng (TC-02 bước 2)
  const owners = new Map<string, string>()
  for (const p of others) {
    if (p.barcode) owners.set(p.barcode, `${p.name} – ${p.baseUnit}`)
    for (const u of p.units) if (u.barcode) owners.set(u.barcode, `${p.name} – ${u.name}`)
  }
  const mine: { key: string; barcode: string; label: string }[] = []
  if (input.barcode) mine.push({ key: 'barcode', barcode: input.barcode, label: `${input.name.trim()} – ${input.baseUnit.trim()}` })
  units.forEach((u, i) => u.barcode && mine.push({ key: `units[${i}].barcode`, barcode: u.barcode, label: `${input.name.trim()} – ${u.name.trim()}` }))
  for (const [i, b] of mine.entries()) {
    const owner = owners.get(b.barcode) ?? mine.find((o, j) => j < i && o.barcode === b.barcode)?.label
    if (owner) {
      const msg = `Mã vạch đã dùng cho ${owner}`
      throw conflictError(msg, { [b.key]: msg }, 'MaVachTrung')
    }
  }
}

function buildUnits(input: SaveProductRequest, self?: ProductRecord): ProductUnitRecord[] {
  return [...(input.units ?? [])]
    .sort((a, b) => a.factor - b.factor)
    .map((u, i) => ({
      id: u.id && self?.units.some((x) => x.id === u.id) ? u.id : newId(),
      name: u.name.trim(),
      factor: u.factor,
      barcode: u.barcode?.trim() || undefined,
      sortOrder: i + 1,
    }))
}

/** Ghi ngưỡng tồn theo kho trong phạm vi; tạo dòng tồn khi có ngưỡng (06 §4 Inventory_StockLevels) */
function saveLevels(productId: string, input: SaveProductRequest, session: MockSessionContext) {
  const scope = new Set(scopedWarehouses(session).map((w) => w.id))
  for (const l of input.levels ?? []) {
    if (!scope.has(l.warehouseId)) continue
    const minQty = l.minQty ?? null
    const maxQty = l.maxQty ?? null
    const existing = stockLevel(l.warehouseId, productId)
    if (existing) stockLevelsDb.update(existing.id, { minQty, maxQty })
    else if (minQty !== null || maxQty !== null) {
      stockLevelsDb.insert({ ...emptyLevel(l.warehouseId, productId, levelId(l.warehouseId, productId)), minQty, maxQty })
    }
  }
}

const searchFields = [
  (p: ProductRecord) => [p.code, p.name, p.barcode, ...p.units.map((u) => u.barcode)].filter(Boolean).join(' '),
]

export const productMock = {
  // ---------- Nhóm hàng
  async createGroup(input: SaveProductGroupRequest): Promise<ProductGroupDto> {
    await mockDelay()
    requirePermission(permissions.products.create)
    const v = validateGroup(input)
    const maxSort = productGroupsDb.all().reduce((m, g) => Math.max(m, g.sortOrder), 0)
    const record: ProductGroupRecord = { id: newId(), ...v, isActive: true, sortOrder: maxSort + 10, createdAt: new Date().toISOString() }
    productGroupsDb.insert(record)
    auditCreate('ProductGroup', record)
    return groupDto(record, groupCounts())
  },

  async updateGroup(id: string, input: SaveProductGroupRequest): Promise<ProductGroupDto> {
    await mockDelay()
    requirePermission(permissions.products.update)
    const before = findGroup(id)
    const v = validateGroup(input, id)
    const after = productGroupsDb.update(id, v)!
    auditUpdate('ProductGroup', before, after)
    return groupDto(after, groupCounts())
  },

  async setGroupStatus(id: string, input: SetActiveRequest): Promise<ProductGroupDto> {
    await mockDelay()
    requirePermission(permissions.products.update)
    const before = findGroup(id)
    const after = productGroupsDb.update(id, { isActive: !!input.isActive })!
    auditUpdate('ProductGroup', before, after)
    return groupDto(after, groupCounts())
  },

  async removeGroup(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.products.delete)
    const g = findGroup(id)
    const productCount = groupCounts().get(id) ?? 0
    if (productCount > 0) {
      throw domainError('NhomConHang', `Nhóm hàng đang có ${productCount} mặt hàng, chuyển mặt hàng sang nhóm khác trước`, {
        productCount,
      })
    }
    productGroupsDb.update(id, { isDeleted: true })
    auditDelete('ProductGroup', g)
  },

  // ---------- Mặt hàng
  async getList(query: ProductQuery): Promise<PaginatedResult<ProductDto>> {
    await mockDelay()
    const session = requirePermission(permissions.products.view)
    const filtered = liveProducts().filter(
      (p) =>
        (!query.groupId || p.groupId === query.groupId) &&
        (query.isActive === undefined || String(p.isActive) === String(query.isActive))
    )
    const page = listQuery(filtered, query, { searchFields, defaultSortBy: 'code', defaultSortDir: 'asc' })
    const ctx = makeCtx(session)
    return { ...page, items: page.items.map((p) => productDto(p, ctx)) }
  },

  async getById(id: string): Promise<ProductDetailDto> {
    await mockDelay()
    const session = requirePermission(permissions.products.view)
    return detailDto(findProduct(id), makeCtx(session))
  },

  async byBarcode(barcode: string): Promise<BarcodeMatch> {
    requirePermission(
      permissions.products.view,
      permissions.goodsReceipts.create,
      permissions.goodsIssues.create,
      permissions.transfers.create,
      permissions.stocktakes.count
    )
    const match = findByBarcode(barcode)
    if (!match) throw ApiError.fromStatus(404, `Không tìm thấy mã ${barcode}`, { code: 'MaVachKhongTonTai' })
    return match
  },

  async create(input: SaveProductRequest): Promise<ProductDetailDto> {
    await mockDelay()
    const session = requirePermission(permissions.products.create)
    validateProduct(input)
    const id = newId()
    const record: ProductRecord = {
      id,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      groupId: input.groupId,
      baseUnit: input.baseUnit.trim(),
      barcode: input.barcode?.trim() || undefined,
      spec: input.spec?.trim() || undefined,
      isActive: true,
      units: buildUnits(input),
      createdAt: new Date().toISOString(),
    }
    productsDb.insert(record)
    saveLevels(id, input, session)
    auditCreate('Product', record)
    return detailDto(record, makeCtx(session))
  },

  async update(id: string, input: SaveProductRequest): Promise<ProductDetailDto> {
    await mockDelay()
    const session = requirePermission(permissions.products.update)
    const before = findProduct(id)
    validateProduct(input, before)
    const after = productsDb.update(id, {
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      groupId: input.groupId,
      baseUnit: input.baseUnit.trim(),
      barcode: input.barcode?.trim() || undefined,
      spec: input.spec?.trim() || undefined,
      units: buildUnits(input, before),
    })!
    saveLevels(id, input, session)
    auditUpdate('Product', before, after)
    return detailDto(after, makeCtx(session))
  },

  async setStatus(id: string, input: SetActiveRequest): Promise<ProductDto> {
    await mockDelay()
    const session = requirePermission(permissions.products.update)
    const before = findProduct(id)
    const after = productsDb.update(id, { isActive: !!input.isActive })!
    auditUpdate('Product', before, after)
    return productDto(after, makeCtx(session))
  },

  async remove(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.products.delete)
    const p = findProduct(id)
    if (catalogUsage().productIds.has(id) || stockLevelsDb.some((l) => l.productId === id && l.onHand !== 0)) {
      throw domainError('DaCoChungTu', 'Mặt hàng đã có chứng từ, không xóa được. Hãy dùng Ngừng')
    }
    productsDb.update(id, { isDeleted: true, isActive: false })
    stockLevelsDb.removeWhere((l) => l.productId === id)
    auditDelete('Product', p)
  },
}
