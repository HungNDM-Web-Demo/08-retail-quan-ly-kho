'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { ArrowRight, Compass, KeyRound, Palette, Presentation, RotateCcw, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { appConfig } from '@/config/app.config'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import { getVisibleNavGroups } from '@/config/routes'
import { useRoleLabel } from '@/features/demo/hooks/use-demo'
import { useBrand } from '@/features/settings/hooks/use-settings'
import { usePermissions } from '@/hooks/use-permissions'

function greeting(date: Date) {
  const hour = date.getHours()
  if (hour < 11) return 'Chào buổi sáng'
  if (hour < 13) return 'Chào buổi trưa'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const DEMO_TIPS = [
  { icon: Presentation, text: 'Bấm nút "Demo" góc dưới phải để đổi vai trò, xem mỗi vai trò thấy gì.' },
  { icon: Palette, text: 'Thử màu thương hiệu của khách ngay trên thanh công cụ demo.' },
  { icon: RotateCcw, text: 'Xong buổi demo, đặt lại dữ liệu để về bản mẫu ban đầu.' },
]

/**
 * Trang Tổng quan nền: lời chào, vai trò hiện tại, lối tắt theo quyền.
 * Dự án thay bằng KPI, biểu đồ nghiệp vụ của mình.
 */
export function DashboardPage() {
  const { user, roles, can } = usePermissions()
  const roleLabel = useRoleLabel()
  const brand = useBrand()
  const now = new Date()

  const shortcuts = getVisibleNavGroups(can)
    .flatMap((group) => group.items)
    .filter((item) => item.href !== routePath.dashboard)

  const firstName = user?.fullName.split(' ').slice(-2).join(' ')

  return (
    <PermissionGuard permission={permissions.dashboard.view} redirect>
      <div className="space-y-6">
        <section className="bg-card relative overflow-hidden rounded-2xl border p-6 shadow-xs sm:p-8">
          <div
            className="bg-primary/10 pointer-events-none absolute -top-24 -right-16 size-72 rounded-full blur-3xl"
            aria-hidden="true"
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">{capitalize(format(now, "EEEE, 'ngày' dd/MM/yyyy", { locale: vi }))}</p>
              <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {greeting(now)}, {firstName}!
              </h1>
              <p className="text-muted-foreground max-w-2xl text-pretty">
                Bạn đang dùng <span className="text-foreground font-medium">{brand.appName}</span> với vai trò{' '}
                <span className="text-foreground font-medium">{roles.map(roleLabel).join(', ')}</span>. Menu và nút thao
                tác hiển thị theo đúng quyền của vai trò này.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {roles.map((code) => (
                  <StatusBadge key={code} tone="primary" icon={<KeyRound className="size-3" aria-hidden="true" />}>
                    {roleLabel(code)}
                  </StatusBadge>
                ))}
                {user?.isDemoAccount && <StatusBadge tone="warning">Tài khoản demo</StatusBadge>}
              </div>
            </div>
            <div className="bg-muted/60 grid shrink-0 grid-cols-2 gap-3 rounded-xl p-4 text-center sm:min-w-72">
              <div>
                <p className="text-2xl font-semibold tabular-nums">{user?.permissions.length ?? 0}</p>
                <p className="text-muted-foreground text-xs">Quyền được cấp</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">{shortcuts.length + 1}</p>
                <p className="text-muted-foreground text-xs">Chức năng truy cập</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Lối tắt</CardTitle>
              <CardDescription>Các chức năng vai trò của bạn được dùng.</CardDescription>
            </CardHeader>
            <CardContent>
              {shortcuts.length === 0 ? (
                <EmptyState
                  compact
                  icon={Compass}
                  title="Chưa có chức năng nào khác"
                  description="Liên hệ quản trị viên để được cấp thêm quyền."
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {shortcuts.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group hover:border-primary/40 focus-visible:ring-ring/50 flex items-start gap-3 rounded-xl border p-4 transition-[border-color,box-shadow] duration-200 outline-none hover:shadow-sm focus-visible:ring-3"
                    >
                      <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                        <item.icon className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 font-medium">
                          {item.title}
                          <ArrowRight
                            className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </span>
                        {item.description && <span className="text-muted-foreground mt-0.5 block text-sm">{item.description}</span>}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {appConfig.demoToolbar ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Gợi ý khi trình diễn</CardTitle>
                <CardDescription>Dành cho người giới thiệu sản phẩm.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4">
                  {DEMO_TIPS.map(({ icon: Icon, text }) => (
                    <li key={text} className="flex gap-3 text-sm">
                      <span className="bg-cta/12 text-cta flex size-8 shrink-0 items-center justify-center rounded-lg">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="text-pretty">{text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Tài khoản của bạn</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={routePath.profile} className="text-primary inline-flex items-center gap-2 text-sm font-medium hover:underline">
                  <Users className="size-4" aria-hidden="true" />
                  Xem hồ sơ, đổi mật khẩu
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PermissionGuard>
  )
}
