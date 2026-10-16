/**
 * Nhãn, gợi ý và quy tắc kiểm tra cho khóa cài đặt riêng của dự án (project.json → settings;
 * docs/06-THIET-KE-CSDL.md §3). Trang Cài đặt chung hiển thị khóa ngoài nhóm Thương hiệu/Doanh nghiệp theo nhóm;
 * mock gọi `validateProjectSettings` khi lưu, BE kiểm cùng quy tắc.
 * Nhóm "Đơn vị in trên chứng từ" (Store.*) in ở đầu phiếu nhập, xuất, chuyển, biên bản kiểm kê (01-VT, 02-VT, 05-VT).
 */
export const settingExtraLabels: Record<string, { label: string; hint?: string }> = {
  'Store.Name': {
    label: 'Tên đơn vị',
    hint: 'In ở góc trên trái các phiếu kho, vd "Công ty TNHH Phân phối Tân Lộc Phát"',
  },
  'Store.Address': { label: 'Địa chỉ', hint: 'In dưới tên đơn vị' },
  'Store.Phone': { label: 'Số điện thoại', hint: 'In dưới địa chỉ, có thể bỏ trống' },
  'Store.TaxCode': { label: 'Mã số thuế', hint: '10 hoặc 13 chữ số, có thể bỏ trống' },
  'Store.DirectorName': {
    label: 'Họ tên giám đốc',
    hint: 'In dưới chữ ký "Giám đốc", có thể bỏ trống',
  },
  'Store.ChiefAccountantName': {
    label: 'Họ tên kế toán trưởng',
    hint: 'In dưới chữ ký "Kế toán trưởng", có thể bỏ trống',
  },
}

/** Kiểm tra giá trị cài đặt riêng của dự án; trả về { [chỉ số trong items]: thông báo lỗi }. */
export function validateProjectSettings(
  items: { key: string; value?: string | null }[],
  current: Record<string, string>
): Record<number, string> {
  void current
  const errors: Record<number, string> = {}
  items.forEach(({ key, value }, i) => {
    const v = (value ?? '').trim()
    switch (key) {
      case 'Store.Name':
        if (!v) errors[i] = 'Nhập tên đơn vị'
        break
      case 'Store.TaxCode':
        if (v && !/^\d{10}(-?\d{3})?$/.test(v)) errors[i] = 'Mã số thuế gồm 10 hoặc 13 chữ số'
        break
    }
  })
  return errors
}
