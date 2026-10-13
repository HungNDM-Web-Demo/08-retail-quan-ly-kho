import systemJson from './seed/system.json'
import projectJson from './seed/project.json'

/**
 * Ghép dữ liệu nền system.json với phần riêng của dự án project.json (nguồn duy nhất,
 * BE SystemSeeder đọc cùng file, ghép cùng quy tắc). File thuần, chạy được cả phía máy chủ.
 *
 * Quy tắc ghép:
 * - permissions: thêm mới; trùng code thì ghi đè các trường khai báo.
 * - roles: thêm mới; trùng code thì chỉ ghi đè name/description (không đổi isSystem, permissions).
 * - roleGrants: { "MANAGER": ["orders.view", …] } cấp thêm quyền cho vai trò đã có.
 * - users: thêm mới; trùng username thì ghi đè các trường khai báo
 *   (fullName, email, phone, description, roles, quickLogin, sortOrder…), không tạo tài khoản mới;
 *   { "username": "nhanvien", "enabled": false } bỏ hẳn tài khoản đó của nền.
 * - settings: trùng key thì ghi đè value (và groupName nếu có); key mới thì thêm.
 * - homeAfterLogin: trang mở sau khi đăng nhập (config/app.config.ts).
 */

export type SeedPermission = { code: string; groupName: string; name: string; sortOrder: number }

export type SeedRole = {
  code: string
  name: string
  description?: string
  isSystem?: boolean
  /** "*" là toàn bộ quyền */
  permissions: string[]
}

export type SeedUser = {
  username: string
  fullName: string
  email?: string
  phone?: string
  roles: string[]
  isDemoAccount?: boolean
  isActive?: boolean
  quickLogin?: boolean
  sortOrder?: number
  /** Mô tả trên thẻ "Đăng nhập nhanh" */
  description?: string
  /** Mật khẩu riêng (tài khoản không phải demo); bỏ trống thì dùng mật khẩu demo */
  password?: string
}

export type SeedSetting = { key: string; value: string; groupName: string }

type ProjectSeedFile = {
  permissions?: SeedPermission[]
  roles?: SeedRole[]
  roleGrants?: Record<string, string[]>
  users?: (Partial<SeedUser> & { username: string; enabled?: boolean })[]
  settings?: { key: string; value: string; groupName?: string }[]
  homeAfterLogin?: string
}

export type SystemSeed = {
  permissions: SeedPermission[]
  roles: SeedRole[]
  users: SeedUser[]
  settings: SeedSetting[]
  homeAfterLogin: string
}

function definedFields<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>
}

function mergeSeed(system: SystemSeed, project: ProjectSeedFile): SystemSeed {
  const permissions = [...system.permissions]
  for (const item of project.permissions ?? []) {
    const index = permissions.findIndex((p) => p.code === item.code)
    if (index >= 0) permissions[index] = { ...permissions[index], ...definedFields(item) }
    else permissions.push(item)
  }

  const roles = system.roles.map((role) => ({ ...role, permissions: [...role.permissions] }))
  for (const item of project.roles ?? []) {
    const existing = roles.find((r) => r.code === item.code)
    if (existing) {
      if (item.name !== undefined) existing.name = item.name
      if (item.description !== undefined) existing.description = item.description
    } else {
      roles.push({ ...item, isSystem: item.isSystem ?? false, permissions: [...(item.permissions ?? [])] })
    }
  }
  for (const [code, grants] of Object.entries(project.roleGrants ?? {})) {
    const role = roles.find((r) => r.code === code)
    if (role) role.permissions = [...new Set([...role.permissions, ...grants])]
  }

  const users = system.users.map((user) => ({ ...user }))
  for (const { enabled, ...item } of project.users ?? []) {
    const index = users.findIndex((u) => u.username === item.username)
    if (enabled === false) {
      if (index >= 0) users.splice(index, 1)
      continue
    }
    if (index >= 0) users[index] = { ...users[index], ...definedFields(item) }
    else users.push({ fullName: item.username, roles: [], ...definedFields(item) } as SeedUser)
  }

  const settings = system.settings.map((s) => ({ ...s }))
  for (const item of project.settings ?? []) {
    const existing = settings.find((s) => s.key === item.key)
    if (existing) {
      existing.value = item.value
      if (item.groupName) existing.groupName = item.groupName
    } else {
      settings.push({ key: item.key, value: item.value, groupName: item.groupName ?? 'Khác' })
    }
  }

  return {
    permissions: permissions.sort((a, b) => a.sortOrder - b.sortOrder),
    roles,
    users: users.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)),
    settings,
    homeAfterLogin: project.homeAfterLogin || system.homeAfterLogin,
  }
}

export const systemSeed: SystemSeed = mergeSeed(
  { ...(systemJson as unknown as Omit<SystemSeed, 'homeAfterLogin'>), homeAfterLogin: '/dashboard' },
  projectJson as unknown as ProjectSeedFile
)

/** Cài đặt công khai từ seed (Brand.*, Company.*), dùng cho trang render phía máy chủ ở chế độ mock. */
export function seedPublicSettings(): Record<string, string> {
  return Object.fromEntries(
    systemSeed.settings
      .filter((s) => s.key.startsWith('Brand.') || s.key.startsWith('Company.'))
      .map((s) => [s.key, s.value])
  )
}
