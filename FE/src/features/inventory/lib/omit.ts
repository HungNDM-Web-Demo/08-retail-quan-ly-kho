/** Bản sao object bỏ một khóa (xóa lỗi của một ô) */
export function omitKey<T extends Record<string, unknown>>(obj: T, key: string): T {
  if (!(key in obj)) return obj
  const copy = { ...obj }
  delete copy[key]
  return copy
}
