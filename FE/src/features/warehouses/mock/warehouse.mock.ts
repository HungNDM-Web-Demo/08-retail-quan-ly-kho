import { permissions, roleCodes } from '@/config/permissions'
import { liveWarehouses, stockLevelsDb, warehousesDb } from '@/features/inventory/mock/catalog.store'
import type { WarehouseRecord } from '@/features/inventory/mock/records'
import {
  canViewValues,
  catalogUsage,
  conflictError,
  domainError,
  openDocumentCounts,
  outOfScopeError,
  scopedWarehouses,
  userRef,
} from '@/features/stock/mock/inventory-queries'
import { mockDelay } from '@/lib/data-source'
import { cleanPhone, isValidPhone, PHONE_MESSAGE } from '@/lib/validators'
import { auditCreate, auditDelete, auditUpdate } from '@/mock/mock-audit'
import { requirePermission, type MockSessionContext } from '@/mock/mock-auth'
import { notFound, validation } from '@/mock/mock-errors'
import { emptyToNull, newId } from '@/mock/mock-helpers'
import { liveUsers, rolesOfUser } from '@/mock/system-data'
import type {
  AssignKeepersRequest,
  KeeperCandidate,
  SaveWarehouseRequest,
  SetActiveRequest,
  UserRef,
  WarehouseDto,
} from '@/types/inventory'
import { WAREHOUSE_CODE_MESSAGE, WAREHOUSE_CODE_PATTERN, WAREHOUSE_NAME_MESSAGE } from '../schemas/warehouse.schema'

/** Handler mock kho, thủ kho phụ trách (07 §2.1). `GET /api/warehouses/my` thuộc lõi. */

type Totals = { stocked: number; value: number }

function levelTotals(): Map<string, Totals> {
  const map = new Map<string, Totals>()
  for (const l of stockLevelsDb.all()) {
    const t = map.get(l.warehouseId) ?? { stocked: 0, value: 0 }
    if (l.onHand > 0) t.stocked += 1
    t.value += l.stockValue
    map.set(l.warehouseId, t)
  }
  return map
}

function build(ctx: MockSessionContext, list: WarehouseRecord[]): WarehouseDto[] {
  const totals = levelTotals()
  const open = openDocumentCounts()
  const used = catalogUsage().warehouseIds
  const showValue = canViewValues(ctx)
  return list.map((w) => ({
    id: w.id,
    code: w.code,
    name: w.name,
    address: w.address,
    phone: w.phone,
    isActive: w.isActive,
    sortOrder: w.sortOrder,
    keepers: w.keeperUserIds.map(userRef).filter((u): u is UserRef => !!u),
    stockedProductCount: totals.get(w.id)?.stocked ?? 0,
    stockValue: showValue ? (totals.get(w.id)?.value ?? 0) : undefined,
    openDocumentCount: open.get(w.id) ?? 0,
    hasDocuments: used.has(w.id) || (totals.get(w.id)?.stocked ?? 0) > 0,
  }))
}

/** Kho trong phạm vi; ngoài phạm vi → 403 KhongPhuTrachKho */
function findInScope(ctx: MockSessionContext, id: string): WarehouseRecord {
  const w = warehousesDb.get(id)
  if (!w || w.isDeleted) throw notFound('Không tìm thấy kho.')
  if (!scopedWarehouses(ctx).some((x) => x.id === id)) {
    throw outOfScopeError(w.code)
  }
  return w
}

const isStaff = (userId: string) => {
  const u = liveUsers().find((x) => x.id === userId)
  return !!u && u.isActive && rolesOfUser(u).some((r) => r.code === roleCodes.staff)
}

function validate(input: SaveWarehouseRequest, selfId?: string): SaveWarehouseRequest {
  const code = (input.code ?? '').trim().toUpperCase()
  const errors: Record<string, string> = {}
  if (!WAREHOUSE_CODE_PATTERN.test(code)) errors.code = WAREHOUSE_CODE_MESSAGE
  if (!input.name?.trim()) errors.name = WAREHOUSE_NAME_MESSAGE
  if (input.phone?.trim() && !isValidPhone(input.phone)) errors.phone = PHONE_MESSAGE
  if (Object.keys(errors).length) throw validation(errors)
  if (liveWarehouses().some((w) => w.code === code && w.id !== selfId)) {
    throw conflictError('Mã kho đã tồn tại', { code: 'Mã kho đã tồn tại' })
  }
  return {
    code,
    name: input.name.trim(),
    address: emptyToNull(input.address) ?? undefined,
    phone: cleanPhone(emptyToNull(input.phone)) ?? undefined,
  }
}

