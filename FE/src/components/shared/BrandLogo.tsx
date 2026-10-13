'use client'

import { useState } from 'react'
import { appConfig } from '@/config/app.config'
import { useBrand } from '@/features/settings/hooks/use-settings'
import { useAssetUrl } from '@/hooks/use-asset-url'
import { cn, getInitials } from '@/lib/utils'

const SIZES = {
  sm: { box: 'size-8 rounded-lg text-xs', name: 'text-sm' },
  md: { box: 'size-9 rounded-lg text-sm', name: 'text-base' },
  lg: { box: 'size-12 rounded-xl text-base', name: 'text-xl' },
} as const

type BrandMarkProps = {
  size?: keyof typeof SIZES
  className?: string
  /** Ghi đè logo/tên (dùng cho vùng xem trước ở Cài đặt chung) */
  logoUrl?: string | null
  appName?: string
}

/**
 * Biểu tượng thương hiệu: ảnh logo đã tải lên, hoặc ô màu chính kèm chữ viết tắt tên ứng dụng
 * (logo mặc định /logo/logo.svg cũng hiển thị dạng này để luôn theo màu thương hiệu).
 */
export function BrandMark({ size = 'md', className, logoUrl, appName }: BrandMarkProps) {
  const brand = useBrand()
  const url = logoUrl !== undefined ? logoUrl : brand.logoUrl
  const name = appName ?? brand.appName
  const src = useAssetUrl(url && url !== appConfig.logoUrl ? url : null)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const s = SIZES[size]

  if (src && failedSrc !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logo có thể là idb://, blob: hoặc ảnh từ BE
      <img
        src={src}
        alt={`Logo ${name}`}
        onError={() => setFailedSrc(src)}
        className={cn(s.box, 'shrink-0 bg-transparent object-contain', className)}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        s.box,
        'bg-primary text-primary-foreground flex shrink-0 items-center justify-center font-bold tracking-tight shadow-sm',
        className
      )}
    >
      {getInitials(name)}
    </span>
  )
}

type BrandLogoProps = BrandMarkProps & {
  showName?: boolean
  nameClassName?: string
  subtitle?: string
}

/** Logo + tên ứng dụng theo cài đặt thương hiệu. */
export function BrandLogo({ showName = true, nameClassName, subtitle, className, ...props }: BrandLogoProps) {
  const brand = useBrand()
  const name = props.appName ?? brand.appName
  const s = SIZES[props.size ?? 'md']
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <BrandMark {...props} />
      {showName && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className={cn('truncate font-semibold tracking-tight', s.name, nameClassName)}>{name}</span>
          {subtitle && <span className="text-muted-foreground truncate text-xs">{subtitle}</span>}
        </span>
      )}
    </span>
  )
}
