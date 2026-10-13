'use client'

import { Bell, LayoutDashboard, Plus, ShieldCheck, Users } from 'lucide-react'
import { BrandMark } from '@/components/shared/BrandLogo'
import { brandCssVariables } from '@/lib/brand-color'

type BrandPreviewProps = { appName: string; logoUrl: string; primaryColor: string }

/** Xem trước thương hiệu (UC-SYS-07 bước 3): sidebar, header, nút, nhãn dùng màu và logo đang chọn. */
export function BrandPreview({ appName, logoUrl, primaryColor }: BrandPreviewProps) {
  const style = brandCssVariables(primaryColor) as React.CSSProperties

  return (
    <div className="brand-scope bg-background overflow-hidden rounded-xl border" style={style} aria-label="Xem trước giao diện">
      <div className="flex h-12 items-center gap-2 border-b px-3">
        <BrandMark size="sm" logoUrl={logoUrl} appName={appName || 'Ứng dụng'} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{appName || 'Tên ứng dụng'}</span>
        <Bell className="text-muted-foreground size-4" aria-hidden="true" />
      </div>
      <div className="flex">
        <div className="bg-card w-32 shrink-0 space-y-1 border-r p-2 text-xs">
          {[
            { icon: LayoutDashboard, label: 'Tổng quan', active: true },
            { icon: Users, label: 'Tài khoản' },
            { icon: ShieldCheck, label: 'Vai trò' },
          ].map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className={
                active
                  ? 'bg-primary/10 text-primary flex items-center gap-2 rounded-md px-2 py-1.5 font-semibold'
                  : 'text-muted-foreground flex items-center gap-2 rounded-md px-2 py-1.5'
              }
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-3 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">Tổng quan</span>
            <span className="bg-primary text-primary-foreground inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium">
              <Plus className="size-3.5" aria-hidden="true" />
              Thêm mới
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-card rounded-lg border p-2">
              <p className="text-muted-foreground text-[0.625rem]">Doanh thu</p>
              <p className="text-sm font-semibold">12.500.000 ₫</p>
            </div>
            <div className="bg-card rounded-lg border p-2">
              <p className="text-muted-foreground text-[0.625rem]">Đơn mới</p>
              <p className="text-primary text-sm font-semibold">+24</p>
            </div>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div className="bg-primary h-full w-2/3 rounded-full" />
          </div>
          <span className="text-primary text-xs font-medium underline underline-offset-2">Xem chi tiết</span>
        </div>
      </div>
    </div>
  )
}
