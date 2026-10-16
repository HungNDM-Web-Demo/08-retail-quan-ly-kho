import { z } from 'zod'
import type { SaveProductRequest } from '@/types/inventory'

/**
 * Quy tắc mặt hàng, nhóm hàng và câu lỗi đúng 07 §2.3 (BR-01, BR-02, BR-18); mock dùng cùng hằng để báo cùng câu.
 * Ô số để dạng chuỗi trong form, đổi sang số khi gửi.
 */
export const PRODUCT_CODE_PATTERN = /^[A-Z0-9-]{3,20}$/
export const BARCODE_PATTERN = /^\d{8,14}$/
export const GROUP_CODE_PATTERN = /^[A-Z0-9]{2,20}$/
export const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/
export const MAX_UNITS = 2
export const MIN_FACTOR = 2
export const MAX_FACTOR = 10_000

export const productMessages = {
  code: 'Mã hàng 3–20 ký tự gồm chữ in hoa, số, dấu -',
  name: 'Nhập tên mặt hàng',
  baseUnit: 'Nhập đơn vị cơ bản',
  groupId: 'Chọn nhóm hàng đang sử dụng',
  barcode: 'Mã vạch chỉ gồm chữ số, dài 8–14 ký tự',
  units: 'Tối đa 2 đơn vị quy đổi',
  unitName: 'Nhập tên đơn vị',
  factor: 'Hệ số là số nguyên từ 2 đến 10.000',
  duplicateUnit: 'Đơn vị bị trùng',
  unitUsed: 'Đơn vị đã có chứng từ',
  minQty: 'Tồn tối thiểu là số nguyên không âm',
  maxQty: 'Tồn tối đa là số nguyên không âm',
  minBelowMax: 'Tồn tối thiểu phải nhỏ hơn tồn tối đa',
  groupCode: 'Mã nhóm 2–20 ký tự chữ in hoa và số',
  groupName: 'Nhập tên nhóm hàng',
  color: 'Chọn màu dạng #RRGGBB',
} as const

const optionalInt = (v: string) => (v.trim() === '' ? null : Number(v.trim().replace(/\./g, '')))
const isNonNegInt = (v: number | null) => v === null || (Number.isInteger(v) && v >= 0)

export const productFormSchema = z
  .object({
    code: z.string().trim().refine((v) => PRODUCT_CODE_PATTERN.test(v.toUpperCase()), productMessages.code),
    name: z.string().trim().min(1, productMessages.name).max(200, 'Tên tối đa 200 ký tự'),
    groupId: z.string().min(1, productMessages.groupId),
    baseUnit: z.string().trim().min(1, productMessages.baseUnit).max(20, 'Đơn vị tối đa 20 ký tự'),
    barcode: z.string().trim().refine((v) => !v || BARCODE_PATTERN.test(v), productMessages.barcode),
    spec: z.string().trim().max(100, 'Quy cách tối đa 100 ký tự'),
    units: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string().trim().min(1, productMessages.unitName).max(30, 'Tên đơn vị tối đa 30 ký tự'),
          factor: z.string().trim(),
          barcode: z.string().trim().refine((v) => !v || BARCODE_PATTERN.test(v), productMessages.barcode),
          isUsed: z.boolean(),
        })
      )
      .max(MAX_UNITS, productMessages.units),
    levels: z.array(
      z.object({
        warehouseId: z.string(),
        warehouseCode: z.string(),
        warehouseName: z.string(),
        onHand: z.number(),
        minQty: z.string(),
        maxQty: z.string(),
      })
    ),
  })
  .superRefine((v, ctx) => {
    v.units.forEach((u, i) => {
      const f = Number(u.factor.replace(/\./g, ''))
      if (!Number.isInteger(f) || f < MIN_FACTOR || f > MAX_FACTOR) {
        ctx.addIssue({ code: 'custom', path: ['units', i, 'factor'], message: productMessages.factor })
      }
      const dup = v.units.some(
        (o, j) =>
          j < i &&
          (o.name.trim().toLowerCase() === u.name.trim().toLowerCase() || Number(o.factor) === f)
      )
      if (dup) ctx.addIssue({ code: 'custom', path: ['units', i, 'name'], message: productMessages.duplicateUnit })
    })
    v.levels.forEach((l, i) => {
      const min = optionalInt(l.minQty)
      const max = optionalInt(l.maxQty)
      if (!isNonNegInt(min)) ctx.addIssue({ code: 'custom', path: ['levels', i, 'minQty'], message: productMessages.minQty })
      if (!isNonNegInt(max)) ctx.addIssue({ code: 'custom', path: ['levels', i, 'maxQty'], message: productMessages.maxQty })
      if (isNonNegInt(min) && isNonNegInt(max) && min !== null && max !== null && min >= max) {
        ctx.addIssue({ code: 'custom', path: ['levels', i, 'minQty'], message: productMessages.minBelowMax })
      }
    })
  })

export type ProductFormValues = z.infer<typeof productFormSchema>

/** Form → `SaveProductRequest` (07 §2.3) */
export function toSaveProductRequest(v: ProductFormValues): SaveProductRequest {
  return {
    code: v.code.trim().toUpperCase(),
    name: v.name.trim(),
    groupId: v.groupId,
    baseUnit: v.baseUnit.trim(),
    barcode: v.barcode.trim() || undefined,
    spec: v.spec.trim() || undefined,
    units: v.units.map((u) => ({
      id: u.id,
      name: u.name.trim(),
      factor: Number(u.factor.replace(/\./g, '')),
      barcode: u.barcode.trim() || undefined,
    })),
    levels: v.levels.map((l) => ({
      warehouseId: l.warehouseId,
      minQty: optionalInt(l.minQty),
      maxQty: optionalInt(l.maxQty),
    })),
  }
}

export const productGroupFormSchema = z.object({
  code: z.string().trim().refine((v) => GROUP_CODE_PATTERN.test(v.toUpperCase()), productMessages.groupCode),
  name: z.string().trim().min(1, productMessages.groupName).max(100, 'Tên nhóm tối đa 100 ký tự'),
  color: z.string().trim().regex(COLOR_PATTERN, productMessages.color),
})

export type ProductGroupFormValues = z.infer<typeof productGroupFormSchema>
