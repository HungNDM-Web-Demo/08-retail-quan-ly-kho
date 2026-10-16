'use client'

import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, CloudOff, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { formatNumber, formatRelativeTime } from '@/lib/format'
import { normalizeVi } from '@/lib/normalize'
import { cn } from '@/lib/utils'
import type { CatalogProduct, StocktakeDto, StocktakeLineDto } from '@/types/inventory'
import { CartonInput } from '@/features/inventory/components/CartonInput'
import { ScanInput, type ScanInputHandle } from '@/features/inventory/components/ScanInput'
import { omitKey } from '@/features/inventory/lib/omit'
import { scanBeep } from '@/features/inventory/lib/sound'
import { baseUnitWord, largestUnit, readQuantity } from '@/features/inventory/lib/uom'
import type { useCountQueue } from '../hooks/use-count-queue'

type Filter = 'all' | 'uncounted' | 'recount' | 'counted'

/**
 * Màn đếm kiểm kê (SCR-15, UC-11 bước 3–4; tablet trước): ô quét luôn trên cùng, gom theo nhóm, mỗi dòng ô
 * "thùng + lẻ", số đã đếm, người đếm cuối. Kiểm kê mù: người không có quyền duyệt không thấy sổ sách, chênh lệch
 * (BR-15). Dòng cần đếm lại tô vàng kèm ghi chú.
 */
