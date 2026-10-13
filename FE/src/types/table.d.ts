import '@tanstack/react-table'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Lớp CSS cho ô dữ liệu (căn phải số tiền, độ rộng cột…) */
    className?: string
    /** Lớp CSS cho ô tiêu đề */
    headerClassName?: string
    /** Tên trường gửi lên API khi sắp xếp (mặc định là id cột) */
    sortKey?: string
  }
}
