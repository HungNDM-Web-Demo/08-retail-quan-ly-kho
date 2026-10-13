import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Lấy chữ cái đầu của hai từ cuối trong họ tên, vd "Nguyễn Minh Quân" → "MQ". */
export function getInitials(name?: string | null): string {
  if (!name) return '?'
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const picked = words.length === 1 ? words : words.slice(-2)
  return picked.map((w) => w.charAt(0).toUpperCase()).join('')
}
