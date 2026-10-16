'use client'

import { useState } from 'react'
import { AlertCircle, CalendarRange } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  RANGE_PRESETS,
  displayDateKey,
  presetRange,
  rangeDays,
  rangeError,
  type DateRange,
  type RangePreset,
} from '../lib/date-range'

/**
 * Bộ chọn khoảng ngày dùng chung cho thẻ kho và các tab báo cáo (07 §4.5, §4.6; UC-09 1a, UC-13).
 * Khoảng sai (kết thúc trước bắt đầu, quá 366 ngày) báo lỗi và không đổi `value`, nên không gọi API (UC-09 E2, UC-13 E1).
 */
export function DateRangeFilter({
  preset,
  value,
  onChange,
}: {
  preset: RangePreset
  value: DateRange
  onChange: (preset: RangePreset, range: DateRange) => void
}) {
  const [custom, setCustom] = useState<DateRange>(value)
  const [customMode, setCustomMode] = useState(preset === 'custom')
  const error = customMode ? rangeError(custom.from, custom.to) : null
  const days = rangeDays(value.from, value.to) ?? 0

  const choose = (next: RangePreset) => {
    if (next === 'custom') {
      setCustomMode(true)
      setCustom(value)
      return
    }
    setCustomMode(false)
    const range = presetRange(next)
    onChange(next, range)
  }

  const apply = () => {
    if (!rangeError(custom.from, custom.to)) onChange('custom', custom)
  }

  const active: RangePreset = customMode ? 'custom' : preset

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-3 shadow-xs lg:flex-row lg:items-center">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Khoảng ngày">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={active === p.value}
            onClick={() => choose(p.value)}
            className={cn(
              'focus-visible:ring-ring/50 h-11 rounded-lg border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3',
              active === p.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {customMode ? (
        <div className="flex flex-col gap-1 lg:ml-auto">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && apply()}
              aria-label="Từ ngày"
              aria-invalid={!!error || undefined}
              className="h-11 w-40"
            />
            <span className="text-muted-foreground" aria-hidden="true">
              →
            </span>
            <Input
              type="date"
              value={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && apply()}
              aria-label="Đến ngày"
              aria-invalid={!!error || undefined}
              className="h-11 w-40"
            />
            <Button size="lg" onClick={apply} disabled={!!error}>
              Xem
            </Button>
          </div>
          {error && (
            <p className="text-destructive flex items-center gap-1 text-[0.8125rem]" role="alert">
              <AlertCircle className="size-3.5" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      ) : null}
      <p
        className={cn(
          'text-muted-foreground flex items-center gap-1.5 text-sm',
          !customMode && 'lg:ml-auto'
        )}
      >
        <CalendarRange className="size-4" aria-hidden="true" />
        Đang xem {displayDateKey(value.from)} → {displayDateKey(value.to)} ({days} ngày)
      </p>
    </div>
  )
}
