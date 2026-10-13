import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { AuthResponse } from '@/features/auth/types/auth.types'
import { demoMock } from '../mock/demo.mock'
import type { DemoAccount, LoginAsRequest } from '../types/demo.types'

export const demoService = {
  /** Thông tin nguồn dữ liệu để hiển thị trên thanh công cụ demo */
  environment: () =>
    isMockMode()
      ? { mode: 'mock' as const, label: 'Dữ liệu mẫu', description: 'Lưu trong trình duyệt này, không cần máy chủ' }
      : { mode: 'api' as const, label: 'Máy chủ thật', description: 'Dữ liệu lưu trong cơ sở dữ liệu của BE' },

  /** Danh sách tài khoản demo; BE tắt DEMO_MODE thì trả 404 → trang đăng nhập ẩn khu đăng nhập nhanh. */
  getAccounts: (): Promise<DemoAccount[]> =>
    isMockMode() ? demoMock.accounts() : apiCall.get<DemoAccount[]>(apiRoutes.demo.accounts),

  loginAs: (request: LoginAsRequest): Promise<AuthResponse> =>
    isMockMode()
      ? demoMock.loginAs(request)
      : apiCall.post<AuthResponse>(apiRoutes.demo.loginAs, request),

  reset: (): Promise<void> =>
    isMockMode() ? demoMock.reset() : apiCall.post(apiRoutes.demo.reset),
}
