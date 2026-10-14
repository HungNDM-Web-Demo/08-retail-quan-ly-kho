/**
 * Nhãn, gợi ý và quy tắc kiểm tra cho khóa cài đặt riêng của dự án (project.json → settings).
 * Trang Cài đặt chung hiển thị khóa ngoài nhóm Thương hiệu/Doanh nghiệp theo nhóm; dùng bảng này để có nhãn
 * tiếng Việt thay vì tên khóa. Mock gọi `validateProjectSettings` khi lưu, nên quy tắc ở đây phải giống BE.
 *
 * Ví dụ (dự án nhà hàng):
 *   'Billing.VatRate': { label: 'Thuế suất GTGT (%)', hint: 'Một trong 0, 5, 8, 10' }
 */
export const settingExtraLabels: Record<string, { label: string; hint?: string }> = {}

/** Kiểm tra giá trị cài đặt riêng của dự án; trả về { [chỉ số trong items]: thông báo lỗi }. */
export function validateProjectSettings(
  items: { key: string; value?: string | null }[],
  current: Record<string, string>
): Record<number, string> {
  void items
  void current
  return {}
}
