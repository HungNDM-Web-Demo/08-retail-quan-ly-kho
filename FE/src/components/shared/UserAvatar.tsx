'use client'

import { useAssetUrl } from '@/hooks/use-asset-url'
import { cn, getInitials } from '@/lib/utils'

const SIZES = {
  sm: 'size-8 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-14 text-lg',
} as const

type UserAvatarProps = {
  name?: string | null
  avatarUrl?: string | null
  size?: keyof typeof SIZES
  className?: string
}

/** Ảnh đại diện; chưa có ảnh thì hiện chữ viết tắt họ tên trên nền màu chính nhạt. */
export function UserAvatar({ name, avatarUrl, size = 'md', className }: UserAvatarProps) {
  const src = useAssetUrl(avatarUrl)
  const base = cn(SIZES[size], 'shrink-0 rounded-full', className)
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- ảnh có thể là idb:// hoặc từ BE
    return <img src={src} alt={name ?? 'Ảnh đại diện'} className={cn(base, 'object-cover')} />
  }
  return (
    <span
      aria-hidden="true"
      className={cn(base, 'bg-primary/12 text-primary flex items-center justify-center font-semibold')}
    >
      {getInitials(name)}
    </span>
  )
}
