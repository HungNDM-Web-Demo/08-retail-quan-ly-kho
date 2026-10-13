import { z } from 'zod'
import { isHexColor } from '@/lib/brand-color'
import { EMAIL_MESSAGE, isValidEmail } from '@/lib/validators'

const HOTLINE_PATTERN = /^\+?[\d\s.]{8,20}$/
const URL_PATTERN = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i

/** Form Cài đặt chung (UC-SYS-07). Khóa cài đặt có dấu chấm nên đặt tên trường riêng rồi ánh xạ. */
export const settingsFormSchema = z.object({
  appName: z.string().trim().min(1, 'Nhập tên ứng dụng').max(100, 'Tên ứng dụng tối đa 100 ký tự'),
  logoUrl: z.string().trim(),
  primaryColor: z.string().trim().refine(isHexColor, 'Mã màu dạng #RRGGBB, vd #2563EB'),
  companyName: z.string().trim().max(200, 'Tối đa 200 ký tự'),
  companyHotline: z
    .string()
    .trim()
    .refine((v) => !v || HOTLINE_PATTERN.test(v), 'Số hotline chỉ gồm số, khoảng trắng, dấu chấm (8–20 ký tự)'),
  companyZalo: z.string().trim().max(200, 'Tối đa 200 ký tự'),
  companyEmail: z
    .string()
    .trim()
    .refine((v) => !v || isValidEmail(v), EMAIL_MESSAGE),
  companyAddress: z.string().trim().max(300, 'Địa chỉ tối đa 300 ký tự'),
  companyWebsite: z
    .string()
    .trim()
    .refine((v) => !v || URL_PATTERN.test(v), 'Website dạng https://tenmien.vn'),
  /** Khóa cài đặt riêng của dự án (project.json → settings) */
  extras: z.array(z.object({ key: z.string(), groupName: z.string(), value: z.string() })),
})

export type SettingsFormValues = z.infer<typeof settingsFormSchema>
