'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Info, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { PasswordInput } from '@/components/shared/PasswordInput'
import { Button } from '@/components/ui/button'
import { PASSWORD_MESSAGE } from '@/lib/validators'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { useChangePassword } from '../hooks/use-auth'
import { changePasswordSchema, type ChangePasswordValues } from '../schemas/auth.schema'

/** UC-SYS-04: đổi mật khẩu. Tài khoản demo bị chặn (BR-SYS-05). */
export function ChangePasswordForm({ disabled }: { disabled?: boolean }) {
  const changePassword = useChangePassword()
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) => {
    changePassword.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          toast.success('Đã đổi mật khẩu')
          form.reset()
        },
        onError: (error) => {
          if (!applyFieldErrors(form.setError, error, ['currentPassword', 'newPassword'])) {
            toast.error(getErrorMessage(error))
          }
        },
      }
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {disabled && (
        <div className="bg-info/10 text-info border-info/25 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm" role="note">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Tài khoản demo dùng chung mật khẩu nên không đổi được mật khẩu.</span>
        </div>
      )}
      <fieldset disabled={disabled || changePassword.isPending} className="grid gap-4 disabled:opacity-70">
        <FormField label="Mật khẩu hiện tại" required error={errors.currentPassword?.message}>
          <PasswordInput autoComplete="current-password" {...form.register('currentPassword')} />
        </FormField>
        <FormField label="Mật khẩu mới" required error={errors.newPassword?.message} hint={PASSWORD_MESSAGE}>
          <PasswordInput autoComplete="new-password" {...form.register('newPassword')} />
        </FormField>
        <FormField label="Nhập lại mật khẩu mới" required error={errors.confirmPassword?.message}>
          <PasswordInput autoComplete="new-password" {...form.register('confirmPassword')} />
        </FormField>
        <div className="flex justify-end">
          <Button type="submit" disabled={disabled || changePassword.isPending}>
            {changePassword.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Đổi mật khẩu
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
