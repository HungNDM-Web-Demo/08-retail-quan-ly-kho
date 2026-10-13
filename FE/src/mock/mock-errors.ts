import { ApiError } from '@/lib/api-error'

/**
 * Tạo lỗi dạng ProblemDetails giống ExceptionMiddleware của BE (KIEN-TRUC-HE-THONG §5.4).
 * Dùng `throw validation({...})` trong handler mock.
 */

type FieldErrors = Record<string, string | string[]>

const toErrors = (errors: FieldErrors) =>
  Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [key, Array.isArray(value) ? value : [value]])
  )

/** 400: dữ liệu gửi lên sai, key là tên trường camelCase để FE gắn lỗi vào ô nhập. */
export function validation(errors: FieldErrors, detail = 'Dữ liệu chưa hợp lệ.'): ApiError {
  return ApiError.fromStatus(400, detail, { errors: toErrors(errors) })
}

/**
 * 400: vi phạm quy tắc nghiệp vụ (DomainException).
 * `missing`: danh sách điều kiện còn thiếu để FE liệt kê, vd ["Chưa có món", "Chưa chọn bàn"].
 */
export function domain(
  detail: string,
  extensions: { missing?: string[] } & Record<string, unknown> = {}
): ApiError {
  return ApiError.fromStatus(400, detail, extensions)
}

/** 401: chưa đăng nhập, sai thông tin đăng nhập hoặc phiên hết hạn. */
export function unauthorized(detail = 'Phiên đăng nhập đã hết hạn.'): ApiError {
  return ApiError.fromStatus(401, detail)
}

/** 403: thiếu quyền. */
export function forbidden(detail = 'Bạn không có quyền thực hiện thao tác này.'): ApiError {
  return ApiError.fromStatus(403, detail)
}

/** 404: không tìm thấy bản ghi. */
export function notFound(detail = 'Không tìm thấy dữ liệu.'): ApiError {
  return ApiError.fromStatus(404, detail)
}

/** 409: trùng mã, trùng dữ liệu. Có thể kèm lỗi theo trường để hiện tại ô nhập. */
export function conflict(detail: string, errors?: FieldErrors): ApiError {
  return ApiError.fromStatus(409, detail, errors ? { errors: toErrors(errors) } : {})
}
