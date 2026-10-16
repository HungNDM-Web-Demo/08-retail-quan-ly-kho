import { cn } from '@/lib/utils'

/**
 * Bảng chứng từ: viền đen, tiêu đề cột lặp lại mỗi trang (`thead { display: table-header-group }` ở PrintStyles).
 * Truyền `<thead>`, `<tbody>`, `<tfoot>` làm children.
 */
export function PrintTable({ className, children }: { className?: string; children: React.ReactNode }) {
  return <table className={cn('text-[10.5pt] [&_th]:text-center [&_th]:font-semibold', className)}>{children}</table>
}

/** Ô số căn phải, chữ số đều */
export function NumCell({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn('text-right whitespace-nowrap tabular-nums', className)}>
      {children}
    </td>
  )
}
