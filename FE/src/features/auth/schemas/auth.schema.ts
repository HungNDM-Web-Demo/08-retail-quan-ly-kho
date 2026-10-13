import { z } from 'zod'
import { PASSWORD_MESSAGE, isValidPassword } from '@/lib/validators'

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Nhập tên đăng nhập'),
  password: z.string().min(1, 'Nhập mật khẩu'),
})
export type LoginValues = z.infer<typeof loginSchema>

/** UC-SYS-04, BR-SYS-02 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Nhập mật khẩu hiện tại'),
    newPassword: z.string().refine(isValidPassword, PASSWORD_MESSAGE),
    confirmPassword: z.string().min(1, 'Nhập lại mật khẩu mới'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp',
  })
  .refine((v) => !v.newPassword || v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
  })
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
