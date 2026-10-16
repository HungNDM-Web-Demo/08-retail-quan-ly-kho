'use client'

import { forwardRef, useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const parse = (text: string): number | null => {
  const digits = text.replace(/\D/g, '')
  return digits ? Number(digits) : null
}

type Props = Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: number | null | undefined
  onValueChange: (value: number | null) => void
  /** Hiện dấu chấm ngăn nghìn khi không gõ (tiền) */
  grouped?: boolean
  suffix?: string
}

/**
 * Ô số nguyên không âm: bàn phím số trên tablet (`inputMode="numeric"`), chọn hết khi vào ô, tiền có dấu chấm ngăn
 * nghìn. Giá trị rỗng = null.
 */
export const NumberInput = forwardRef<HTMLInputElement, Props>(function NumberInput(
  { value, onValueChange, grouped = false, suffix, className, onFocus, onBlur, ...props },
  ref
) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState(value == null ? '' : String(value))
  useEffect(() => {
    if (!focused) setText(value == null ? '' : String(value))
  }, [value, focused])
  const display = focused || !grouped ? text : value == null ? '' : formatNumber(value, 0)
  return (
    <div className="relative w-full">
      <Input
        ref={ref}
        {...props}
        inputMode="numeric"
        autoComplete="off"
        value={display}
        className={cn('text-right tabular-nums', suffix && 'pr-7', className)}
        onFocus={(e) => {
          setFocused(true)
          setText(value == null ? '' : String(value))
          requestAnimationFrame(() => e.target.select())
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '')
          setText(digits)
          onValueChange(parse(digits))
        }}
      />
      {suffix && (
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs">
          {suffix}
        </span>
      )}
    </div>
  )
})
