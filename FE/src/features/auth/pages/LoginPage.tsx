'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Clock, LayoutDashboard, Mail, Phone, ShieldCheck, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { appConfig } from '@/config/app.config'
import { useBrand } from '@/features/settings/hooks/use-settings'
import { formatPhone } from '@/lib/format'
import { LoginForm } from '../components/LoginForm'
import { QuickLogin } from '../components/QuickLogin'
import { useAuth } from '../hooks/use-auth'
import type { AuthResponse } from '../types/auth.types'

/** Chỉ cho quay lại đường dẫn nội bộ (chặn chuyển hướng sang trang ngoài). */
function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) {
    return appConfig.homeAfterLogin
  }
  return value
}

const HIGHLIGHTS = [
  { icon: ShieldCheck, title: 'Phân quyền theo vai trò', text: 'Mỗi vai trò chỉ thấy đúng menu và thao tác của mình.' },
  { icon: LayoutDashboard, title: 'Số liệu trực quan', text: 'Tổng quan, báo cáo cập nhật ngay khi có thao tác mới.' },
  { icon: Smartphone, title: 'Dùng mọi thiết bị', text: 'Máy tính, máy tính bảng và điện thoại.' },
]

/** SCR-SYS-01: đăng nhập + đăng nhập nhanh, tên và logo theo cài đặt thương hiệu. */
export function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hydrated, isAuthenticated } = useAuth()
  const brand = useBrand()
  const redirectTo = safeRedirect(searchParams.get('redirect'))
  const expired = searchParams.get('expired') === '1'

  // UC-SYS-01 luồng 1a: đã có phiên còn hạn thì vào thẳng
  useEffect(() => {
    if (hydrated && isAuthenticated) router.replace(redirectTo)
  }, [hydrated, isAuthenticated, redirectTo, router])

  const handleSuccess = (response: AuthResponse) => {
    toast.success(`Xin chào, ${response.user.fullName}!`)
    router.replace(redirectTo)
  }

  const { company } = brand
  const year = new Date().getFullYear()

  return (
    <div className="bg-background grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Cột form */}
      <div className="flex min-h-svh flex-col px-4 py-6 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between gap-3">
          <BrandLogo size="md" />
          <ThemeToggle />
        </div>

        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[26rem] space-y-7">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">Đăng nhập</h1>
              <p className="text-muted-foreground text-pretty">
                Chào mừng bạn đến với <span className="text-foreground font-medium">{brand.appName}</span>. Nhập tài
                khoản để tiếp tục.
              </p>
            </div>

            {expired && (
              <div
                role="status"
                className="border-warning/30 bg-warning/10 text-warning flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
              >
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.
              </div>
            )}

            <LoginForm onSuccess={handleSuccess} />
            <QuickLogin onSuccess={handleSuccess} />
          </div>
        </main>

        <footer className="text-muted-foreground flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {year} {company.name || brand.appName}
          </span>
          {company.hotline && (
            <a href={`tel:${company.hotline.replace(/\s/g, '')}`} className="hover:text-foreground inline-flex items-center gap-1.5">
              <Phone className="size-3.5" aria-hidden="true" />
              Hỗ trợ: {formatPhone(company.hotline)}
            </a>
          )}
        </footer>
      </div>

      {/* Cột thương hiệu (từ màn hình 1024 px) */}
      <aside className="bg-primary text-primary-foreground relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 20%, color-mix(in oklab, var(--primary-foreground) 16%, transparent) 0, transparent 40%), radial-gradient(circle at 85% 85%, color-mix(in oklab, var(--primary-foreground) 12%, transparent) 0, transparent 45%)',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(var(--primary-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--primary-foreground) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
          aria-hidden="true"
        />

        <p className="relative text-sm font-medium tracking-wide uppercase">{company.name || brand.appName}</p>

        <div className="relative max-w-lg space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl leading-tight font-semibold tracking-tight text-balance xl:text-5xl">{brand.appName}</h2>
            <p className="text-lg text-pretty">{appConfig.slogan}</p>
          </div>
          <ul className="space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="bg-primary-foreground/15 ring-primary-foreground/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {company.hotline && (
            <span className="inline-flex items-center gap-2">
              <Phone className="size-4" aria-hidden="true" />
              {formatPhone(company.hotline)}
            </span>
          )}
          {company.email && (
            <span className="inline-flex items-center gap-2">
              <Mail className="size-4" aria-hidden="true" />
              {company.email}
            </span>
          )}
        </div>
      </aside>
    </div>
  )
}
