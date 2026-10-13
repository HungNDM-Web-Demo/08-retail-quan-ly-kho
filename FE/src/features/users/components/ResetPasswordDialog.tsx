'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { PasswordInput } from '@/components/shared/PasswordInput'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { PASSWORD_MESSAGE } from '@/lib/validators'
import { useResetUserPassword } from '../hooks/use-users'
import { resetPasswordSchema, type ResetPasswordValues } from '../schemas/user.schema'
import type { UserDto } from '../types/user.types'

/** Đặt lại mật khẩu cho một tài khoản (UC-SYS-05 luồng 1c). */
export function ResetPasswordDialog({ user, onOpenChange }: { user: UserDto | null; onOpenChange: (open: boolean) => void }) {
  const resetPassword = useResetUserPassword()
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })
  const { errors } = form.formState

  useEffect(() => {
    if (user) form.reset({ newPassword: '', confirmPassword: '' })
  }, [user, form])

  const onSubmit = form.handleSubmit((values) => {
    if (!user) return
    resetPassword.mutate(
      { id: user.id, newPassword: values.newPassword },
      {
        onSuccess: () => {
          toast.success(`Đã đặt lại mật khẩu cho ${user.username}`, {
            description: 'Các phiên đăng nhập cũ của tài khoản này đã bị thu hồi.',
          })
          onOpenChange(false)
        },
        onError: (error) => {
          if (!applyFieldErrors(form.setError, error, ['newPassword'])) toast.error(getErrorMessage(error))
        },
      }
    )
  })

  return (
    <Dialog open={!!user} onOpenChange={(next) => !resetPassword.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Đặt lại mật khẩu</DialogTitle>
          <DialogDescription>
            Đặt mật khẩu mới cho <span className="text-foreground font-medium">{user?.fullName}</span> (@{user?.username}).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormField label="Mật khẩu mới" required error={errors.newPassword?.message} hint={PASSWORD_MESSAGE}>
            <PasswordInput autoComplete="new-password" autoFocus {...form.register('newPassword')} />
          </FormField>
          <FormField label="Nhập lại mật khẩu mới" required error={errors.confirmPassword?.message}>
            <PasswordInput autoComplete="new-password" {...form.register('confirmPassword')} />
          </FormField>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={resetPassword.isPending}>
              Hủy
            </Button>
            <Button type="submit" disabled={resetPassword.isPending}>
              {resetPassword.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Đặt lại mật khẩu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
