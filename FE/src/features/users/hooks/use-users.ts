'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { userService } from '../services/user.service'
import type { CreateUserRequest, UpdateUserRequest, UserQuery } from '../types/user.types'

export const userKeys = {
  all: ['users'] as const,
  list: (query: UserQuery) => ['users', 'list', query] as const,
  detail: (id: string) => ['users', 'detail', id] as const,
}

export function useUsers(query: UserQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: userKeys.list(query),
    queryFn: () => userService.getList(query),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  })
}

/** Sau khi ghi: làm mới tài khoản, vai trò (số tài khoản mỗi vai trò) và nhật ký. */
function useInvalidateUsers() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: userKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['roles'] })
    void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
  }
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (input: CreateUserRequest) => userService.create(input),
    onSuccess: invalidate,
  })
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserRequest }) => userService.update(id, input),
    onSuccess: invalidate,
  })
}

export function useLockUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => userService.lock(id, { isActive }),
    onSuccess: invalidate,
  })
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      userService.resetPassword(id, { newPassword }),
  })
}

export function useDeleteUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (id: string) => userService.remove(id),
    onSuccess: invalidate,
  })
}
