import { permissions } from '@/config/permissions'
import { requirePermission, requireSession, type MockSessionContext } from '@/mock/mock-auth'
import { inventoryErrors } from './errors'
import { warehouseById, warehouseScope } from './catalog.store'

/**
 * Ngữ cảnh người gọi cho handler mock nghiệp vụ: quyền (như [AuthorizePermission] của BE), phạm vi kho (BR-23),
 * quyền xem giá trị (BR-25).
 */
export type InventoryContext = MockSessionContext & {
  userId: string
  fullName: string
  can: (permission: string) => boolean
  /** Thấy mọi kho (`warehouses.assign`) */
  allWarehouses: boolean
  /** Id kho trong phạm vi, theo sortOrder */
  scopeIds: string[]
  inScope: (warehouseId: string | null | undefined) => boolean
  /** Có `stock-values.view` */
  canViewValues: boolean
  /** Ném 403 `KhongPhuTrachKho` nếu kho ngoài phạm vi */
  assertScope: (warehouseId: string) => void
}

function build(session: MockSessionContext): InventoryContext {
  const can = (p: string) => session.isSuperAdmin || session.permissions.includes(p)
  const scopeIds = warehouseScope(session)
  const scope = new Set(scopeIds)
  const inScope = (id: string | null | undefined) => !!id && scope.has(id)
  return {
    ...session,
    userId: session.user.id,
    fullName: session.user.fullName,
    can,
    allWarehouses: can(permissions.warehouses.assign),
    scopeIds,
    inScope,
    canViewValues: can(permissions.stockValues.view),
    assertScope: (warehouseId) => {
      if (!inScope(warehouseId)) throw inventoryErrors.khongPhuTrachKho(warehouseById(warehouseId)?.code ?? '')
    },
  }
}

/** Cần một trong các quyền (rỗng = chỉ cần đăng nhập) */
export function inventoryContext(...codes: string[]): InventoryContext {
  return build(codes.length ? requirePermission(...codes) : requireSession())
}

/** Bộ lọc `warehouseId` ngoài phạm vi bị bỏ qua như không lọc (UC-08 E1, TC-06) */
export function scopedWarehouseFilter(ctx: InventoryContext, warehouseId?: string | null): string | undefined {
  return warehouseId && ctx.inScope(warehouseId) ? warehouseId : undefined
}
