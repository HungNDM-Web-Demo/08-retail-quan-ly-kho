'use client'

import { Check, CircleAlert, CircleCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { BRAND_PRESETS, buildBrandPalette, normalizeHex } from '@/lib/brand-color'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

type ColorFieldProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  'aria-describedby'?: string
}

/** Chọn màu chủ đạo: bảng màu gợi ý, ô chọn màu, ô mã hex, báo độ tương phản chữ trên nút. */
export function ColorField({ id, value, onChange, disabled, invalid, ...props }: ColorFieldProps) {
  const hex = normalizeHex(value)
  const palette = buildBrandPalette(hex)
  const passes = palette.lightContrast >= 4.5

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Màu gợi ý">
        {BRAND_PRESETS.map((preset) => {
          const active = hex === preset.value
          return (
            <button
              key={preset.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(preset.value)}
              aria-label={`Màu ${preset.name}`}
              aria-pressed={active}
              title={`${preset.name} ${preset.value}`}
              className={cn(
                'focus-visible:ring-ring/60 ring-offset-card flex size-9 items-center justify-center rounded-full ring-offset-2 transition-transform duration-150 outline-none hover:scale-105 focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50',
                active && 'ring-foreground/70 ring-2'
              )}
              style={{ backgroundColor: preset.value }}
            >
              {active && <Check className="size-4 text-white drop-shadow" aria-hidden="true" />}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <label className="border-input relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-md border shadow-xs" title="Chọn màu bất kỳ">
          <span className="absolute inset-0" style={{ backgroundColor: hex ?? 'transparent' }} aria-hidden="true" />
          <span className="sr-only">Chọn màu bất kỳ</span>
          <input
            type="color"
            value={hex ?? '#2563EB'}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <Input
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          onBlur={() => hex && onChange(hex)}
          placeholder="#2563EB"
          maxLength={7}
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={props['aria-describedby']}
          className="w-32 font-mono uppercase"
        />
        {hex && (
          <span className={cn('flex items-center gap-1.5 text-xs', passes ? 'text-success' : 'text-warning')}>
            {passes ? <CircleCheck className="size-4" aria-hidden="true" /> : <CircleAlert className="size-4" aria-hidden="true" />}
            Chữ {palette.lightForeground === '#FFFFFF' ? 'trắng' : 'tối'} trên nút: {formatNumber(palette.lightContrast, 1)}:1
            {passes ? ' · đạt' : ' · thấp, nên chọn màu đậm hơn'}
          </span>
        )}
      </div>
    </div>
  )
}
