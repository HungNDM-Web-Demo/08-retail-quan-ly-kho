'use client'

import { useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { varianceReasonLabels } from '@/config/inventory-labels'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StocktakeDto } from '@/types/inventory'
import { formatPercent1 } from '@/features/inventory/lib/uom'

const pct = (v?: number | null) => formatPercent1(v)

/**
 * Bảng duyệt kiểm kê (UC-11 bước 7, 07 §4.4): sổ sách, đếm, chênh lệch, %, giá trị, nguyên nhân; sắp theo
 * |giá trị chênh| giảm dần; chọn dòng để trả lại đếm lại.
 */
export function VarianceTable({
  doc,
  selectable,
  selected,
  onSelectedChange,
  onlyVariance,
}: {
  doc: StocktakeDto
  selectable?: boolean
  selected?: Set<string>
  onSelectedChange?: (ids: Set<string>) => void
  onlyVariance?: boolean
}) {
  const rows = useMemo(() => {
    const list = onlyVariance ? doc.lines.filter((l) => (l.difference ?? 0) !== 0) : doc.lines
    return [...list].sort(
      (a, b) =>
        Math.abs(b.differenceValue ?? 0) - Math.abs(a.differenceValue ?? 0) ||
        Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0) ||
        a.productCode.localeCompare(b.productCode)
    )
  }, [doc.lines, onlyVariance])
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected)
    if (on) next.add(id)
    else next.delete(id)
    onSelectedChange?.(next)
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-muted/60 text-muted-foreground text-xs">
          <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
            {selectable && <th className="w-10" aria-label="Chọn dòng" />}
            <th>Mặt hàng</th>
            <th className="!text-right">Sổ sách</th>
            <th className="!text-right">Đếm</th>
            <th className="!text-right">Chênh lệch</th>
            <th className="!text-right">%</th>
            {doc.canViewValues && <th className="!text-right">Giá trị chênh</th>}
            <th>Nguyên nhân</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const diff = l.difference ?? 0
            return (
              <tr key={l.id} className={cn('border-t align-top', l.reasonRequired && !l.reason && 'bg-warning/10', selected?.has(l.id) && 'bg-primary/5')}>
                {selectable && (
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={selected?.has(l.id) ?? false}
                      onCheckedChange={(c) => toggle(l.id, !!c)}
                      aria-label={`Chọn ${l.productName} để đếm lại`}
                    />
                  </td>
                )}
                <td className="px-3 py-2">
                  <p className="font-medium">{l.productName}</p>
                  <p className="text-muted-foreground text-xs">
                    {l.productCode} · {l.groupName}
                    {l.isAdded && ' · thêm khi đếm'}
                  </p>
                  {l.needsRecount && <p className="text-warning text-xs font-medium">Cần đếm lại</p>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(l.bookQuantity, 0)}</td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatNumber(l.countedQuantity, 0)}</td>
                <td className={cn('px-3 py-2.5 text-right font-medium tabular-nums', diff > 0 && 'text-success', diff < 0 && 'text-destructive')}>
                  {l.difference == null ? '—' : `${diff > 0 ? '+' : ''}${formatNumber(diff, 0)}`}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{pct(l.differencePercent)}</td>
                {doc.canViewValues && (
                  <td className={cn('px-3 py-2.5 text-right tabular-nums', (l.differenceValue ?? 0) > 0 && 'text-success', (l.differenceValue ?? 0) < 0 && 'text-destructive')}>
                    {l.differenceValue == null ? '—' : `${l.differenceValue > 0 ? '+' : ''}${formatVnd(l.differenceValue)}`}
                  </td>
                )}
                <td className="px-3 py-2.5">
                  {l.reason ? (
                    <span>
                      {varianceReasonLabels[l.reason]}
                      {l.reasonNote && <span className="text-muted-foreground block text-xs">{l.reasonNote}</span>}
                    </span>
                  ) : l.reasonRequired ? (
                    <span className="text-warning text-xs font-medium">Bắt buộc nguyên nhân</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        {doc.canViewValues && (
          <tfoot className="bg-muted/40 border-t">
            <tr className="[&>td]:px-3 [&>td]:py-2.5">
              <td colSpan={selectable ? 6 : 5} className="text-right font-medium">
                Tổng thừa <span className="text-success tabular-nums">+{formatVnd(doc.surplusValue)}</span> · Tổng thiếu{' '}
                <span className="text-destructive tabular-nums">−{formatVnd(doc.shortageValue)}</span>
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
