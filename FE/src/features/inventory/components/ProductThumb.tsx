'use client'

import { useState } from 'react'
import { assetUrl } from '@/lib/asset-url'
import { cn } from '@/lib/utils'

/** Chữ viết tắt từ tên mặt hàng ("Nước tăng lực" → "NT") */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Ảnh mặt hàng (theo kiểu hàng, 06 §3); thiếu ảnh hoặc lỗi tải thì ô màu nhóm kèm chữ viết tắt.
 * Màu nhóm là dữ liệu (`ProductGroups.Color`), không phải màu giao diện.
 */
export function ProductThumb({
  name,
  imageUrl,
  groupColor,
  size = 'md',
  className,
}: {
  name: string
  imageUrl?: string | null
  groupColor?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const src = imageUrl && !failed ? assetUrl(imageUrl) : null
  const box = { sm: 'size-8 text-[0.625rem]', md: 'size-10 text-xs', lg: 'size-14 text-sm' }[size]
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn('bg-muted shrink-0 rounded-md border object-cover', box, className)}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn('text-primary-foreground bg-primary inline-flex shrink-0 items-center justify-center rounded-md font-semibold', box, className)}
      style={groupColor ? { backgroundColor: groupColor } : undefined}
    >
      {initials(name)}
    </span>
  )
}
