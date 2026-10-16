import { z } from 'zod'
import { isValidPhone, PHONE_MESSAGE } from '@/lib/validators'

/** Quy tắc và câu lỗi khớp 07 §2.2 (mock và BE báo cùng câu). */
export const SUPPLIER_CODE_PATTERN = /^NCC\d{3}$/
export const SUPPLIER_CODE_MESSAGE = 'Mã nhà cung cấp dạng NCC001'
export const TAX_CODE_PATTERN = /^\d{10}(-?\d{3})?$/
export const TAX_CODE_MESSAGE = 'Mã số thuế gồm 10 hoặc 13 chữ số'
export const SUPPLIER_NAME_MESSAGE = 'Nhập tên nhà cung cấp'

export const supplierFormSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => !v || SUPPLIER_CODE_PATTERN.test(v), SUPPLIER_CODE_MESSAGE),
  name: z.string().trim().min(1, SUPPLIER_NAME_MESSAGE).max(200, 'Tên tối đa 200 ký tự'),
  taxCode: z
    .string()
    .trim()
    .refine((v) => !v || TAX_CODE_PATTERN.test(v), TAX_CODE_MESSAGE),
  phone: z
    .string()
    .trim()
    .refine((v) => !v || isValidPhone(v), PHONE_MESSAGE),
  address: z.string().trim().max(250, 'Địa chỉ tối đa 250 ký tự'),
  contactName: z.string().trim().max(100, 'Tên người liên hệ tối đa 100 ký tự'),
})

export type SupplierFormValues = z.infer<typeof supplierFormSchema>
