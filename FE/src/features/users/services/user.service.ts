import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import type { PaginatedResult } from '@/types/api'
import { userMock } from '../mock/user.mock'
import type {
  CreateUserRequest,
  LockUserRequest,
  ResetPasswordRequest,
  UpdateUserRequest,
  UserDto,
  UserQuery,
} from '../types/user.types'

export const userService = {
  getList: (query: UserQuery): Promise<PaginatedResult<UserDto>> =>
    isMockMode()
      ? userMock.getList(query)
      : apiCall.get<PaginatedResult<UserDto>>(apiRoutes.users.list, { params: query }),

  getById: (id: string): Promise<UserDto> =>
    isMockMode() ? userMock.getById(id) : apiCall.get<UserDto>(apiRoutes.users.detail(id)),

  create: (input: CreateUserRequest): Promise<UserDto> =>
    isMockMode() ? userMock.create(input) : apiCall.post<UserDto>(apiRoutes.users.list, input),

  update: (id: string, input: UpdateUserRequest): Promise<UserDto> =>
    isMockMode()
      ? userMock.update(id, input)
      : apiCall.put<UserDto>(apiRoutes.users.detail(id), input),

  lock: (id: string, input: LockUserRequest): Promise<void> =>
    isMockMode() ? userMock.lock(id, input) : apiCall.patch(apiRoutes.users.lock(id), input),

  resetPassword: (id: string, input: ResetPasswordRequest): Promise<void> =>
    isMockMode()
      ? userMock.resetPassword(id, input)
      : apiCall.patch(apiRoutes.users.resetPassword(id), input),

  remove: (id: string): Promise<void> =>
    isMockMode() ? userMock.remove(id) : apiCall.delete(apiRoutes.users.detail(id)),
}
