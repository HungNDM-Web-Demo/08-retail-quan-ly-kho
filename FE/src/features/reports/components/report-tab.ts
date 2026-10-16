import type { DateRange } from '../lib/date-range'

/** Props chung của các tab báo cáo: kỳ đã hợp lệ, kho (trống = Tất cả kho), chữ mô tả kho cho dòng bộ lọc Excel */
export type ReportTabProps = {
  range: DateRange
  warehouseId?: string
  /** "Tất cả kho" hoặc "Kho KTONG – Kho tổng Bình Tân" */
  scopeText: string
  /** Chỉ gọi API khi tab đang mở */
  enabled: boolean
}
