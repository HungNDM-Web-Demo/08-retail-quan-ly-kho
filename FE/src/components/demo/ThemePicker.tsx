'use client'

import { Check, Monitor, Moon, Pipette, RotateCcw, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useBrand } from '@/features/settings/hooks/use-settings'
import { BRAND_PRESETS, DEFAULT_BRAND_COLOR, normalizeHex } from '@/lib/brand-color'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui.store'

const THEMES = [
  { value: 'light', label: 'Sáng', icon: Sun },
  { value: 'dark', label: 'Tối', icon: Moon },
  { value: 'system', label: 'Hệ thống', icon: Monitor },
] as const

/**
 * Đổi sáng/tối và thử nhanh màu thương hiệu trước mặt khách (KIEN-TRUC-HE-THONG §8.3).
 * Màu thử chỉ lưu trên trình duyệt này; muốn lưu hẳn thì vào Cài đặt chung.
 */
export function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const brand = useBrand()
  const preview = useUiStore((s) => s.brandPreviewColor)
  const setPreview = useUiStore((s) => s.setBrandPreviewColor)
  const current = normalizeHex(preview ?? brand.primaryColor) ?? DEFAULT_BRAND_COLOR

  return (
    <div className="space-y-4">
      <ToggleGroup
        type="single"
        value={theme ?? 'light'}
        onValueChange={(value) => value && setTheme(value)}
        aria-label="Giao diện sáng tối"
        className="bg-muted grid w-full grid-cols-3 gap-1 rounded-lg p-1"
      >
        {THEMES.map(({ value, label, icon: Icon }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            className="data-[state=on]:bg-background data-[state=on]:text-foreground text-muted-foreground h-9 w-full gap-1.5 rounded-md data-[state=on]:shadow-sm"
          >
            <Icon aria-hidden="true" />
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Màu thương hiệu</p>
          {preview && (
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)} className="text-muted-foreground -mr-2">
              <RotateCcw aria-hidden="true" />
              Về màu đã lưu
            </Button>
          )}
        </div>
        <div className="grid grid-cols-6 gap-2" role="group" aria-label="Chọn màu thương hiệu">
          {BRAND_PRESETS.map((preset) => {
            const active = current === preset.value
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => setPreview(preset.value)}
                aria-label={`Màu ${preset.name}`}
                aria-pressed={active}
                title={preset.name}
                className={cn(
                  'focus-visible:ring-ring/60 relative flex aspect-square min-h-10 items-center justify-center rounded-full ring-offset-2 ring-offset-popover transition-transform duration-150 outline-none hover:scale-105 focus-visible:ring-3',
                  active && 'ring-foreground/70 ring-2'
                )}
                style={{ backgroundColor: preset.value }}
              >
                {active && <Check className="size-4 text-white drop-shadow" aria-hidden="true" />}
              </button>
            )
          })}
          <label
            className="border-input text-muted-foreground hover:text-foreground focus-within:ring-ring/60 relative flex aspect-square min-h-10 cursor-pointer items-center justify-center rounded-full border border-dashed transition-colors focus-within:ring-3"
            title="Chọn màu khác"
          >
            <Pipette className="size-4" aria-hidden="true" />
            <span className="sr-only">Chọn màu khác</span>
            <input
              type="color"
              value={current}
              onChange={(e) => setPreview(e.target.value.toUpperCase())}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
        <p className="text-muted-foreground text-xs">
          {preview ? `Đang thử màu ${current} trên trình duyệt này.` : 'Bấm một màu để xem thử ngay, không ảnh hưởng người khác.'}
        </p>
      </div>
    </div>
  )
}
