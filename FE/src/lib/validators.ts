/**
 * Quy tắc kiểm tra dùng chung cho schema form (Zod) và handler mock,
 * để hai phía báo cùng một thông báo (USE-CASE-NEN §3).
 */

/** BR-SYS-01: 3–50 ký tự, chữ thường không dấu, số, dấu . _ */
export const USERNAME_PATTERN = /^[a-z0-9._]{3,50}$/
export const USERNAME_MESSAGE = 'Tên đăng nhập 3–50 ký tự, gồm chữ thường không dấu, số, dấu . hoặc _'

/** BR-SYS-02: tối thiểu 8 ký tự, có chữ và số */
export const PASSWORD_MESSAGE = 'Mật khẩu tối thiểu 8 ký tự, có cả chữ và số'
export const isValidPassword = (value: string) =>
  value.length >= 8 && /[A-Za-zÀ-ỹ]/.test(value) && /\d/.test(value)

/** Số điện thoại Việt Nam: 10–11 số, bắt đầu bằng 0 (cho phép khoảng trắng, dấu chấm) */
export const PHONE_MESSAGE = 'Số điện thoại gồm 10–11 số, bắt đầu bằng 0'
export const isValidPhone = (value: string) => /^0\d{9,10}$/.test(value.replace(/[\s.]/g, ''))
export const cleanPhone = (value: string | null | undefined) =>
  value ? value.replace(/[\s.]/g, '') : value

export const EMAIL_MESSAGE = 'Email chưa đúng định dạng'
export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)

/** Mã vai trò: chữ in hoa không dấu, số, dấu _ (vd CASHIER, KITCHEN_LEAD) */
export const ROLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/
export const ROLE_CODE_MESSAGE = 'Mã vai trò 2–50 ký tự, chữ in hoa không dấu, số hoặc dấu _'
