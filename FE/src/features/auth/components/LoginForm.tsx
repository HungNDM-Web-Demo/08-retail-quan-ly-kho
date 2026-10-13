'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2, LogIn } from 'lucide-react'
import { FormField } from '@/components/shared/FormField'
import { PasswordInput } from '@/components/shared/PasswordInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { useLogin } from '../hooks/use-auth'
import { loginSchema, type LoginValues } from '../schemas/auth.schema'
import type { AuthResponse } from '../types/auth.types'

/** Form đăng nhập (UC-SYS-01). Lỗi sai thông tin hiện chung, không nói rõ sai phần nào (E1). */
export function LoginForm({ onSuccess }: { onSuccess: (response: AuthResponse) => void }) {
  const login = useLogin()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null)
    login.mutate(values, {
      onSuccess,
      onError: (error) => {
        if (!applyFieldErrors(form.setError, error, ['username', 'password'])) {
          setFormError(getErrorMessage(error))
        }
        form.setValue('password', '')
        form.setFocus('password')
      },
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {formError && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/8 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}

      <FormField label="Tên đăng nhập" error={errors.username?.message}>
        <Input
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          placeholder="vd: admin"
          className="h-11"
          {...form.register('username')}
        />
      </FormField>

      <FormField label="Mật khẩu" error={errors.password?.message}>
        <PasswordInput autoComplete="current-password" placeholder="Nhập mật khẩu" className="h-11" {...form.register('password')} />
      </FormField>

      <Button type="submit" size="lg" className="mt-1 w-full" disabled={login.isPending} aria-busy={login.isPending}>
        {login.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
        {login.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </Button>
    </form>
  )
}