export function CountingView({
  doc,
  catalog,
  lookup,
  queue,
  highlightIds,
  filter,
  onFilterChange,
}: {
  doc: StocktakeDto
  catalog: Map<string, CatalogProduct>
  lookup: (code: string) => { product: CatalogProduct; unitId?: string } | null
  queue: ReturnType<typeof useCountQueue>
  highlightIds: Set<string>
  filter: Filter
  onFilterChange: (f: Filter) => void
}) {
  const scanRef = useRef<ScanInputHandle>(null)
  const [search, setSearch] = useState('')
  const [drafts, setDrafts] = useState<Record<string, number | null>>({})
  const [lastScanned, setLastScanned] = useState<string | null>(null)

  const factorOf = (productId: string) => (unitId?: string | null) =>
    unitId ? (catalog.get(productId)?.units.find((u) => u.id === unitId)?.factor ?? 1) : 1

  const counted = (l: StocktakeLineDto) => queue.displayCount(l.productId, l.countedQuantity, factorOf(l.productId))
  const countedLines = doc.lines.filter((l) => counted(l) != null).length

  const inScope = (p: CatalogProduct) =>
    doc.scopeAll || doc.groups.some((g) => g.id === p.groupId) || doc.lines.some((l) => l.productId === p.id)

  const onScan = (code: string) => {
    const hit = lookup(code)
    if (!hit) {
      scanBeep('error')
      toast.error(`Không tìm thấy mã ${code}`)
      return
    }
    if (!inScope(hit.product)) {
      scanBeep('error')
      toast.error(`${hit.product.name} không thuộc phạm vi phiếu kiểm kê`)
      return
    }
    const known = doc.lines.some((l) => l.productId === hit.product.id)
    queue.add({ productId: hit.product.id, unitId: hit.unitId ?? null, quantity: 1, mode: 'Cong' }, !known)
    setDrafts((d) => omitKey(d, hit.product.id))
    setLastScanned(hit.product.id)
    scanBeep('ok')
    if (!known) toast.info(`Thêm ${hit.product.name} ngoài danh sách`)
  }

  const commit = (l: StocktakeLineDto) => {
    if (!(l.productId in drafts)) return
    const value = drafts[l.productId]
    setDrafts((d) => omitKey(d, l.productId))
    if (value == null || value === counted(l)) return
    queue.add({ productId: l.productId, unitId: null, quantity: value, mode: 'Dat' }, true)
  }

  const groups = useMemo(() => {
    const q = normalizeVi(search)
    const list = doc.lines.filter((l) => {
      const c = counted(l)
      if (filter === 'uncounted' && c != null) return false
      if (filter === 'counted' && c == null) return false
      if (filter === 'recount' && !l.needsRecount) return false
      if (q && !normalizeVi(`${l.productCode} ${l.productName} ${l.barcode ?? ''}`).includes(q)) return false
      return true
    })
    const map = new Map<string, { name: string; lines: StocktakeLineDto[] }>()
    for (const l of list) {
      const g = map.get(l.groupId) ?? { name: l.groupName, lines: [] }
      g.lines.push(l)
      map.set(l.groupId, g)
    }
    return [...map.values()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.lines, filter, search, queue.displayCount])

  const recountCount = doc.lines.filter((l) => l.needsRecount).length
  const filters: { value: Filter; label: string; count: number }[] = [
    { value: 'all', label: 'Tất cả', count: doc.lines.length },
    { value: 'uncounted', label: 'Chưa đếm', count: doc.lines.length - countedLines },
    { value: 'counted', label: 'Đã đếm', count: countedLines },
    ...(recountCount ? [{ value: 'recount' as Filter, label: 'Cần đếm lại', count: recountCount }] : []),
  ]

  return (
    <div className="space-y-4">
      <div className="bg-background/95 sticky top-14 z-10 -mx-1 space-y-3 px-1 py-2 backdrop-blur">
        <ScanInput ref={scanRef} onScan={onScan} autoFocus placeholder="Quét mã vạch (mỗi lần quét cộng 1 đơn vị của mã)" />
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-48 flex-1">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium tabular-nums">
                Đã đếm {formatNumber(countedLines, 0)}/{formatNumber(doc.lines.length, 0)} dòng
              </span>
              <span className="text-muted-foreground inline-flex items-center gap-1">
                {queue.offline ? (
                  <>
                    <CloudOff className="text-warning size-3.5" aria-hidden="true" /> Mất kết nối, sẽ gửi lại
                  </>
                ) : queue.pendingCount > 0 || queue.busy ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Đang lưu số đếm…
                  </>
                ) : (
                  'Đã lưu'
                )}
              </span>
            </div>
            <Progress value={doc.lines.length ? (countedLines * 100) / doc.lines.length : 0} className="h-2" aria-label="Tiến độ đếm" />
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Lọc theo tên, mã" className="h-11 pl-9" aria-label="Lọc dòng" />
          </div>
        </div>
        <div role="tablist" aria-label="Lọc dòng đếm" className="flex gap-1 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => onFilterChange(f.value)}
              className={cn(
                'focus-visible:ring-ring/50 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3',
                filter === f.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {f.label} <span className="tabular-nums">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {doc.returnNote && recountCount > 0 && (
        <div className="bg-warning/10 text-warning flex gap-2 rounded-lg p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Quản lý trả lại {recountCount} dòng: <span className="font-medium">“{doc.returnNote}”</span>
          </span>
        </div>
      )}

      {groups.length === 0 && <p className="text-muted-foreground py-10 text-center text-sm">Không có dòng phù hợp bộ lọc.</p>}

      {groups.map((g) => (
        <section key={g.name} className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {g.name} · {g.lines.length}
          </h3>
          <ul className="bg-card divide-y rounded-xl border">
            {g.lines.map((l) => {
              const p = catalog.get(l.productId)
              const units = p?.units ?? l.units
              const c = counted(l)
              const value = l.productId in drafts ? drafts[l.productId] : c
              const highlight = highlightIds.has(l.id)
              return (
                <li
                  key={l.id}
                  className={cn(
                    'grid gap-3 p-3 transition-colors sm:grid-cols-[minmax(0,1fr)_17rem] sm:items-center',
                    l.needsRecount && 'bg-warning/10',
                    highlight && 'bg-destructive/5 ring-destructive/40 ring-1 ring-inset',
                    lastScanned === l.productId && 'bg-primary/8'
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {l.productName}
                      {l.isAdded && <span className="text-info ml-2 text-xs font-normal">Thêm khi đếm</span>}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {l.productCode}
                      {l.barcode && ` · ${l.barcode}`}
                    </p>
                    <p className="mt-1 text-sm tabular-nums">
                      {c == null ? (
                        <span className="text-muted-foreground">Chưa đếm</span>
                      ) : (
                        <>
                          Đã đếm <span className="font-semibold">{formatNumber(c, 0)} {baseUnitWord(l.baseUnit)}</span>
                          {units.length > 0 && <span className="text-muted-foreground"> · {readQuantity(c, l.baseUnit, units)}</span>}
                        </>
                      )}
                      {!doc.isBlind && l.bookQuantity != null && (
                        <span className="text-muted-foreground">
                          {' '}
                          · sổ sách {formatNumber(l.bookQuantity, 0)}
                          {l.difference != null && l.difference !== 0 && (
                            <span className={cn('font-medium', l.difference > 0 ? 'text-success' : 'text-destructive')}>
                              {' '}
                              ({l.difference > 0 ? '+' : ''}
                              {formatNumber(l.difference, 0)})
                            </span>
                          )}
                        </span>
                      )}
                    </p>
                    {l.lastCountedByName && (
                      <p className="text-muted-foreground text-xs">
                        {l.lastCountedByName} · {formatRelativeTime(l.lastCountedAt)}
                      </p>
                    )}
                    {l.needsRecount && l.recountNote && <p className="text-warning text-xs font-medium">Đếm lại: {l.recountNote}</p>}
                  </div>
                  <CartonInput
                    value={value}
                    onChange={(v) => setDrafts((d) => ({ ...d, [l.productId]: v }))}
                    onCommit={() => commit(l)}
                    baseUnit={l.baseUnit}
                    unit={largestUnit(units)}
                    idPrefix={`count-${l.id}`}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
