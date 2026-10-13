/** DTO vai trò và quyền, khớp QUY-UOC-API §4.4. */

export type RoleDto = {
  id: string
  code: string
  name: string
  description?: string | null
  isSystem: boolean
  userCount: number
  permissions: string[]
}

export type CreateRoleRequest = {
  code: string
  name: string
  description?: string | null
  permissions: string[]
}

export type UpdateRoleRequest = {
  name: string
  description?: string | null
}

/** PUT /api/roles/{id}/permissions → RoleDto */
export type UpdateRolePermissionsRequest = { permissions: string[] }

export type PermissionItem = { code: string; name: string; sortOrder: number }

/** GET /api/permissions */
export type PermissionGroup = {
  groupName: string
  items: PermissionItem[]
}
