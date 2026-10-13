/**
 * Chuẩn hóa chuỗi tiếng Việt để tìm kiếm: chữ thường, bỏ dấu, "đ" → "d", gộp khoảng trắng.
 * Vd: "  Nguyễn   Thị ĐẸP " → "nguyen thi dep".
 */
export function normalizeVi(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Chuỗi có chứa từ khóa không (không phân biệt hoa thường, dấu).
 * Từ khóa nhiều từ thì mọi từ đều phải xuất hiện: "mai tran" khớp "Trần Thị Mai".
 */
export function matchesSearch(text: unknown, keyword: string | undefined | null): boolean {
  const query = normalizeVi(keyword)
  if (!query) return true
  const haystack = normalizeVi(text)
  return query.split(' ').every((word) => haystack.includes(word))
}
