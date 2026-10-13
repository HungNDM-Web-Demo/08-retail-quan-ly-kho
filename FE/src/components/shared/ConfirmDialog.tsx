'use client'

import { AlertTriangle, Loader2, type LucideIcon } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  /** Nội dung thêm dưới mô tả (danh sách ảnh hưởng, ô nhập lý do…) */
  children?: React.ReactNode
  confirmText?: string
  cancelText?: string
  /** destructive: nút đỏ, dùng cho xóa, khóa, đặt lại */
  variant?: 'default' | 'destructive'
  icon?: LucideIcon
  loading?: boolean
  /** Hộp thoại giữ nguyên tới khi onConfirm xong; tự đóng nếu không ném lỗi */
  onConfirm: () => void | Promise<void>
}

/** Hộp thoại xác nhận trước thao tác không hoàn tác được. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  variant = 'default',
  icon: Icon = AlertTriangle,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const destructive = variant === 'destructive'

  const handleConfirm = async () => {
    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      // Lỗi đã được nơi gọi hiển thị; giữ hộp thoại để người dùng thử lại
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader className="sm:flex sm:flex-row sm:items-start sm:gap-4 sm:text-left">
          <span
            className={cn(
              'mx-auto flex size-11 shrink-0 items-center justify-center rounded-full sm:mx-0',
              destructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
            )}
            aria-hidden="true"
          >
            <Icon className="size-5" />
          </span>
          <div className="space-y-1.5">
            <AlertDialogTitle className="font-semibold">{title}</AlertDialogTitle>
            {description && (
              <AlertDialogDescription className="text-pretty">{description}</AlertDialogDescription>
            )}
          </div>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          <Button
            variant={destructive ? 'danger' : 'default'}
            onClick={handleConfirm}
            disabled={loading}
            aria-busy={loading}
          >
            {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
            {confirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
