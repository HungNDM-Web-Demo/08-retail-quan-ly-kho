import type { PaginationQuery } from '@/types/api'

/** DTO tài khoản, khớp QUY-UOC-API §4.3. */

export type UserRoleRef = { id: string; code: string; name: string }

export type UserDto = {
  id: string
  username: string
  fullName: string
  email?: string | null
  phone?: string | null
  avatarUrl?: string | null
  isActive: boolean
  isDemoAccount: boolean
  lastLoginAt?: string | null
  createdAt: string
  roles: UserRoleRef[]
}

/** GET /api/users?page&pageSize&search&roleId&isActive → PaginatedResult<UserDto> */
export type UserQuery = PaginationQuery & {
  roleId?: string
  isActive?: boolean
}

export type CreateUserRequest = {
  username: string
  fullName: string
  email?: string | null
  phone?: string | null
  password: string
  roleIds: string[]
}

export type UpdateUserRequest = {
  fullName: string
  email?: string | null
  phone?: string | null
  roleIds: string[]
}

/** PATCH /api/users/{id}/lock → 204 */
export type LockUserRequest = { isActive: boolean }

/** PATCH /api/users/{id}/reset-password → 204 */
export type ResetPasswordRequest = { newPassword: string }
