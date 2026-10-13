import { appConfig } from '@/config/app.config'
import { roleCodes } from '@/config/permissions'
import { mockDb } from './mock-db'
import { daysAgo, mockHash, stableId } from './mock-helpers'
import { systemSeed, type SeedPermission } from './system-seed'
import type { AuditLogDto } from '@/features/audit-logs/types/audit-log.types'

// Sửa system.json / project.json là trình duyệt tự bỏ dữ liệu mẫu cũ (xem MockDb.registerSeed)
mockDb.registerSeed('system', systemSeed)

/**
 * Collection dữ liệu hệ thống ở chế độ mock (nhóm bảng System_*).
 * scope 'system': giữ nguyên khi "Đặt lại dữ liệu" (BR-SYS-09).
 * Danh mục quyền chỉ đọc từ seed, không lưu (System_Permissions chỉ seed).
 */

export type MockRole = {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
  /** Mã quyền; "*" là toàn bộ */
  permissions: string[]
  createdAt: string
  isDeleted?: boolean
}

export type MockUser = {
  id: string
  username: string
  fullName: string
  email: string | null
  phone: string | null
  avatarUrl: string | null
  isActive: boolean
  isDemoAccount: boolean
  lastLoginAt: string | null
  createdAt: string
  roleIds: string[]
  passwordHash: string
  quickLogin: boolean
  sortOrder: number
  description: string | null
  isDeleted?: boolean
}

export type MockSetting = { id: string; key: string; value: string; groupName: string }

export type MockRefreshToken = {
  id: string
  userId: string
  token: string
  expiresAt: string
  revokedAt: string | null
  createdAt: string
}

/** Đếm số lần đăng nhập sai liên tiếp (BR-SYS-03); id = username */
export type MockLoginAttempt = { id: string; failedCount: number; lockedUntil: string | null }

export const hashPassword = (username: string, password: string) =>
  mockHash(`${username.toLowerCase()}:${password}`)

export const roleIdOf = (code: string) => stableId('role', code)
export const userIdOf = (username: string) => stableId('user', username)

function seedRoles(): MockRole[] {
  return systemSeed.roles.map((role, index) => ({
    id: roleIdOf(role.code),
    code: role.code,
    name: role.name,
    description: role.description ?? null,
    isSystem: role.isSystem ?? false,
    permissions: [...role.permissions],
    createdAt: daysAgo(120 - index, '08:00'),
  }))
}

function seedUsers(): MockUser[] {
  return systemSeed.users.map((user, index) => ({
    id: userIdOf(user.username),
    username: user.username,
    fullName: user.fullName,
    email: user.email ?? null,
    phone: user.phone ?? null,
    avatarUrl: null,
    isActive: user.isActive ?? true,
    isDemoAccount: user.isDemoAccount ?? false,
    lastLoginAt: null,
    createdAt: daysAgo(90 - index, '09:00'),
    roleIds: user.roles.map(roleIdOf),
    passwordHash: hashPassword(user.username, user.password ?? appConfig.demoPassword),
    quickLogin: user.quickLogin ?? false,
    sortOrder: user.sortOrder ?? 100 + index,
    description: user.description ?? null,
  }))
}

function seedSettings(): MockSetting[] {
  return systemSeed.settings.map((s) => ({ id: stableId('setting', s.key), ...s }))
}

export const rolesDb = mockDb.collection<MockRole>('system.roles', seedRoles, { scope: 'system' })
export const usersDb = mockDb.collection<MockUser>('system.users', seedUsers, { scope: 'system' })
export const settingsDb = mockDb.collection<MockSetting>('system.settings', seedSettings, { scope: 'system' })
export const refreshTokensDb = mockDb.collection<MockRefreshToken>('system.refresh-tokens', () => [], {
  scope: 'system',
})
export const loginAttemptsDb = mockDb.collection<MockLoginAttempt>('system.login-attempts', () => [], {
  scope: 'system',
})
export const auditLogsDb = mockDb.collection<AuditLogDto>('system.audit-logs', () => [], {
  scope: 'system',
})

let seedSynced = false

/**
 * Bổ sung bản ghi có trong seed mà dữ liệu đã lưu chưa có (dự án thêm vai trò, tài khoản,
 * khóa cài đặt mới vào project.json sau khi người xem đã mở demo). Không ghi đè dữ liệu đã sửa.
 */
export function syncSeedEntries() {
  if (seedSynced || typeof window === 'undefined') return
  seedSynced = true
  mockDb.batch(() => {
    const roles = rolesDb.all()
    for (const role of seedRoles()) {
      if (!roles.some((r) => r.code === role.code)) rolesDb.insert(role)
    }
    const users = usersDb.all()
    for (const user of seedUsers()) {
      if (!users.some((u) => u.username === user.username)) usersDb.insert(user)
    }
    const settings = settingsDb.all()
    for (const setting of seedSettings()) {
      if (!settings.some((s) => s.key === setting.key)) settingsDb.insert(setting)
    }
  })
}

// ───────────────────────── Truy vấn dùng chung ─────────────────────────

/** Danh mục quyền (đã ghép project.json), sắp theo sortOrder. */
export const permissionCatalog = (): SeedPermission[] => systemSeed.permissions

export const allPermissionCodes = (): string[] => systemSeed.permissions.map((p) => p.code)

/** Đổi "*" thành toàn bộ mã quyền, bỏ mã không có trong danh mục. */
export function expandPermissions(codes: string[]): string[] {
  const all = allPermissionCodes()
  if (codes.includes('*')) return all
  return all.filter((code) => codes.includes(code))
}

export const activeRoles = () => rolesDb.filter((r) => !r.isDeleted)

/** Tài khoản chưa bị xóa mềm. */
export const liveUsers = () => usersDb.filter((u) => !u.isDeleted)

export function findLiveUser(id: string): MockUser | undefined {
  const user = usersDb.get(id)
  return user && !user.isDeleted ? user : undefined
}

export function rolesOfUser(user: Pick<MockUser, 'roleIds'>): MockRole[] {
  const roles = activeRoles()
  return user.roleIds
    .map((id) => roles.find((r) => r.id === id))
    .filter((r): r is MockRole => Boolean(r))
}

export function isSuperAdmin(user: Pick<MockUser, 'roleIds'>): boolean {
  return rolesOfUser(user).some((r) => r.code === roleCodes.admin)
}

/** Quyền thực tế của tài khoản: ADMIN nhận toàn bộ (BR-SYS-06). */
export function effectivePermissions(user: Pick<MockUser, 'roleIds'>): string[] {
  if (isSuperAdmin(user)) return allPermissionCodes()
  return expandPermissions(rolesOfUser(user).flatMap((r) => r.permissions))
}

export function verifyPassword(user: MockUser, password: string): boolean {
  // Tài khoản demo luôn dùng mật khẩu chung hiện tại (NEXT_PUBLIC_DEMO_PASSWORD)
  if (user.isDemoAccount) return password === appConfig.demoPassword
  return user.passwordHash === hashPassword(user.username, password)
}

export function getSettingsMap(): Record<string, string> {
  return Object.fromEntries(settingsDb.all().map((s) => [s.key, s.value]))
}
