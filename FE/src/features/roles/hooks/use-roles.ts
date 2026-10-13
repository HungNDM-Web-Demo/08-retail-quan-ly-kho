'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authKeys } from '@/features/auth/hooks/use-auth'
import { roleService } from '../services/role.service'
import type { CreateRoleRequest, UpdateRoleRequest } from '../types/role.types'

export const roleKeys = {
  all: ['roles'] as const,
  list: ['roles', 'list'] as const,
  permissionGroups: ['roles', 'permission-groups'] as const,
}

export function useRoles(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: roleKeys.list,
    queryFn: () => roleService.getList(),
    enabled: options.enabled ?? true,
  })
}

export function usePermissionGroups() {
  return useQuery({
    queryKey: roleKeys.permissionGroups,
    queryFn: () => roleService.getPermissionGroups(),
    staleTime: 10 * 60_000,
  })
}

function useInvalidateRoles() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: roleKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['users'] })
    void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    // Quyền của chính người đang đăng nhập có thể đổi
    void queryClient.invalidateQueries({ queryKey: authKeys.me })
  }
}

export function useCreateRole() {
  const invalidate = useInvalidateRoles()
  return useMutation({
    mutationFn: (input: CreateRoleRequest) => roleService.create(input),
    onSuccess: invalidate,
  })
}

export function useUpdateRole() {
  const invalidate = useInvalidateRoles()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRoleRequest }) => roleService.update(id, input),
    onSuccess: invalidate,
  })
}

export function useUpdateRolePermissions() {
  const invalidate = useInvalidateRoles()
  return useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: string[] }) =>
      roleService.updatePermissions(id, { permissions }),
    onSuccess: invalidate,
  })
}

export function useDeleteRole() {
  const invalidate = useInvalidateRoles()
  return useMutation({
    mutationFn: (id: string) => roleService.remove(id),
    onSuccess: invalidate,
  })
}
