import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'

/**
 * Hiển thị chuẩn (KIEN-TRUC-HE-THONG §11, FE-CAU-TRUC-THU-MUC §7).
 * Mọi hàm nhận null/undefined và trả về `fallback` (mặc định "—").
 */

type DateInput = string | number | Date | null | undefined

const NBSP = ' '
const numberFormatters = new Map<number, Intl.NumberFormat>()

function getNumberFormatter(decimals: number) {
  let formatter = numberFormatters.get(decimals)
  if (!formatter) {
    formatter = new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    })
    numberFormatters.set(decimals, formatter)
  }
  return formatter
}

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = typeof value === 'string' ? parseISO(value) : new Date(value)
  return isValid(date) ? date : null
}

/** 1250000 → "1.250.000", 0.5 → "0,5" */
export function formatNumber(value: number | null | undefined, decimals = 2, fallback = '—'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback
  return getNumberFormatter(decimals).format(value)
}

/** 1250000 → "1.250.000 ₫" (khoảng trắng không ngắt dòng trước ký hiệu ₫) */
export function formatVnd(value: number | null | undefined, fallback = '—'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback
  return `${getNumberFormatter(0).format(Math.round(value))}${NBSP}₫`
}

/** → "12/10/2026" */
export function formatDate(value: DateInput, fallback = '—'): string {
  const date = toDate(value)
  return date ? format(date, 'dd/MM/yyyy') : fallback
}

/** → "12/10/2026 14:30" */
export function formatDateTime(value: DateInput, fallback = '—'): string {
  const date = toDate(value)
  return date ? format(date, 'dd/MM/yyyy HH:mm') : fallback
}

/** → "14:30" */
export function formatTime(value: DateInput, fallback = '—'): string {
  const date = toDate(value)
  return date ? format(date, 'HH:mm') : fallback
}

/** → "5 phút trước", "3 ngày trước" */
export function formatRelativeTime(value: DateInput, fallback = '—'): string {
  const date = toDate(value)
  return date ? formatDistanceToNow(date, { addSuffix: true, locale: vi }) : fallback
}

/** "0901234567" | "+84901234567" → "0901 234 567"; số 11 chữ số → "0xxx xxx xxxx". */
export function formatPhone(value: string | null | undefined, fallback = '—'): string {
  if (!value) return fallback
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('84') && digits.length >= 11) digits = `0${digits.slice(2)}`
  if (digits.length === 10) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  if (digits.length === 11) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  return value
}

/** Ngày dạng "yyyy-MM-dd" theo giờ máy (dùng cho input type="date"). */
export function toDateInputValue(value: DateInput): string {
  const date = toDate(value)
  return date ? format(date, 'yyyy-MM-dd') : ''
}
