import { AppShell } from '@/components/shared/AppShell'
import { AuthGuard } from '@/features/auth/components/AuthGuard'

/** Khu vực cần đăng nhập: sidebar + header + thanh công cụ demo (KIEN-TRUC-HE-THONG §6.4). */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  )
}
