import type { LucideIcon } from 'lucide-react'
import { appConfig } from '@/config/app.config'
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
  /**
   * Ẩn mục khỏi menu khi người dùng CÓ một trong các quyền này (vd "Ca của tôi" ẩn với người đã
   * có "Ca làm"). Chỉ ảnh hưởng menu, không chặn vào thẳng URL.
   */
  hideWhen?: string | string[]
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

const toList = (value: string | string[] | undefined) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value]

export function isItemAllowed(item: Pick<NavItem, 'permission'>, can: CanFn): boolean {
  if (!item.permission) return true
  const list = toList(item.permission)
  return list.length === 0 || list.some((p) => can(p))
}

/** Mục có hiện trên menu không: đủ quyền và không rơi vào `hideWhen`. */
export function isItemVisible(item: Pick<NavItem, 'permission' | 'hideWhen'>, can: CanFn): boolean {
  if (!isItemAllowed(item, can)) return false
  return !toList(item.hideWhen).some((p) => can(p))
}

/** Nhóm menu sau khi lọc theo quyền; bỏ nhóm không còn mục nào. */
export function getVisibleNavGroups(can: CanFn): NavGroup[] {
  return navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => isItemVisible(item, can)) }))
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

/**
 * Trang chủ theo quyền (07-DANH-SACH-API §4): vào được `homeAfterLogin` thì dùng trang đó,
 * không thì mục menu đầu tiên có quyền (thu ngân không có `dashboard.view` → mục Bán hàng).
 * Không có mục nào thì vẫn trả `homeAfterLogin` để AuthGuard đưa về /forbidden.
 */
export function resolveHomePath(can: CanFn): string {
  if (canAccessPath(appConfig.homeAfterLogin, can)) return appConfig.homeAfterLogin
  const first = getVisibleNavGroups(can)
    .flatMap((group) => group.items)
    .find((item) => !item.newTab)
  return first?.href ?? appConfig.homeAfterLogin
}

/** Như `resolveHomePath` nhưng nhận thẳng người dùng (dùng ngay sau khi đăng nhập, chưa có hook). */
export function homePathForUser(
  user: { permissions: string[]; isSuperAdmin: boolean } | null | undefined
): string {
  return resolveHomePath((p) => !!user && (user.isSuperAdmin || user.permissions.includes(p)))
}
