import type { SheetData } from 'write-excel-file/universal'
import { normalizeVi } from '@/lib/normalize'

/**
 * Xuất bảng đang xem ra file Excel tại máy (FR-36, 07 §4.6) bằng gói `write-excel-file`: dòng tiêu đề, dòng bộ
 * lọc, tiêu đề cột, dữ liệu. Nạp gói lười khi bấm nút để không tăng kích thước trang.
 */

export type ExcelColumn<T> = {
  header: string
  value: (row: T) => string | number | null | undefined
  /** Độ rộng cột (ký tự) */
  width?: number
  /** Định dạng số Excel, vd '#,##0' (mặc định) hoặc '0.0' */
  format?: string
}

export type ExcelSheet = {
  /** Tên trang tính (tối đa 31 ký tự) */
  name: string
  data: SheetData
  widths: number[]
}

/** Dựng một trang tính: tiêu đề, bộ lọc (một dòng), dòng trống, tiêu đề cột, dữ liệu, dòng tổng (in đậm) */
export function excelSheet<T>(
  name: string,
  title: string,
  filters: string,
  columns: ExcelColumn<T>[],
  rows: T[],
  totalRow?: T
): ExcelSheet {
  const header = columns.map((c) => ({ value: c.header, fontWeight: 'bold' as const }))
  const cells = (row: T, bold = false) =>
    columns.map((c) => {
      const v = c.value(row)
      if (v === null || v === undefined || v === '') return null
      return typeof v === 'number'
        ? { value: v, type: Number, format: c.format ?? '#,##0', ...(bold ? { fontWeight: 'bold' as const } : {}) }
        : { value: String(v), type: String, ...(bold ? { fontWeight: 'bold' as const } : {}) }
    })
  const body = rows.map((r) => cells(r))
  return {
    name: name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31),
    data: [
      [{ value: title, fontWeight: 'bold' as const }],
      [{ value: filters }],
      [],
      header,
      ...body,
      ...(totalRow ? [cells(totalRow, true)] : []),
    ] as SheetData,
    widths: columns.map((c) => c.width ?? 16),
  }
}

/** Tên file không dấu: `xuat-nhap-ton-2026-10-01-2026-10-31.xlsx` (07 §4.6) */
export function excelFileName(title: string, from?: string, to?: string): string {
  const slug = normalizeVi(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return [slug, from, to].filter(Boolean).join('-') + '.xlsx'
}

export async function exportExcel(fileName: string, sheets: ExcelSheet[]) {
  const { default: writeXlsxFile } = await import('write-excel-file/universal')
  const blob = await writeXlsxFile(
    sheets.map((s) => ({
      data: s.data,
      sheet: s.name,
      columns: s.widths.map((width) => ({ width })),
    }))
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
