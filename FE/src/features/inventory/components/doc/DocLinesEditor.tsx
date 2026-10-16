'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { PackageOpen, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AvailabilityRow, CatalogProduct } from '@/types/inventory'
import { useCatalogIndex } from '../../hooks/use-inventory'
import { receiptLineTotals } from '../../lib/costing'
import { inventoryRules } from '../../lib/rules'
import { scanBeep } from '../../lib/sound'
import { baseUnitWord, readQuantity } from '../../lib/uom'
import { ProductThumb } from '../ProductThumb'
import { ScanInput, type ScanInputHandle } from '../ScanInput'
import { NumberInput } from './NumberInput'
import { ProductPicker } from './ProductPicker'

export type DocLinesKind = 'receipt' | 'issue' | 'transfer'

/** Dòng đang soạn trên form phiếu */
export type DraftLine = {
  key: string
  productId: string
  /** null = đơn vị cơ bản */
  unitId: string | null
  quantity: number | null
  unitPrice: number | null
}

const BASE = '__base__'

let keySeq = 0
export const newLineKey = () => `l${Date.now().toString(36)}${(keySeq++).toString(36)}`

/**
 * Bảng nhập dòng phiếu nhập, xuất, chuyển (SCR-06, 08, 10; 07 §4.3): ô quét mã luôn ở trên, tự lấy lại tiêu điểm;
 * tìm tên không dấu (F2); Enter ở ô số lượng quay về ô quét. Phiếu nhập: đơn giá, thành tiền, chi phí phân bổ,
 * đơn giá nhập kho tính ngay (BR-08). Phiếu xuất, chuyển: cột khả dụng, dòng vượt tô đỏ (BR-04).
 */
