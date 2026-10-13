'use client'

import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Info, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { PasswordInput } from '@/components/shared/PasswordInput'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { PASSWORD_MESSAGE } from '@/lib/validators'
import { cn } from '@/lib/utils'
import type { RoleDto } from '@/features/roles/types/role.types'
import { useCreateUser, useUpdateUser } from '../hooks/use-users'
import { userFormSchema, type UserFormValues } from '../schemas/user.schema'
import type { UserDto } from '../types/user.types'

type UserFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Có user là sửa, không có là thêm mới */
  user?: UserDto | null
  roles: RoleDto[] | undefined
  rolesLoading?: boolean
}

const EMPTY: UserFormValues = { username: '', fullName: '', email: '', phone: '', password: '', roleIds: [] }

/** Thêm/sửa tài khoản trong hộp thoại (UC-SYS-05 luồng chính, 1a). */
export function UserFormDialog({ open, onOpenChange, user, roles, rolesLoading }: UserFormDialogProps) {
  const mode = user ? 'edit' : 'create'
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const pending = createUser.isPending || updateUser.isPending

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema(mode)),
    defaultValues: EMPTY,
  })
  const { errors } = form.formState

  useEffect(() => {
    if (!open) return
    form.reset(
      user
        ? {
            username: user.username,
            fullName: user.fullName,
            email: user.email ?? '',
            phone: user.phone ?? '',
            password: '',
            roleIds: user.roles.map((r) => r.id),
          }
        : EMPTY
    )
  }, [open, user, form])

  const onError = (error: unknown) => {
    if (!applyFieldErrors(form.setError, error)) toast.error(getErrorMessage(error))
  }

  const onSubmit = form.handleSubmit((values) => {
    const profile = {
      fullName: values.fullName,
      email: values.email || null,
      phone: values.phone || null,
      roleIds: values.roleIds,
    }
    if (user) {
      updateUser.mutate(
        { id: user.id, input: profile },
        {
          onSuccess: () => {
            toast.success(`Đã cập nhật tài khoản ${user.username}`)
            onOpenChange(false)
          },
          onError,
        }
      )
    } else {
      createUser.mutate(
        { ...profile, username: values.username, password: values.password },
        {
          onSuccess: (created) => {
            toast.success(`Đã thêm tài khoản ${created.username}`)
            onOpenChange(false)
          },
          onError,
        }
      )
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{user ? 'Sửa tài khoản' : 'Thêm tài khoản'}</DialogTitle>
          <DialogDescription>
            {user ? `Cập nhật thông tin và vai trò của ${user.fullName}.` : 'Tạo tài khoản đăng nhập mới và gán vai trò.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="grid max-h-[calc(100dvh-14rem)] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            {user?.isDemoAccount && (
              <div className="bg-info/10 text-info border-info/25 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm sm:col-span-2" role="note">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>Đây là tài khoản demo: đổi vai trò sẽ đổi thẻ &quot;Đăng nhập nhanh&quot; tương ứng.</span>
              </div>
            )}

            <FormField label="Họ tên" required error={errors.fullName?.message} className="sm:col-span-2">
              <Input autoComplete="off" placeholder="vd: Nguyễn Văn An" {...form.register('fullName')} />
            </FormField>

            <FormField
              label="Tên đăng nhập"
              required={!user}
              error={errors.username?.message}
              hint={user ? 'Không đổi được tên đăng nhập.' : 'Chữ thường không dấu, số, dấu . hoặc _'}
            >
              <Input
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="vd: an.nguyen"
                disabled={!!user}
                {...form.register('username')}
              />
            </FormField>

            {!user ? (
              <FormField label="Mật khẩu" required error={errors.password?.message} hint={PASSWORD_MESSAGE}>
                <PasswordInput autoComplete="new-password" {...form.register('password')} />
              </FormField>
            ) : (
              <div className="hidden sm:block" aria-hidden="true" />
            )}

            <FormField label="Email" error={errors.email?.message}>
              <Input type="email" inputMode="email" autoComplete="off" placeholder="vd: an@congty.vn" {...form.register('email')} />
            </FormField>

            <FormField label="Số điện thoại" error={errors.phone?.message}>
              <Input type="tel" inputMode="tel" autoComplete="off" placeholder="vd: 0901 234 567" {...form.register('phone')} />
            </FormField>

            <fieldset className="grid gap-2 sm:col-span-2" aria-describedby={errors.roleIds ? 'roleIds-error' : undefined}>
              <legend className="mb-1.5 text-sm font-medium">
                Vai trò <span className="text-destructive" aria-hidden="true">*</span>
              </legend>
              {rolesLoading ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : (
                <Controller
                  control={form.control}
                  name="roleIds"
                  render={({ field }) => (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(roles ?? []).map((role) => {
                        const checked = field.value.includes(role.id)
                        const id = `role-${role.id}`
                        return (
                          <label
                            key={role.id}
                            htmlFor={id}
                            className={cn(
                              'flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-150',
                              checked ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/60'
                            )}
                          >
                            <Checkbox
                              id={id}
                              checked={checked}
                              onCheckedChange={(value) =>
                                field.onChange(
                                  value ? [...field.value, role.id] : field.value.filter((x) => x !== role.id)
                                )
                              }
                              className="mt-0.5"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium">{role.name}</span>
                              {role.description && (
                                <span className="text-muted-foreground block text-xs leading-snug">{role.description}</span>
                              )}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                />
              )}
              {errors.roleIds && (
                <p id="roleIds-error" role="alert" className="text-destructive text-[0.8125rem]">
                  {errors.roleIds.message}
                </p>
              )}
            </fieldset>
          </div>

          <DialogFooter className="bg-muted/30 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {user ? 'Lưu thay đổi' : 'Thêm tài khoản'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
