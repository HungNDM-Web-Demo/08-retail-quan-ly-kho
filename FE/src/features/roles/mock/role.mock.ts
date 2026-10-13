import { permissions, roleCodes } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { ROLE_CODE_MESSAGE, ROLE_CODE_PATTERN } from '@/lib/validators'
import { auditCreate, auditDelete, auditUpdate } from '@/mock/mock-audit'
import { requirePermission } from '@/mock/mock-auth'
import { conflict, domain, notFound, validation } from '@/mock/mock-errors'
import { emptyToNull, newId } from '@/mock/mock-helpers'
import {
  activeRoles,
  allPermissionCodes,
  expandPermissions,
  liveUsers,
  permissionCatalog,
  rolesDb,
  type MockRole,
} from '@/mock/system-data'
import type {
  CreateRoleRequest,
  PermissionGroup,
  RoleDto,
  UpdateRolePermissionsRequest,
  UpdateRoleRequest,
} from '../types/role.types'

const ENTITY = 'Role'

function toDto(role: MockRole): RoleDto {
  const isAdmin = role.code === roleCodes.admin
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    userCount: liveUsers().filter((u) => u.roleIds.includes(role.id)).length,
    // BR-SYS-06: ADMIN luôn có toàn bộ quyền
    permissions: isAdmin ? allPermissionCodes() : expandPermissions(role.permissions),
  }
}

function getOrThrow(id: string): MockRole {
  const role = rolesDb.get(id)
  if (!role || role.isDeleted) throw notFound('Không tìm thấy vai trò.')
  return role
}

function checkPermissionCodes(codes: string[]) {
  const all = allPermissionCodes()
  const unknown = codes.filter((c) => !all.includes(c))
  if (unknown.length) throw validation({ permissions: `Mã quyền không tồn tại: ${unknown.join(', ')}` })
}

function validateInfo(input: UpdateRoleRequest, errors: Record<string, string>) {
  if (!input.name?.trim()) errors.name = 'Nhập tên vai trò'
  else if (input.name.trim().length > 100) errors.name = 'Tên vai trò tối đa 100 ký tự'
  if ((input.description ?? '').length > 500) errors.description = 'Mô tả tối đa 500 ký tự'
}

/** Thứ tự vai trò: hệ thống trước (ADMIN, MANAGER, STAFF), sau đó theo ngày tạo. */
function sortRoles(roles: MockRole[]) {
  return [...roles].sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export const roleMock = {
  async getList(): Promise<RoleDto[]> {
    await mockDelay()
    requirePermission(permissions.roles.view)
    return sortRoles(activeRoles()).map(toDto)
  },

  async getById(id: string): Promise<RoleDto> {
    await mockDelay()
    requirePermission(permissions.roles.view)
    return toDto(getOrThrow(id))
  },

  async getPermissionGroups(): Promise<PermissionGroup[]> {
    await mockDelay(100, 250)
    requirePermission(permissions.roles.view)
    const groups = new Map<string, PermissionGroup>()
    for (const p of permissionCatalog()) {
      if (!groups.has(p.groupName)) groups.set(p.groupName, { groupName: p.groupName, items: [] })
      groups.get(p.groupName)!.items.push({ code: p.code, name: p.name, sortOrder: p.sortOrder })
    }
    return [...groups.values()]
  },

  async create(input: CreateRoleRequest): Promise<RoleDto> {
    await mockDelay()
    requirePermission(permissions.roles.create)
    const code = input.code?.trim().toUpperCase() ?? ''
    const errors: Record<string, string> = {}
    if (!ROLE_CODE_PATTERN.test(code)) errors.code = ROLE_CODE_MESSAGE
    validateInfo(input, errors)
    if (Object.keys(errors).length) throw validation(errors)
    if (activeRoles().some((r) => r.code === code)) {
      throw conflict(`Mã vai trò ${code} đã tồn tại.`, { code: 'Mã vai trò đã tồn tại' })
    }
    checkPermissionCodes(input.permissions ?? [])

    const role: MockRole = {
      id: newId(),
      code,
      name: input.name.trim(),
      description: emptyToNull(input.description),
      isSystem: false,
      permissions: [...new Set(input.permissions ?? [])],
      createdAt: new Date().toISOString(),
    }
    rolesDb.insert(role)
    auditCreate(ENTITY, role)
    return toDto(role)
  },

  async update(id: string, input: UpdateRoleRequest): Promise<RoleDto> {
    await mockDelay()
    requirePermission(permissions.roles.update)
    const before = getOrThrow(id)
    const errors: Record<string, string> = {}
    validateInfo(input, errors)
    if (Object.keys(errors).length) throw validation(errors)
    const after = rolesDb.update(id, {
      name: input.name.trim(),
      description: emptyToNull(input.description),
    })!
    auditUpdate(ENTITY, before, after)
    return toDto(after)
  },

  async updatePermissions(id: string, input: UpdateRolePermissionsRequest): Promise<RoleDto> {
    await mockDelay()
    requirePermission(permissions.roles.update)
    const before = getOrThrow(id)
    if (before.code === roleCodes.admin) {
      throw domain('Vai trò Quản trị viên luôn có toàn bộ quyền, không cần phân quyền.')
    }
    checkPermissionCodes(input.permissions ?? [])
    const after = rolesDb.update(id, {
      permissions: allPermissionCodes().filter((c) => input.permissions.includes(c)),
    })!
    auditUpdate(ENTITY, before, after)
    return toDto(after)
  },

  async remove(id: string): Promise<void> {
    await mockDelay()
    requirePermission(permissions.roles.delete)
    const role = getOrThrow(id)
    // BR-SYS-06, BR-SYS-07
    if (role.isSystem) throw domain(`Không thể xóa vai trò hệ thống ${role.name}.`)
    const userCount = liveUsers().filter((u) => u.roleIds.includes(role.id)).length
    if (userCount > 0) {
      throw domain(`Vai trò ${role.name} đang gán cho ${userCount} tài khoản, hãy đổi vai trò các tài khoản đó trước.`)
    }
    // Xóa mềm để không bị nạp lại từ seed
    rolesDb.update(id, { isDeleted: true })
    auditDelete(ENTITY, role)
  },
}
