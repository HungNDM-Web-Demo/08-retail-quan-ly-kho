import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { UnitReading } from '@/types/inventory'
import { baseUnitWord, readQuantity } from '../lib/uom'

/**
 * Số lượng theo đơn vị cơ bản kèm cách đọc quy đổi (BR-01): "568 chai" · "23 thùng 16 chai".
 * Không có đơn vị quy đổi hoặc cách đọc trùng số cơ bản thì chỉ hiện một dòng.
 */
export function QuantityReading({
  quantity,
  baseUnit,
  units,
  inline = false,
  className,
  emphasis = false,
}: {
  quantity: number
  baseUnit: string
  units?: readonly UnitReading[]
  inline?: boolean
  emphasis?: boolean
  className?: string
}) {
  const main = `${formatNumber(quantity, 0)} ${baseUnitWord(baseUnit)}`
  const reading = readQuantity(quantity, baseUnit, units)
  const showReading = !!units?.length && reading !== `${quantity} ${baseUnitWord(baseUnit)}`
  if (inline) {
    return (
      <span className={cn('tabular-nums', className)}>
        <span className={cn(emphasis && 'font-semibold')}>{main}</span>
        {showReading && <span className="text-muted-foreground"> · {reading}</span>}
      </span>
    )
  }
  return (
    <span className={cn('inline-flex flex-col leading-tight tabular-nums', className)}>
      <span className={cn(emphasis && 'font-semibold')}>{main}</span>
      {showReading && <span className="text-muted-foreground text-xs">{reading}</span>}
    </span>
  )
}
