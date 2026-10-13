import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import { authMock } from '../mock/auth.mock'
import type {
  AuthResponse,
  ChangePasswordRequest,
  CurrentUser,
  LoginRequest,
  LogoutRequest,
} from '../types/auth.types'

export const authService = {
  login: (request: LoginRequest): Promise<AuthResponse> =>
    isMockMode() ? authMock.login(request) : apiCall.post<AuthResponse>(apiRoutes.auth.login, request),

  logout: (request: LogoutRequest): Promise<void> =>
    isMockMode() ? authMock.logout(request) : apiCall.post(apiRoutes.auth.logout, request),

  me: (): Promise<CurrentUser> =>
    isMockMode() ? authMock.me() : apiCall.get<CurrentUser>(apiRoutes.auth.me),

  changePassword: (request: ChangePasswordRequest): Promise<void> =>
    isMockMode()
      ? authMock.changePassword(request)
      : apiCall.put(apiRoutes.auth.changePassword, request),
}
