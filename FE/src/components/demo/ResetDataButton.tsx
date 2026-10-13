'use client'

import { DatabaseBackup, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { roleCodes } from '@/config/permissions'
import { useResetDemoData } from '@/features/demo/hooks/use-demo'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'

/** Nút "Đặt lại dữ liệu" trong panel công cụ demo; chỉ Quản trị viên dùng được (UC-SYS-10). */
export function ResetDataButton({ onRequest }: { onRequest: () => void }) {
  const { hasRole } = usePermissions()
  const allowed = hasRole(roleCodes.admin)
  return (
    <div className="space-y-1.5">
      <Button variant="destructive" className="w-full" disabled={!allowed} onClick={onRequest}>
        <RotateCcw aria-hidden="true" />
        Đặt lại dữ liệu
      </Button>
      <p className="text-muted-foreground text-xs">
        {allowed
          ? 'Xóa dữ liệu phát sinh trong buổi demo, nạp lại dữ liệu mẫu. Tài khoản, vai trò, cài đặt giữ nguyên.'
          : 'Chuyển sang vai trò Quản trị viên để đặt lại dữ liệu.'}
      </p>
    </div>
  )
}

/** Hộp thoại xác nhận đặt lại dữ liệu; thành công thì tải lại trang. */
export function ResetDataDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const reset = useResetDemoData()

  const handleConfirm = async () => {
    try {
      await reset.mutateAsync()
      toast.success('Đã đặt lại dữ liệu mẫu', { description: 'Trang sẽ tải lại ngay.' })
      setTimeout(() => window.location.reload(), 600)
    } catch (error) {
      toast.error(getErrorMessage(error))
      throw error
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      variant="destructive"
      icon={DatabaseBackup}
      title="Đặt lại toàn bộ dữ liệu demo?"
      description="Mọi thay đổi trong buổi demo (đơn, khách hàng, sản phẩm… đã thêm hoặc sửa) sẽ mất và dữ liệu mẫu được nạp lại theo ngày hôm nay. Tài khoản, vai trò và cài đặt thương hiệu giữ nguyên."
      confirmText="Đặt lại dữ liệu"
      loading={reset.isPending}
      onConfirm={handleConfirm}
    />
  )
}
