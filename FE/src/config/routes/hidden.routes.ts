import { Printer, UserRound } from 'lucide-react'
import { permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavItem } from './index'

/**
 * Trang không nằm trong menu nhưng cần tiêu đề trên Header và kiểm tra quyền.
 * Bản in ở app/(print)/print/... (docs/07 §2.11): `canAccessPath` khớp tiền tố dài nhất.
 */
export const hiddenRoutes: NavItem[] = [
  {
    title: 'Hồ sơ cá nhân',
    href: routePath.profile,
    icon: UserRound,
  },
  {
    title: 'In phiếu nhập kho',
    href: `${routePath.printRoot}/goods-receipts`,
    icon: Printer,
    permission: permissions.goodsReceipts.view,
  },
  {
    title: 'In phiếu xuất kho',
    href: `${routePath.printRoot}/goods-issues`,
    icon: Printer,
    permission: permissions.goodsIssues.view,
  },
  {
    title: 'In phiếu chuyển kho',
    href: `${routePath.printRoot}/transfers`,
    icon: Printer,
    permission: permissions.transfers.view,
  },
  {
    title: 'In biên bản kiểm kê',
    href: `${routePath.printRoot}/stocktakes`,
    icon: Printer,
    permission: permissions.stocktakes.view,
  },
  {
    title: 'In thẻ kho',
    href: `${routePath.printRoot}/stock-card`,
    icon: Printer,
    permission: permissions.stockLevels.view,
  },
]
