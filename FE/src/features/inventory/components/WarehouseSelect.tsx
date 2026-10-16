'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useMyWarehouses, useWarehouseOptions } from '../hooks/use-inventory'

const ALL = '__all__'

/**
 * Ô chọn kho trong phạm vi người dùng (`GET /api/warehouses/my`, BR-23). `activeOnly` (phiếu mới) chỉ cho chọn kho
 * đang hoạt động (kho ngừng vẫn hiện, bị khóa). `allLabel` thêm mục "Tất cả kho" (giá trị rỗng).
 */
export function WarehouseSelect({
  value,
  onChange,
  activeOnly = false,
  allLabel,
  excludeId,
  placeholder = 'Chọn kho',
  disabled,
  className,
  id,
  invalid,
  'aria-label': ariaLabel,
  source = 'my',
}: {
  value: string | null | undefined
  onChange: (warehouseId: string) => void
  activeOnly?: boolean
  allLabel?: string
  excludeId?: string | null
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  invalid?: boolean
  /** Tên cho trình đọc màn hình khi không có nhãn gắn bằng `id` (bộ lọc) */
  'aria-label'?: string
  /** `options`: mọi kho đang hoạt động (`GET /api/warehouses/options`) cho ô "Kho đến" phiếu chuyển (UC-06, 07 §5 #46) */
  source?: 'my' | 'options'
}) {
  const my = useMyWarehouses()
  const options = useWarehouseOptions(source === 'options')
  const { data: warehouses = [], isLoading } = source === 'options' ? options : my
  return (
    <Select
      value={value ? value : allLabel ? ALL : ''}
      onValueChange={(v) => onChange(v === ALL ? '' : v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger
        id={id}
        aria-label={id ? undefined : (ariaLabel ?? (allLabel ? 'Lọc theo kho' : 'Kho'))}
        aria-invalid={invalid || undefined}
        className={cn('w-full', className)}
      >
        <SelectValue placeholder={isLoading ? 'Đang tải kho…' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {warehouses
          .filter((w) => w.id !== excludeId)
          .map((w) => (
            <SelectItem key={w.id} value={w.id} disabled={activeOnly && !w.isActive}>
              <span className="font-medium">{w.code}</span>
              <span className="text-muted-foreground"> · {w.name}</span>
              {!w.isActive && <span className="text-muted-foreground"> (ngừng hoạt động)</span>}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  )
}