export function DocLinesEditor({
  kind,
  lines,
  onChange,
  catalog,
  groupColors,
  availability,
  freightCost = 0,
  showPrices = false,
  errors = {},
  disabled,
  autoFocus,
}: {
  kind: DocLinesKind
  lines: DraftLine[]
  onChange: (lines: DraftLine[]) => void
  catalog: CatalogProduct[]
  groupColors?: Map<string, string>
  /** Khả dụng của kho (phiếu xuất, chuyển); undefined = chưa chọn kho */
  availability?: Map<string, AvailabilityRow>
  freightCost?: number
  showPrices?: boolean
  /** Lỗi theo ô đã chuẩn hóa: `lines.0.quantity` */
  errors?: Record<string, string>
  disabled?: boolean
  autoFocus?: boolean
}) {
  const index = useCatalogIndex(catalog)
  const scanRef = useRef<ScanInputHandle>(null)
  const qtyRefs = useRef(new Map<string, HTMLInputElement>())
  const [flashKey, setFlashKey] = useState<string | null>(null)

  useEffect(() => {
    if (!flashKey) return
    const t = window.setTimeout(() => setFlashKey(null), 900)
    return () => window.clearTimeout(t)
  }, [flashKey])

  const unitOf = (p: CatalogProduct | undefined, unitId: string | null) =>
    unitId ? p?.units.find((u) => u.id === unitId) : undefined
  const factorOf = (l: DraftLine) => unitOf(index.byId.get(l.productId), l.unitId)?.factor ?? 1

  const totals = useMemo(
    () =>
      kind === 'receipt'
        ? receiptLineTotals(
            lines.map((l) => ({ quantity: l.quantity ?? 0, unitPrice: l.unitPrice ?? 0, factor: factorOf(l) })),
            freightCost
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, lines, freightCost, index]
  )

  /** Σ số lượng quy đổi theo mặt hàng (kiểm vượt khả dụng theo tổng các dòng, §3.6) */
  const needByProduct = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of lines) map.set(l.productId, (map.get(l.productId) ?? 0) + (l.quantity ?? 0) * factorOf(l))
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, index])

  const addProduct = (product: CatalogProduct, unitId: string | null) => {
    if (!product.isActive) {
      scanBeep('error')
      toast.error(`${product.name} đã ngừng sử dụng`)
      return
    }
    const existing = lines.find((l) => l.productId === product.id && l.unitId === unitId)
    if (existing) {
      onChange(lines.map((l) => (l === existing ? { ...l, quantity: (l.quantity ?? 0) + 1 } : l)))
      setFlashKey(existing.key)
    } else {
      if (lines.length >= inventoryRules.maxLines) {
        scanBeep('error')
        toast.error('Phiếu tối đa 200 dòng, hãy tách phiếu')
        return
      }
      const key = newLineKey()
      onChange([...lines, { key, productId: product.id, unitId, quantity: 1, unitPrice: kind === 'receipt' ? 0 : null }])
      setFlashKey(key)
    }
    scanBeep('ok')
  }

  const onScan = (code: string) => {
    const hit = index.lookup(code)
    if (!hit) {
      scanBeep('error')
      toast.error(`Không tìm thấy mã ${code}`)
      return
    }
    addProduct(hit.product, hit.unitId ?? null)
  }

  const update = (key: string, patch: Partial<DraftLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const remove = (key: string) => {
    onChange(lines.filter((l) => l.key !== key))
    scanRef.current?.focus()
  }

  const isReceipt = kind === 'receipt'
  const showAvailability = kind !== 'receipt'

  return (
    <div className="space-y-3">
      {!disabled && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <ScanInput ref={scanRef} onScan={onScan} autoFocus={autoFocus} className="flex-1" />
          <ProductPicker
            catalog={catalog}
            groupColors={groupColors}
            onPick={(p) => {
              addProduct(p, null)
              scanRef.current?.focus()
            }}
          />
        </div>
      )}
      {errors.lines && (
        <p role="alert" className="text-destructive text-sm">
          {errors.lines}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/60 text-muted-foreground text-xs">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th className="w-10">#</th>
              <th>Mặt hàng</th>
              <th className="w-40">Đơn vị</th>
              <th className="w-36 !text-right">Số lượng</th>
              {isReceipt && showPrices && (
                <>
                  <th className="w-40 !text-right">Đơn giá</th>
                  <th className="w-36 !text-right">Thành tiền</th>
                  <th className="w-32 !text-right">Chi phí phân bổ</th>
                  <th className="w-32 !text-right">Đơn giá nhập kho</th>
                </>
              )}
              {showAvailability && <th className="w-44 !text-right">Khả dụng</th>}
              {!disabled && <th className="w-12" aria-label="Xóa dòng" />}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10">
                  <div className="text-muted-foreground flex flex-col items-center gap-2 text-center">
                    <PackageOpen className="size-8" aria-hidden="true" />
                    <p>Chưa có dòng nào. Quét mã vạch hoặc bấm “Tìm theo tên” (F2) để thêm hàng.</p>
                  </div>
                </td>
              </tr>
            )}
            {lines.map((line, i) => {
              const p = index.byId.get(line.productId)
              const unit = unitOf(p, line.unitId)
              const factor = unit?.factor ?? 1
              const base = (line.quantity ?? 0) * factor
              const av = availability?.get(line.productId)
              const available = av?.available ?? 0
              const need = needByProduct.get(line.productId) ?? 0
              const excess = showAvailability && availability ? need - available : 0
              const qtyError = errors[`lines.${i}.quantity`]
              const productError = errors[`lines.${i}.productId`] ?? errors[`lines.${i}.unitId`]
              const priceError = errors[`lines.${i}.unitPrice`]
              const t = totals?.lines[i]
              const units = p?.units ?? []
              return (
                <tr
                  key={line.key}
                  className={cn(
                    'border-t align-top transition-colors duration-500',
                    flashKey === line.key && 'bg-primary/8',
                    (excess > 0 || qtyError) && 'bg-destructive/5'
                  )}
                >
                  <td className="text-muted-foreground px-3 py-2.5 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <ProductThumb name={p?.name ?? ''} imageUrl={p?.imageUrl} groupColor={groupColors?.get(p?.groupId ?? '')} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p?.name ?? 'Mặt hàng không còn trong danh mục'}</p>
                        <p className="text-muted-foreground text-xs">{p?.code}</p>
                        {productError && <p className="text-destructive text-xs">{productError}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {disabled || units.length === 0 ? (
                      <span className="inline-block py-2">{unit?.name ?? p?.baseUnit}</span>
                    ) : (
                      <Select
                        value={line.unitId ?? BASE}
                        onValueChange={(v) => update(line.key, { unitId: v === BASE ? null : v })}
                      >
                        <SelectTrigger className="h-10 w-full" aria-label={`Đơn vị dòng ${i + 1}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={BASE}>{p?.baseUnit}</SelectItem>
                          {units.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} <span className="text-muted-foreground">= {u.factor} {baseUnitWord(p?.baseUnit ?? '')}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {disabled ? (
                      <span className="inline-block py-2 font-medium tabular-nums">{formatNumber(line.quantity, 0)}</span>
                    ) : (
                      <NumberInput
                        ref={(el) => {
                          if (el) qtyRefs.current.set(line.key, el)
                          else qtyRefs.current.delete(line.key)
                        }}
                        value={line.quantity}
                        onValueChange={(v) => update(line.key, { quantity: v })}
                        aria-label={`Số lượng dòng ${i + 1}`}
                        aria-invalid={!!qtyError || excess > 0 || undefined}
                        className="h-10"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            scanRef.current?.focus()
                          }
                        }}
                      />
                    )}
                    {factor > 1 && base > 0 && (
                      <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                        = {formatNumber(base, 0)} {baseUnitWord(p?.baseUnit ?? '')}
                      </p>
                    )}
                    {qtyError && <p className="text-destructive mt-1 text-xs">{qtyError}</p>}
                  </td>
                  {isReceipt && showPrices && (
                    <>
                      <td className="px-3 py-2">
                        {disabled ? (
                          <span className="block py-2 text-right tabular-nums">{formatVnd(line.unitPrice)}</span>
                        ) : (
                          <NumberInput
                            grouped
                            suffix="₫"
                            value={line.unitPrice}
                            onValueChange={(v) => update(line.key, { unitPrice: v })}
                            aria-label={`Đơn giá dòng ${i + 1}`}
                            aria-invalid={!!priceError || undefined}
                            className="h-10"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                scanRef.current?.focus()
                              }
                            }}
                          />
                        )}
                        {priceError && <p className="text-destructive mt-1 text-xs">{priceError}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatVnd(t?.amount)}</td>
                      <td className="text-muted-foreground px-3 py-2.5 text-right tabular-nums">{formatVnd(t?.allocatedCost)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatVnd(t?.landedUnitPrice)}</td>
                    </>
                  )}
                  {showAvailability && (
                    <td className="px-3 py-2.5 text-right">
                      {!availability ? (
                        <span className="text-muted-foreground text-xs">Chọn kho</span>
                      ) : (
                        <div className="tabular-nums">
                          <span className={cn('font-medium', excess > 0 && 'text-destructive')}>
                            {formatNumber(available, 0)} {baseUnitWord(p?.baseUnit ?? '')}
                          </span>
                          {units.length > 0 && available > 0 && (
                            <p className="text-muted-foreground text-xs">
                              {readQuantity(available, p?.baseUnit ?? '', units)}
                            </p>
                          )}
                          {excess > 0 && (
                            <p className="text-destructive text-xs font-medium">
                              Vượt {formatNumber(excess, 0)} {baseUnitWord(p?.baseUnit ?? '')}
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                  {!disabled && (
                    <td className="px-1 py-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(line.key)}
                        aria-label={`Xóa dòng ${i + 1}: ${p?.name ?? ''}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
          {lines.length > 0 && (
            <tfoot className="bg-muted/40 border-t text-sm">
              <tr className="[&>td]:px-3 [&>td]:py-2.5">
                <td />
                <td className="font-medium">{lines.length} dòng</td>
                <td />
                <td />
                {isReceipt && showPrices && totals && (
                  <>
                    <td className="text-muted-foreground text-right">Cộng</td>
                    <td className="text-right font-semibold tabular-nums">{formatVnd(totals.totalAmount)}</td>
                    <td className="text-muted-foreground text-right tabular-nums">{formatVnd(freightCost)}</td>
                    <td className="text-right text-xs">
                      Giá trị nhập kho
                      <span className="block text-sm font-semibold tabular-nums">{formatVnd(totals.totalValue)}</span>
                    </td>
                  </>
                )}
                {showAvailability && <td />}
                {!disabled && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
