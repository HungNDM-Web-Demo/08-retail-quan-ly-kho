import {
  ArrowLeftRight,
  ClipboardCheck,
  ClipboardList,
  PackageMinus,
  PackagePlus,
} from 'lucide-react'
import { approvalPermissions, permissions } from '@/config/permissions'
import { routePath } from '@/config/route-path'
import type { NavGroup } from './index'

/** Nhóm Chứng từ (FE-Phiếu, docs/07 §4.9). */
export const documentsRoutes: NavGroup = {
  id: 'documents',
  label: 'Chứng từ',
  items: [
    {
      title: 'Phiếu nhập',
      href: routePath.goodsReceipts,
      icon: PackagePlus,
      permission: permissions.goodsReceipts.view,
      description: 'Nhận hàng nhà cung cấp, hàng trả lại, nhập khác',
    },
    {
      title: 'Phiếu xuất',
      href: routePath.goodsIssues,
      icon: PackageMinus,
      permission: permissions.goodsIssues.view,
      description: 'Xuất bán, trả nhà cung cấp, dùng nội bộ, xuất hủy',
    },
    {
      title: 'Chuyển kho',
      href: routePath.transfers,
      icon: ArrowLeftRight,
      permission: permissions.transfers.view,
      description: 'Chuyển hàng giữa các kho, nhận hàng chuyển đến',
    },
    {
      title: 'Phiếu chờ duyệt',
      href: routePath.approvals,
      icon: ClipboardCheck,
      permission: [...approvalPermissions],
      description: 'Duyệt hoặc từ chối phiếu nhập, xuất, chuyển, kiểm kê',
    },
    {
      title: 'Kiểm kê',
      href: routePath.stocktakes,
      icon: ClipboardList,
      permission: permissions.stocktakes.view,
      description: 'Đếm thực tế, điều chỉnh chênh lệch',
    },
  ],
}
