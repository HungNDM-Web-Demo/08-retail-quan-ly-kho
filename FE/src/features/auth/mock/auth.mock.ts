import { mockDelay } from '@/lib/data-source'
import { PASSWORD_MESSAGE, isValidPassword } from '@/lib/validators'
import { writeAuditLog } from '@/mock/mock-audit'
import {
  issueSession,
  refreshSession,
  requireSession,
  revokeRefreshToken,
  toCurrentUser,
} from '@/mock/mock-auth'
import { domain, unauthorized, validation } from '@/mock/mock-errors'
import {
  hashPassword,
  liveUsers,
  loginAttemptsDb,
  syncSeedEntries,
  usersDb,
  verifyPassword,
  type MockUser,
} from '@/mock/system-data'
import type {
  AuthResponse,
  ChangePasswordRequest,
  CurrentUser,
  LoginRequest,
  LogoutRequest,
  RefreshRequest,
} from '../types/auth.types'

/** BR-SYS-03: sai 5 lần liên tiếp thì tạm khóa đăng nhập 5 phút */
const MAX_FAILED = 5
const LOCK_MINUTES = 5

function lockedMessage(lockedUntil: string) {
  const minutes = Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60_000))
  return `Tài khoản tạm khóa đăng nhập, thử lại sau ${minutes} phút.`
}

function recordFailure(username: string): never {
  const attempt = loginAttemptsDb.get(username)
  const failedCount = (attempt?.failedCount ?? 0) + 1
  if (failedCount >= MAX_FAILED) {
    const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
    const record = { id: username, failedCount: 0, lockedUntil }
    if (attempt) loginAttemptsDb.update(username, record)
    else loginAttemptsDb.insert(record)
    throw domain(lockedMessage(lockedUntil))
  }
  if (attempt) loginAttemptsDb.update(username, { failedCount, lockedUntil: null })
  else loginAttemptsDb.insert({ id: username, failedCount, lockedUntil: null })
  // E1: không nói rõ sai tên đăng nhập hay sai mật khẩu
  throw unauthorized('Tên đăng nhập hoặc mật khẩu không đúng.')
}

/** Cấp phiên, cập nhật lần đăng nhập cuối, ghi nhật ký Login. Dùng chung cho đăng nhập nhanh. */
export function startSession(user: MockUser): AuthResponse {
  const updated = usersDb.update(user.id, { lastLoginAt: new Date().toISOString() }) ?? user
  writeAuditLog({ action: 'Login', entityName: 'User', entityId: user.id, actor: user })
  return issueSession(updated)
}

export const authMock = {
  async login(request: LoginRequest): Promise<AuthResponse> {
    await mockDelay()
    syncSeedEntries()
    const username = request.username.trim().toLowerCase()
    if (!username || !request.password) {
      throw validation({
        ...(!username && { username: 'Nhập tên đăng nhập' }),
        ...(!request.password && { password: 'Nhập mật khẩu' }),
      })
    }

    const attempt = loginAttemptsDb.get(username)
    if (attempt?.lockedUntil && new Date(attempt.lockedUntil).getTime() > Date.now()) {
      throw domain(lockedMessage(attempt.lockedUntil))
    }

    const user = liveUsers().find((u) => u.username === username)
    if (!user || !verifyPassword(user, request.password)) recordFailure(username)

    if (!user.isActive) throw domain('Tài khoản đã bị khóa, liên hệ quản trị viên.')
    if (attempt) loginAttemptsDb.remove(username)
    return startSession(user)
  },

  async refresh(request: RefreshRequest): Promise<AuthResponse> {
    await mockDelay(50, 120)
    return refreshSession(request.refreshToken)
  },

  async logout(request: LogoutRequest): Promise<void> {
    await mockDelay(100, 200)
    if (request.refreshToken) revokeRefreshToken(request.refreshToken)
  },

  async me(): Promise<CurrentUser> {
    await mockDelay(100, 200)
    return toCurrentUser(requireSession().user)
  },

  async changePassword(request: ChangePasswordRequest): Promise<void> {
    await mockDelay()
    const { user } = requireSession()
    // BR-SYS-05: tài khoản demo không được đổi mật khẩu
    if (user.isDemoAccount) throw domain('Tài khoản demo không được đổi mật khẩu.')
    if (!verifyPassword(user, request.currentPassword)) {
      throw validation({ currentPassword: 'Mật khẩu hiện tại không đúng' })
    }
    if (!isValidPassword(request.newPassword)) throw validation({ newPassword: PASSWORD_MESSAGE })
    if (request.newPassword === request.currentPassword) {
      throw validation({ newPassword: 'Mật khẩu mới phải khác mật khẩu hiện tại' })
    }
    usersDb.update(user.id, { passwordHash: hashPassword(user.username, request.newPassword) })
  },
}