export const warehouseMock = {
  async getList(): Promise<WarehouseDto[]> {
    await mockDelay()
    const ctx = requirePermission(permissions.warehouses.view)
    return build(ctx, scopedWarehouses(ctx))
  },

  async getKeeperCandidates(): Promise<KeeperCandidate[]> {
    await mockDelay(100, 200)
    requirePermission(permissions.warehouses.assign)
    const warehouses = liveWarehouses()
    return liveUsers()
      .filter((u) => isStaff(u.id))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.fullName.localeCompare(b.fullName))
      .map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        warehouseCodes: warehouses.filter((w) => w.keeperUserIds.includes(u.id)).map((w) => w.code),
      }))
  },

  async getById(id: string): Promise<WarehouseDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.warehouses.view)
    return build(ctx, [findInScope(ctx, id)])[0]
  },

  async create(input: SaveWarehouseRequest): Promise<WarehouseDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.warehouses.create)
    const v = validate(input)
    const maxSort = warehousesDb.all().reduce((m, w) => Math.max(m, w.sortOrder), 0)
    const record: WarehouseRecord = {
      id: newId(),
      code: v.code,
      name: v.name,
      address: v.address,
      phone: v.phone,
      isActive: true,
      sortOrder: maxSort + 10,
      keeperUserIds: [],
      createdAt: new Date().toISOString(),
    }
    warehousesDb.insert(record)
    auditCreate('Warehouse', record)
    return build(ctx, [record])[0]
  },

  async update(id: string, input: SaveWarehouseRequest): Promise<WarehouseDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.warehouses.update)
    const before = findInScope(ctx, id)
    const v = validate(input, id)
    if (v.code !== before.code && catalogUsage().warehouseIds.has(id)) {
      throw validation({ code: 'Kho đã có chứng từ, không đổi mã được' })
    }
    const after = warehousesDb.update(id, { code: v.code, name: v.name, address: v.address, phone: v.phone })!
    auditUpdate('Warehouse', before, after)
    return build(ctx, [after])[0]
  },

  /** Ngừng: còn tồn > 0 hoặc phiếu chưa kết thúc → 400 KhoConTon (BR-24, TC-05) */
  async setStatus(id: string, input: SetActiveRequest): Promise<WarehouseDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.warehouses.update)
    const before = findInScope(ctx, id)
    if (!input.isActive && before.isActive) {
      const productCount = stockLevelsDb.filter((l) => l.warehouseId === id && l.onHand > 0).length
      const openDocumentCount = openDocumentCounts().get(id) ?? 0
      if (productCount > 0 || openDocumentCount > 0) {
        throw domainError(
          'KhoConTon',
          `Kho ${before.code} còn ${productCount} mặt hàng tồn và ${openDocumentCount} phiếu chưa kết thúc, không ngừng hoạt động được`,
          { productCount, openDocumentCount }
        )
      }
    }
    const after = warehousesDb.update(id, { isActive: !!input.isActive })!
    auditUpdate('Warehouse', before, after)
    return build(ctx, [after])[0]
  },

  async assignKeepers(id: string, input: AssignKeepersRequest): Promise<WarehouseDto> {
    await mockDelay()
    const ctx = requirePermission(permissions.warehouses.assign)
    const before = findInScope(ctx, id)
    const userIds = [...new Set(input.userIds ?? [])]
    if (userIds.some((u) => !isStaff(u))) {
      throw validation({ userIds: 'Chỉ gán tài khoản vai trò Thủ kho đang hoạt động' })
    }
    const after = warehousesDb.update(id, { keeperUserIds: userIds })!
    auditUpdate('Warehouse', { id, keepers: before.keeperUserIds }, { id, keepers: after.keeperUserIds })
    return build(ctx, [after])[0]
  },

  async remove(id: string): Promise<void> {
    await mockDelay()
    const ctx = requirePermission(permissions.warehouses.delete)
    const w = findInScope(ctx, id)
    const hasStock = stockLevelsDb.some((l) => l.warehouseId === id && l.onHand !== 0)
    if (hasStock || catalogUsage().warehouseIds.has(id)) {
      throw domainError('DaCoChungTu', 'Kho đã có chứng từ, không xóa được. Hãy dùng Ngừng')
    }
    warehousesDb.update(id, { isDeleted: true, isActive: false })
    stockLevelsDb.removeWhere((l) => l.warehouseId === id)
    auditDelete('Warehouse', w)
  },
}
