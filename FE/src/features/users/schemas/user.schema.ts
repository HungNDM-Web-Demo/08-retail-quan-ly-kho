import { z } from 'zod'
import {
  EMAIL_MESSAGE,
  PASSWORD_MESSAGE,
  PHONE_MESSAGE,
  USERNAME_MESSAGE,
  USERNAME_PATTERN,
  isValidEmail,
  isValidPassword,
  isValidPhone,
} from '@/lib/validators'

export type UserFormValues = {
  username: string
  fullName: string
  email: string
  phone: string
  password: string
  roleIds: string[]
}

/** Form thêm/sửa tài khoản (UC-SYS-05, BR-SYS-01, BR-SYS-02). Sửa thì không kiểm tra tên đăng nhập, mật khẩu. */
export function userFormSchema(mode: 'create' | 'edit') {
  return z.object({
    username:
      mode === 'create'
        ? z.string().trim().toLowerCase().regex(USERNAME_PATTERN, USERNAME_MESSAGE)
        : z.string(),
    fullName: z.string().trim().min(1, 'Nhập họ tên').max(150, 'Họ tên tối đa 150 ký tự'),
    email: z
      .string()
      .trim()
      .max(150, 'Email tối đa 150 ký tự')
      .refine((v) => !v || isValidEmail(v), EMAIL_MESSAGE),
    phone: z
      .string()
      .trim()
      .refine((v) => !v || isValidPhone(v), PHONE_MESSAGE),
    password: mode === 'create' ? z.string().refine(isValidPassword, PASSWORD_MESSAGE) : z.string(),
    roleIds: z.array(z.string()).min(1, 'Chọn ít nhất một vai trò'),
  })
}

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().refine(isValidPassword, PASSWORD_MESSAGE),
    confirmPassword: z.string().min(1, 'Nhập lại mật khẩu mới'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp',
  })
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
