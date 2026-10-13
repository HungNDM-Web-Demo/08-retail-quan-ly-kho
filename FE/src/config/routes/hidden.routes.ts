import { UserRound } from 'lucide-react'
import { routePath } from '@/config/route-path'
import type { NavItem } from './index'

/** Trang không nằm trong menu nhưng cần tiêu đề trên Header và kiểm tra quyền. */
export const hiddenRoutes: NavItem[] = [
  {
    title: 'Hồ sơ cá nhân',
    href: routePath.profile,
    icon: UserRound,
  },
]
