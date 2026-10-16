import { AuthGuard } from '@/features/auth/components/AuthGuard'
import { PrintStyles } from '@/features/inventory/components/print/PrintStyles'

/**
 * Bản in chứng từ (07 §2.11, §4.7): cần đăng nhập và quyền xem theo `hidden.routes.ts`, không sidebar,
 * khổ A4 dọc, chữ ≥ 11 pt, lặp tiêu đề cột khi nhiều trang (NFR-06).
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <PrintStyles />
      {children}
    </AuthGuard>
  )
}
