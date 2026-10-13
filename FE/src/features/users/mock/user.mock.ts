import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import {
  EMAIL_MESSAGE,
  PASSWORD_MESSAGE,
  PHONE_MESSAGE,
  USERNAME_MESSAGE,
  USERNAME_PATTERN,
  cleanPhone,
  isValidEmail,
  isValidPassword,
  isValidPhone,
} from '@/lib/validators'
import { auditCreate, auditDelete, auditUpdate } from '@/mock/mock-audit'
import { requirePermission } from '@/mock/mock-auth'
import { conflict, domain, notFound, validation } from '@/mock/mock-errors'
import { emptyToNull, listQuery, newId } from '@/mock/mock-helpers'
import {
  activeRoles,
  findLiveUser,
  hashPassword,
  liveUsers,
  refreshTokensDb,
  rolesOfUser,
  usersDb,
  type MockUser,
} from '@/mock/system-data'
import type { PaginatedResult } from '@/types/api'
import type {
  CreateUserRequest,
  LockUserRequest,
  ResetPasswordRequest,
  UpdateUserRequest,
  UserDto,
  UserQuery,
} from '../types/user.types'

const ENTITY = 'User'

function toDto(user: MockUser): UserDto {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    isDemoAccount: user.isDemoAccount,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    roles: rolesOfUser(user).map((r) => ({ id: r.id, code: r.code, name: r.name })),
  }
}

function getOrThrow(id: string): MockUser {
  const user = findLiveUser(id)
  if (!user) throw notFound('Không tìm thấy tài khoản.')
  return user
}

/** Kiểm tra họ tên, email, SĐT, vai trò (dùng cho thêm và sửa). */
function validateProfile(input: UpdateUserRequest, errors: Record<string, string>) {
  if (!input.fullName?.trim()) errors.fullName = 'Nhập họ tên'
  else if (input.fullName.trim().length > 150) errors.fullName = 'Họ tên tối đa 150 ký tự'
  if (input.email?.trim() && !isValidEmail(input.email.trim())) errors.email = EMAIL_MESSAGE
  if (input.phone?.trim() && !isValidPhone(input.phone)) errors.phone = PHONE_MESSAGE
  const roleIds = activeRoles().map((r) => r.id)
  if (!input.roleIds?.length) errors.roleIds = 'Chọn ít nhất một vai trò'
  else if (input.roleIds.some((id) => !roleIds.includes(id))) errors.roleIds = 'Vai trò không tồn tại'
}

/** BR-SYS-05, BR-SYS-10: không khóa/xóa/đặt lại mật khẩu tài khoản demo hoặc chính mình. */
function guardProtected(target: MockUser, currentUserId: string, action: string) {
  if (target.isDemoAccount) throw domain(`Không thể ${action} tài khoản demo.`)
  if (target.id === currentUserId) throw domain(`Bạn không thể tự ${action} tài khoản của mình.`)
}

export const userMock = {
  async getList(query: UserQuery): Promise<PaginatedResult<UserDto>> {
    await mockDelay()
    requirePermission(permissions.users.view)
    let users = liveUsers()
    if (query.roleId) users = users.filter((u) => u.roleIds.includes(query.roleId!))
    if (query.isActive !== undefined) users = users.filter((u) => u.isActive === query.isActive)
    const page = listQuery(users, query, {
      searchFields: ['username', 'fullName', 'email', 'phone'],
    })
    return { ...page, items: page.items.map(toDto) }
  },

  async getById(id: string): Promise<UserDto> {
    await mockDelay()
    requirePermission(permissions.users.view)
    return toDto(getOrThrow(id))
  },

  async create(input: CreateUserRequest): Promise<UserDto> {
    await mockDelay()
    requirePermission(permissions.users.create)
    const username = input.username?.trim().toLowerCase() ?? ''
    const errors: Record<string, string> = {}
    if (!USERNAME_PATTERN.test(username)) errors.username = USERNAME_MESSAGE
    if (!isValidPassword(input.password ?? '')) errors.password = PASSWORD_MESSAGE
    validateProfile(input, errors)
    if (Object.keys(errors).length) throw validation(errors)

    // BR-SYS-01: không trùng tên đăng nhập (TC-SYS-05 báo lỗi tại ô)
    if (liveUsers().some((u) => u.username === username)) {
      throw conflict(`Tên đăng nhập ${username} đã tồn tại.`, { username: 'Tên đăng nhập đã tồn tại' })
    }

    const user: MockUser = {
      id: newId(),
      username,
      fullName: input.fullName.trim(),
      email: emptyToNull(input.email),
      phone: emptyToNull(cleanPhone(input.phone)),
      avatarUrl: null,
      isActive: true,
      isDemoAccount: false,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      roleIds: [...new Set(input.roleIds)],
      passwordHash: hashPassword(username, input.password),
      quickLogin: false,
      sortOrder: 999,
      description: null,
    }
    usersDb.insert(user)
    auditCreate(ENTITY, user)
    return toDto(user)
  },

  async update(id: string, input: UpdateUserRequest): Promise<UserDto> {
    await mockDelay()
    requirePermission(permissions.users.update)
    const before = getOrThrow(id)
    const errors: Record<string, string> = {}
    validateProfile(input, errors)
    if (Object.keys(errors).length) throw validation(errors)

    const after = usersDb.update(id, {
      fullName: input.fullName.trim(),
      email: emptyToNull(input.email),
      phone: emptyToNull(cleanPhone(input.phone)),
      roleIds: [...new Set(input.roleIds)],
    })!
    auditUpdate(ENTITY, before, after)
    return toDto(after)
  },

  async lock(id: string, input: LockUserRequest): Promise<void> {
    await mockDelay()
    const { user: me } = requirePermission(permissions.users.update)
    const before = getOrThrow(id)
    guardProtected(before, me.id, input.isActive ? 'mở khóa' : 'khóa')
    const after = usersDb.update(id, { isActive: input.isActive })!
    auditUpdate(ENTITY, before, after)
  },

  async resetPassword(id: string, input: ResetPasswordRequest): Promise<void> {
    await mockDelay()
    const { user: me } = requirePermission(permissions.users.update)
    const target = getOrThrow(id)
    guardProtected(target, me.id, 'đặt lại mật khẩu')
    if (!isValidPassword(input.newPassword ?? '')) throw validation({ newPassword: PASSWORD_MESSAGE })
    usersDb.update(id, { passwordHash: hashPassword(target.username, input.newPassword) })
    // Thu hồi mọi phiên đang mở của tài khoản này
    refreshTokensDb.all()
      .filter((t) => t.userId === id && !t.revokedAt)
      .forEach((t) => refreshTokensDb.update(t.id, { revokedAt: new Date().toISOString() }))
  },

  async remove(id: string): Promise<void> {
    await mockDelay()
    const { user: me } = requirePermission(permissions.users.delete)
    const target = getOrThrow(id)
    guardProtected(target, me.id, 'xóa')
    // Xóa mềm (UC-SYS-05 1d)
    usersDb.update(id, { isDeleted: true, isActive: false })
    auditDelete(ENTITY, target)
  },
}
