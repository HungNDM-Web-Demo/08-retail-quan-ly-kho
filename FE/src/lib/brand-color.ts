/**
 * Tính bộ màu thương hiệu từ một mã hex (Brand.PrimaryColor).
 * - Chế độ sáng: giữ đúng màu khách chọn, tự chọn chữ trắng hoặc chữ tối cho tương phản cao hơn.
 * - Chế độ tối: pha sáng dần tới khi đạt tương phản ≥ 5:1 với nền tối để chữ, viền focus đọc được.
 * Kết quả gán vào biến CSS --brand* trên <html>; theme.css lấy các biến này làm --primary.
 */

import { storageKey } from '@/lib/storage'

export const DEFAULT_BRAND_COLOR = '#2563EB'

/** Khóa localStorage lưu biến màu đã áp dụng; script trong <head> đọc để gán trước khi trang hiện (không chớp màu). */
export const BRAND_VARS_STORAGE_KEY = storageKey('brand-vars')

const LIGHT_TEXT = '#FFFFFF'
const DARK_TEXT = '#0F172A'
const DARK_BACKGROUND = '#0B1220'

type Rgb = [number, number, number]

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_PATTERN.test(value.trim())
}

/** "#25e" | "2563eb" → "#2563EB"; không hợp lệ trả về null. */
export function normalizeHex(value: string | null | undefined): string | null {
  if (!value || !isHexColor(value)) return null
  let hex = value.trim().replace('#', '')
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  return `#${hex.toUpperCase()}`
}

function hexToRgb(hex: string): Rgb {
  const clean = (normalizeHex(hex) ?? DEFAULT_BRAND_COLOR).slice(1)
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16)) as Rgb
}

function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Tỉ lệ tương phản WCAG giữa hai màu (1 → 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Pha màu với trắng theo tỉ lệ amount (0 → 1). */
function mixWithWhite(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  return rgbToHex(rgb.map((v) => v + (255 - v) * amount) as Rgb)
}

/** Chữ trắng hay chữ tối đặt trên nền `background` thì dễ đọc hơn. */
export function pickForeground(background: string): string {
  return contrastRatio(background, LIGHT_TEXT) >= contrastRatio(background, DARK_TEXT)
    ? LIGHT_TEXT
    : DARK_TEXT
}

export type BrandPalette = {
  light: string
  lightForeground: string
  dark: string
  darkForeground: string
  /** Tương phản giữa màu chính và chữ trên nút ở chế độ sáng */
  lightContrast: number
}

export function buildBrandPalette(input: string | null | undefined): BrandPalette {
  const light = normalizeHex(input) ?? DEFAULT_BRAND_COLOR
  const lightForeground = pickForeground(light)

  let dark = light
  for (let amount = 0; amount <= 0.9; amount += 0.05) {
    dark = mixWithWhite(light, amount)
    if (contrastRatio(dark, DARK_BACKGROUND) >= 5) break
  }

  return {
    light,
    lightForeground,
    dark,
    darkForeground: pickForeground(dark),
    lightContrast: contrastRatio(light, lightForeground),
  }
}

/** Biến CSS cần gán lên <html> (hoặc một vùng xem trước). */
export function brandCssVariables(input: string | null | undefined): Record<string, string> {
  const palette = buildBrandPalette(input)
  return {
    '--brand': palette.light,
    '--brand-foreground': palette.lightForeground,
    '--brand-dark': palette.dark,
    '--brand-dark-foreground': palette.darkForeground,
  }
}

/** Bảng màu gợi ý cho ô chọn màu thương hiệu và thanh công cụ demo. */
export const BRAND_PRESETS: { name: string; value: string }[] = [
  { name: 'Xanh dương', value: '#2563EB' },
  { name: 'Xanh chàm', value: '#4F46E5' },
  { name: 'Tím', value: '#7C3AED' },
  { name: 'Hồng', value: '#DB2777' },
  { name: 'Đỏ', value: '#DC2626' },
  { name: 'Cam', value: '#C2410C' },
  { name: 'Xanh lá', value: '#15803D' },
  { name: 'Xanh ngọc', value: '#0F766E' },
  { name: 'Nâu cà phê', value: '#7C4A2D' },
  { name: 'Xám than', value: '#334155' },
]
