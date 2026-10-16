import { z } from 'zod'
import { isValidPhone, PHONE_MESSAGE } from '@/lib/validators'

/** Quy tắc và câu lỗi khớp 07 §2.1 (BR-02) */
export const WAREHOUSE_CODE_PATTERN = /^[A-Z0-9]{2,10}$/
export const WAREHOUSE_CODE_MESSAGE = 'Mã kho 2–10 ký tự chữ in hoa và số'
export const WAREHOUSE_NAME_MESSAGE = 'Nhập tên kho'

export const warehouseFormSchema = z.object({
  code: z
    .string()
    .trim()
    .refine((v) => WAREHOUSE_CODE_PATTERN.test(v.toUpperCase()), WAREHOUSE_CODE_MESSAGE),
  name: z.string().trim().min(1, WAREHOUSE_NAME_MESSAGE).max(100, 'Tên kho tối đa 100 ký tự'),
  address: z.string().trim().max(250, 'Địa chỉ tối đa 250 ký tự'),
  phone: z
    .string()
    .trim()
    .refine((v) => !v || isValidPhone(v), PHONE_MESSAGE),
  keeperIds: z.array(z.string()),
})

export type WarehouseFormValues = z.infer<typeof warehouseFormSchema>
