import { roleCodes } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { requireRole } from '@/mock/mock-auth'
import { mockDb } from '@/mock/mock-db'
import { domain, notFound } from '@/mock/mock-errors'
import { liveUsers, rolesOfUser, syncSeedEntries } from '@/mock/system-data'
import { startSession } from '@/features/auth/mock/auth.mock'
import type { AuthResponse } from '@/features/auth/types/auth.types'
import type { DemoAccount, LoginAsRequest } from '../types/demo.types'

/** Tài khoản demo có nút "Đăng nhập nhanh", theo thứ tự sortOrder (system.json + project.json). */
function quickLoginUsers() {
  syncSeedEntries()
  return liveUsers()
    .filter((u) => u.quickLogin && u.isDemoAccount)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export const demoMock = {
  async accounts(): Promise<DemoAccount[]> {
    await mockDelay(100, 250)
    return quickLoginUsers().map((user) => {
      const role = rolesOfUser(user)[0]
      return {
        username: user.username,
        fullName: user.fullName,
        roleCode: role?.code ?? '',
        roleName: role?.name ?? '',
        description: user.description ?? role?.description ?? '',
      }
    })
  },

  async loginAs(request: LoginAsRequest): Promise<AuthResponse> {
    await mockDelay()
    const user = quickLoginUsers().find((u) => rolesOfUser(u).some((r) => r.code === request.roleCode))
    if (!user) throw notFound(`Không có tài khoản demo cho vai trò ${request.roleCode}.`)
    if (!user.isActive) throw domain('Tài khoản demo này đang bị khóa.')
    return startSession(user)
  },

  /** UC-SYS-10: chỉ Quản trị viên; giữ tài khoản, vai trò, cài đặt (BR-SYS-09). */
  async reset(): Promise<void> {
    await mockDelay(400, 700)
    requireRole(roleCodes.admin)
    await mockDb.reset()
  },
}
