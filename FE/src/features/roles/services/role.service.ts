import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import { roleMock } from '../mock/role.mock'
import type {
  CreateRoleRequest,
  PermissionGroup,
  RoleDto,
  UpdateRolePermissionsRequest,
  UpdateRoleRequest,
} from '../types/role.types'

/** GET /api/roles: nhận cả mảng lẫn PaginatedResult để không phụ thuộc cách BE trả danh sách. */
async function fetchRoles(): Promise<RoleDto[]> {
  const data = await apiCall.get<RoleDto[] | PaginatedResult<RoleDto>>(apiRoutes.roles.list, {
    params: { page: 1, pageSize: 100 },
  })
  return Array.isArray(data) ? data : data.items
}

export const roleService = {
  getList: (): Promise<RoleDto[]> => (isMockMode() ? roleMock.getList() : fetchRoles()),

  getById: (id: string): Promise<RoleDto> =>
    isMockMode() ? roleMock.getById(id) : apiCall.get<RoleDto>(apiRoutes.roles.detail(id)),

  getPermissionGroups: (): Promise<PermissionGroup[]> =>
    isMockMode()
      ? roleMock.getPermissionGroups()
      : apiCall.get<PermissionGroup[]>(apiRoutes.permissions.list),

  create: (input: CreateRoleRequest): Promise<RoleDto> =>
    isMockMode() ? roleMock.create(input) : apiCall.post<RoleDto>(apiRoutes.roles.list, input),

  update: (id: string, input: UpdateRoleRequest): Promise<RoleDto> =>
    isMockMode()
      ? roleMock.update(id, input)
      : apiCall.put<RoleDto>(apiRoutes.roles.detail(id), input),

  updatePermissions: (id: string, input: UpdateRolePermissionsRequest): Promise<RoleDto> =>
    isMockMode()
      ? roleMock.updatePermissions(id, input)
      : apiCall.put<RoleDto>(apiRoutes.roles.permissions(id), input),

  remove: (id: string): Promise<void> =>
    isMockMode() ? roleMock.remove(id) : apiCall.delete(apiRoutes.roles.detail(id)),
}
