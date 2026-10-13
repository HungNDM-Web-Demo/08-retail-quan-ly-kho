import type { LucideIcon } from 'lucide-react'
import { mainRoutes } from './main.routes'
import { settingsRoutes } from './settings.routes'
import { hiddenRoutes } from './hidden.routes'

/**
 * Cây menu sidebar (KIEN-TRUC-HE-THONG §6.4). Mỗi mục gắn mã quyền;
 * AppSidebar tự ẩn mục người dùng không có quyền, layout chặn khi vào thẳng URL.
 * Dự án thêm nhóm menu nghiệp vụ: tạo file `xxx.routes.ts` rồi thêm vào `navGroups`.
 */

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  /** Một mã hoặc danh sách mã (chỉ cần có một). Bỏ trống: ai đăng nhập cũng xem được */
  permission?: string | string[]
  /** Mô tả ngắn, hiện ở lối tắt trên trang Tổng quan */
  description?: string
  /** Mở trong tab mới (vd "Xem trang công khai"); không dùng để khớp tiêu đề Header, chặn quyền */
  newTab?: boolean
}

export type NavGroup = {
  id: string
  /** Tiêu đề nhóm trên sidebar; bỏ trống thì không hiện tiêu đề */
  label?: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [mainRoutes, settingsRoutes]

export type CanFn = (permission: string) => boolean

export function isItemAllowed(item: Pick<NavItem, 'permission'>, can: CanFn): boolean {
  if (!item.permission) return true
  const list = Array.isArray(item.permission) ? item.permission : [item.permission]
  return list.length === 0 || list.some((p) => can(p))
}

/** Nhóm menu sau khi lọc theo quyền; bỏ nhóm không còn mục nào. */
export function getVisibleNavGroups(can: CanFn): NavGroup[] {
  return navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => isItemAllowed(item, can)) }))
    .filter((group) => group.items.length > 0)
}

export type RouteMatch = { item: NavItem; group?: NavGroup }

/** Tìm mục khớp đường dẫn dài nhất (vd /settings/users/123 → Tài khoản). */
export function findRoute(pathname: string): RouteMatch | undefined {
  const candidates: RouteMatch[] = [
    ...navGroups.flatMap((group) =>
      group.items.filter((item) => !item.newTab).map((item) => ({ item, group }))
    ),
    ...hiddenRoutes.map((item) => ({ item })),
  ]
  return candidates
    .filter(({ item }) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.item.href.length - a.item.href.length)[0]
}

/** Người dùng có được vào đường dẫn này không (đường dẫn không khai báo thì cho qua). */
export function canAccessPath(pathname: string, can: CanFn): boolean {
  const match = findRoute(pathname)
  return match ? isItemAllowed(match.item, can) : true
}
