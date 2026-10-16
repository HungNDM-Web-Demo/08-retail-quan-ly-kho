'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { matchesSearch } from '@/lib/normalize'
import type { CatalogProduct } from '@/types/inventory'
import { ProductThumb } from '../ProductThumb'

/**
 * Tìm mặt hàng theo mã, tên gõ không dấu, mã vạch (07 §4.3) trên catalog trong bộ nhớ; ↑↓ Enter để chọn.
 * Hàng ngừng sử dụng hiện mờ, không chọn được.
 */
export function ProductPicker({
  catalog,
  onPick,
  disabled,
  groupColors,
}: {
  catalog: CatalogProduct[]
  onPick: (product: CatalogProduct) => void
  disabled?: boolean
  groupColors?: Map<string, string>
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  useEffect(() => {
    if (disabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled])
  const results = useMemo(() => {
    if (!text.trim()) return catalog.slice(0, 30)
    return catalog
      .filter((p) =>
        matchesSearch(`${p.code} ${p.name} ${p.barcode ?? ''} ${p.units.map((u) => u.barcode ?? '').join(' ')}`, text)
      )
      .slice(0, 40)
  }, [catalog, text])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-12 w-full justify-start gap-2 px-3 font-normal sm:w-72" disabled={disabled}>
          <Search className="text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground truncate">Tìm theo tên, mã hàng…</span>
          <kbd className="bg-muted text-muted-foreground ml-auto hidden rounded px-1.5 text-[0.6875rem] lg:inline">F2</kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(32rem,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false}>
          <CommandInput value={text} onValueChange={setText} placeholder="Gõ không dấu: nuoc tang luc, NTL-330…" />
          <CommandList className="max-h-80">
            <CommandEmpty>Không có mặt hàng phù hợp</CommandEmpty>
            <CommandGroup>
              {results.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  disabled={!p.isActive}
                  onSelect={() => {
                    onPick(p)
                    setOpen(false)
                    setText('')
                  }}
                  className="gap-3 py-2"
                >
                  <ProductThumb name={p.name} imageUrl={p.imageUrl} groupColor={groupColors?.get(p.groupId)} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      {p.code} · {p.baseUnit}
                      {p.units.length > 0 && ` · ${p.units.map((u) => u.name).join(', ')}`}
                      {!p.isActive && ' · Ngừng sử dụng'}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
