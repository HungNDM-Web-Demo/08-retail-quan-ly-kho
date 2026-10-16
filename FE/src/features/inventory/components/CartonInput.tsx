'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { splitCartons, unitShortName } from '../lib/uom'

const toInt = (text: string) => {
  const digits = text.replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

/**
 * Ô nhập "thùng + lẻ" (07 §3.1, kiểm kê, nhận hàng): giá trị là số lượng theo đơn vị cơ bản
 * = thùng × hệ số + lẻ. Không có đơn vị quy đổi thì chỉ một ô. Ô số `inputMode="numeric"`, cao ≥ 44 px (NFR-01).
 * `value` null = chưa nhập.
 */
export function CartonInput({
  value,
  onChange,
  onCommit,
  baseUnit,
  unit,
  disabled,
  invalid,
  className,
  idPrefix,
}: {
  value: number | null | undefined
  onChange: (baseQuantity: number | null) => void
  /** Gọi khi rời ô hoặc Enter (gửi lô số đếm) */
  onCommit?: () => void
  baseUnit: string
  /** Đơn vị quy đổi dùng để tách (thường là đơn vị lớn nhất) */
  unit?: { name: string; factor: number } | null
  disabled?: boolean
  invalid?: boolean
  className?: string
  idPrefix?: string
}) {
  const factor = unit && unit.factor > 1 ? unit.factor : 1
  const split = value == null ? null : splitCartons(value, factor)
  const [cartons, setCartons] = useState(split ? String(split.cartons) : '')
  const [loose, setLoose] = useState(split ? String(split.loose) : '')

  // Đồng bộ khi giá trị ngoài đổi (quét mã cộng thêm, tải lại phiếu): so với giá trị đang hiển thị
  const shown = cartons === '' && loose === '' ? null : toInt(cartons) * factor + toInt(loose)
  const [prev, setPrev] = useState({ value: value ?? null, factor })
  if (prev.value !== (value ?? null) || prev.factor !== factor) {
    setPrev({ value: value ?? null, factor })
    if (shown !== (value ?? null) || prev.factor !== factor) {
      const s = value == null ? null : splitCartons(value, factor)
      setCartons(s ? String(s.cartons) : '')
      setLoose(s ? String(s.loose) : '')
    }
  }

  const emit = (c: string, l: string) => {
    if (c === '' && l === '') return onChange(null)
    // Không tự cắt khi vượt `max`: người gọi báo lỗi tại ô
    onChange(toInt(c) * factor + toInt(l))
  }

  const common = {
    inputMode: 'numeric' as const,
    disabled,
    'aria-invalid': invalid || undefined,
    className: 'h-11 w-full min-w-0 text-right tabular-nums',
    onBlur: () => onCommit?.(),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') onCommit?.()
    },
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(),
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {factor > 1 && (
        <>
          <label className="flex min-w-0 flex-1 items-center gap-1.5">
            <Input
              {...common}
              id={idPrefix ? `${idPrefix}-cartons` : undefined}
              value={cartons}
              aria-label={`Số ${unitShortName(unit!.name)}`}
              onChange={(e) => {
                setCartons(e.target.value.replace(/\D/g, ''))
                emit(e.target.value.replace(/\D/g, ''), loose)
              }}
            />
            <span className="text-muted-foreground shrink-0 text-xs">{unitShortName(unit!.name)}</span>
          </label>
          <span className="text-muted-foreground text-xs">+</span>
        </>
      )}
      <label className="flex min-w-0 flex-1 items-center gap-1.5">
        <Input
          {...common}
          id={idPrefix ? `${idPrefix}-loose` : undefined}
          value={loose}
          aria-label={`Số ${baseUnit.toLowerCase()} lẻ`}
          onChange={(e) => {
            setLoose(e.target.value.replace(/\D/g, ''))
            emit(cartons, e.target.value.replace(/\D/g, ''))
          }}
        />
        <span className="text-muted-foreground shrink-0 text-xs">{baseUnit.toLowerCase()}</span>
      </label>
    </div>
  )
}
