/** DTO xác thực, khớp từng trường với QUY-UOC-API §4.1. */

/** POST /api/auth/login */
export type LoginRequest = {
  username: string
  password: string
}

/** GET /api/auth/me */
export type CurrentUser = {
  id: string
  username: string
  fullName: string
  email?: string | null
  phone?: string | null
  avatarUrl?: string | null
  /** Mã vai trò, vd ["MANAGER"] */
  roles: string[]
  /** Mã quyền; ADMIN nhận toàn bộ */
  permissions: string[]
  /** true khi có vai trò ADMIN */
  isSuperAdmin: boolean
  isDemoAccount: boolean
}

/** POST /api/auth/login, POST /api/auth/refresh, POST /api/demo/login-as */
export type AuthResponse = {
  accessToken: string
  refreshToken: string
  /** ISO UTC, thời điểm access token hết hạn */
  expiresAt: string
  user: CurrentUser
}

/** POST /api/auth/refresh */
export type RefreshRequest = { refreshToken: string }

/** POST /api/auth/logout → 204 */
export type LogoutRequest = { refreshToken: string }

/** PUT /api/auth/me/password → 204 */
export type ChangePasswordRequest = {
  currentPassword: string
  newPassword: string
}
