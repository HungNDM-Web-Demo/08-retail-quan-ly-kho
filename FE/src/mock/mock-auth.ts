import { expireSession, getSession, useAuthStore } from '@/stores/auth.store'
import type { AuthResponse, CurrentUser } from '@/features/auth/types/auth.types'
import { forbidden, unauthorized } from './mock-errors'
import { newId } from './mock-helpers'
import {
  effectivePermissions,
  findLiveUser,
  isSuperAdmin,
  refreshTokensDb,
  rolesOfUser,
  syncSeedEntries,
  type MockUser,
} from './system-data'

/**
 * Xác thực giả lập ở chế độ mock (KIEN-TRUC-HE-THONG §7.1, BR-SYS-04, BR-SYS-08).
 * - Access token giả có hạn 60 phút, refresh token 7 ngày, xoay vòng khi gia hạn.
 * - Handler gọi `requirePermission(...)` để kiểm tra quyền giống [AuthorizePermission] của BE.
 * - Access token hết hạn thì tự gia hạn (như lib/axios.ts làm ở chế độ api);
 *   refresh token hỏng hoặc tài khoản bị khóa thì hết phiên, về trang đăng nhập.
 */

export const ACCESS_TOKEN_MINUTES = 60
export const REFRESH_TOKEN_DAYS = 7

type TokenPayload = { sub: string; exp: number; jti: string }

export type MockSessionContext = {
  user: MockUser
  permissions: string[]
  isSuperAdmin: boolean
}

const encode = (payload: TokenPayload) =>
  `mock.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.${newId().slice(0, 8)}`

function decode(token: string | null | undefined): TokenPayload | null {
  if (!token?.startsWith('mock.')) return null
  try {
    return JSON.parse(atob(token.split('.')[1])) as TokenPayload
  } catch {
    return null
  }
}

export function toCurrentUser(user: MockUser): CurrentUser {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    roles: rolesOfUser(user).map((r) => r.code),
    permissions: effectivePermissions(user),
    isSuperAdmin: isSuperAdmin(user),
    isDemoAccount: user.isDemoAccount,
  }
}

/** Cấp cặp token mới cho tài khoản (đăng nhập, đăng nhập nhanh, gia hạn). */
export function issueSession(user: MockUser): AuthResponse {
  const now = Date.now()
  const expiresAt = new Date(now + ACCESS_TOKEN_MINUTES * 60_000).toISOString()
  const refreshToken = `${newId()}${newId()}`.replace(/-/g, '')
  refreshTokensDb.insert({
    id: newId(),
    userId: user.id,
    token: refreshToken,
    expiresAt: new Date(now + REFRESH_TOKEN_DAYS * 86_400_000).toISOString(),
    revokedAt: null,
    createdAt: new Date(now).toISOString(),
  })
  // Dọn token đã hết hạn hoặc thu hồi quá 1 ngày để kho không phình
  refreshTokensDb.removeWhere(
    (t) => new Date(t.expiresAt).getTime() < now || (!!t.revokedAt && now - new Date(t.revokedAt).getTime() > 86_400_000)
  )
  return {
    accessToken: encode({ sub: user.id, exp: Math.floor(new Date(expiresAt).getTime() / 1000), jti: newId() }),
    refreshToken,
    expiresAt,
    user: toCurrentUser(user),
  }
}

export function revokeRefreshToken(token: string) {
  const record = refreshTokensDb.find((t) => t.token === token)
  if (record && !record.revokedAt) {
    refreshTokensDb.update(record.id, { revokedAt: new Date().toISOString() })
  }
}

/** POST /api/auth/refresh: đổi refresh token lấy cặp token mới (token cũ bị thu hồi). */
export function refreshSession(refreshToken: string): AuthResponse {
  const record = refreshTokensDb.find((t) => t.token === refreshToken)
  if (!record || record.revokedAt || new Date(record.expiresAt).getTime() < Date.now()) {
    throw unauthorized('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.')
  }
  const user = findLiveUser(record.userId)
  // BR-SYS-04: tài khoản bị khóa thì phiên bị thu hồi ở lần gia hạn kế tiếp
  if (!user || !user.isActive) {
    revokeRefreshToken(refreshToken)
    throw unauthorized('Tài khoản đã bị khóa, liên hệ quản trị viên.')
  }
  revokeRefreshToken(refreshToken)
  return issueSession(user)
}

/**
 * Lấy người đang đăng nhập; tự gia hạn khi access token hết hạn.
 * Ném 401 (và chuyển về trang đăng nhập) nếu không còn phiên hợp lệ.
 */
export function requireSession(): MockSessionContext {
  syncSeedEntries()
  const session = getSession()
  const payload = decode(session?.accessToken)
  if (!session || !payload) {
    expireSession()
    throw unauthorized()
  }

  let userId = payload.sub
  if (payload.exp * 1000 <= Date.now()) {
    try {
      const renewed = refreshSession(session.refreshToken)
      useAuthStore.getState().updateTokens(renewed)
      userId = renewed.user.id
    } catch (error) {
      expireSession()
      throw error
    }
  }

  const user = findLiveUser(userId)
  if (!user) {
    expireSession()
    throw unauthorized('Tài khoản không còn tồn tại.')
  }
  return { user, permissions: effectivePermissions(user), isSuperAdmin: isSuperAdmin(user) }
}

/** Người đang đăng nhập hoặc null (không ném lỗi, không chuyển trang). */
export function currentContext(): MockSessionContext | null {
  const payload = decode(getSession()?.accessToken)
  const user = payload ? findLiveUser(payload.sub) : undefined
  return user ? { user, permissions: effectivePermissions(user), isSuperAdmin: isSuperAdmin(user) } : null
}

/** Giống [AuthorizePermission]: cần có ít nhất một trong các mã quyền. */
export function requirePermission(...codes: string[]): MockSessionContext {
  const context = requireSession()
  if (context.isSuperAdmin || codes.length === 0 || codes.some((c) => context.permissions.includes(c))) {
    return context
  }
  throw forbidden()
}

/** Cần có vai trò (vd POST /api/demo/reset chỉ ADMIN). */
export function requireRole(code: string): MockSessionContext {
  const context = requireSession()
  if (rolesOfUser(context.user).some((r) => r.code === code)) return context
  throw forbidden('Chỉ Quản trị viên được thực hiện thao tác này.')
}
