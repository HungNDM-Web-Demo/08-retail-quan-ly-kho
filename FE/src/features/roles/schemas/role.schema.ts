import { z } from 'zod'
import { ROLE_CODE_MESSAGE, ROLE_CODE_PATTERN } from '@/lib/validators'

export type RoleFormValues = {
  code: string
  name: string
  description: string
  /** Sao chép quyền từ vai trò có sẵn khi thêm mới ('none' là không sao chép) */
  copyFromId: string
}

/** Form thêm/sửa vai trò (UC-SYS-06 luồng 1a). Sửa thì không đổi mã. */
export function roleFormSchema(mode: 'create' | 'edit') {
  return z.object({
    code: mode === 'create' ? z.string().trim().toUpperCase().regex(ROLE_CODE_PATTERN, ROLE_CODE_MESSAGE) : z.string(),
    name: z.string().trim().min(1, 'Nhập tên vai trò').max(100, 'Tên vai trò tối đa 100 ký tự'),
    description: z.string().trim().max(500, 'Mô tả tối đa 500 ký tự'),
    copyFromId: z.string(),
  })
}
