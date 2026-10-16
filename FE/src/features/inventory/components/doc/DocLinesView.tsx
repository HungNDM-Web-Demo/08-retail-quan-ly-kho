'use client'

import { AlertTriangle } from 'lucide-react'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CatalogProduct, GoodsIssueLineDto, TransferLineDto } from '@/types/inventory'
import { baseUnitWord, readQuantity } from '../../lib/uom'
import { ProductThumb } from '../ProductThumb'

type Line = GoodsIssueLineDto & Partial<Pick<TransferLineDto, 'receivedBaseQuantity' | 'shortageQuantity' | 'shortageValue'>>

/**
 * Bảng xem dòng phiếu xuất, phiếu chuyển (đã gửi): số lượng kèm quy đổi; người duyệt thấy tồn hiện tại, thiếu, giá vốn
 * dự kiến (UC-05 bước 2); phiếu đã duyệt có giá vốn, giá trị (BR-25); phiếu chuyển đã nhận có thực nhận, thiếu.
 */
export function DocLinesView({
  lines,
  catalog,
  groupColors,
  canViewValues,
  received = false,
}: {
  lines: Line[]
  catalog?: Map<string, CatalogProduct>
  groupColors?: Map<string, string>
  canViewValues: boolean
  /** Phiếu chuyển đã nhận: cột thực nhận, thiếu */
  received?: boolean
}) {
  const preview = lines.some((l) => l.preview)
  const posted = lines.some((l) => l.unitCost != null)
  const totalValue = lines.reduce((s, l) => s + (l.value ?? 0), 0)
  const totalEstimate = lines.reduce((s, l) => s + (l.preview?.estimatedValue ?? 0), 0)
  const totalShortage = lines.reduce((s, l) => s + (l.shortageValue ?? 0), 0)
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-muted/60 text-muted-foreground text-xs">
          <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
            <th className="w-10">#</th>
            <th>Mặt hàng</th>
            <th className="w-32">Đơn vị</th>
            <th className="w-40 !text-right">Số lượng</th>
            {received && <th className="w-36 !text-right">Thực nhận</th>}
            {received && <th className="w-28 !text-right">Thiếu</th>}
            {preview && <th className="w-40 !text-right">Tồn hiện tại</th>}
            {canViewValues && (posted || preview) && (
              <th className="w-32 !text-right">{posted ? 'Giá vốn' : 'Giá vốn dự kiến'}</th>
            )}
            {canViewValues && (posted || preview) && <th className="w-36 !text-right">{posted ? 'Giá trị' : 'Giá trị dự kiến'}</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const p = catalog?.get(l.productId)
            const units = p?.units ?? []
            const unit = baseUnitWord(l.baseUnit)
            return (
              <tr key={l.id} className={cn('border-t align-top', l.preview && l.preview.shortage > 0 && 'bg-destructive/5')}>
                <td className="text-muted-foreground px-3 py-2.5 tabular-nums">{i + 1}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <ProductThumb name={l.productName} imageUrl={p?.imageUrl} groupColor={groupColors?.get(p?.groupId ?? '')} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.productName}</p>
                      <p className="text-muted-foreground text-xs">{l.productCode}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">{l.unitName}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <span className="font-medium">{formatNumber(l.quantity, 0)}</span>
                  {l.factor > 1 && (
                    <p className="text-muted-foreground text-xs">
                      = {formatNumber(l.baseQuantity, 0)} {unit}
                    </p>
                  )}
                </td>
                {received && (
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatNumber(l.receivedBaseQuantity, 0)} {unit}
                  </td>
                )}
                {received && (
                  <td className={cn('px-3 py-2.5 text-right tabular-nums', (l.shortageQuantity ?? 0) > 0 && 'text-destructive font-medium')}>
                    {(l.shortageQuantity ?? 0) > 0 ? `${formatNumber(l.shortageQuantity, 0)} ${unit}` : '—'}
                    {canViewValues && (l.shortageValue ?? 0) > 0 && <p className="text-xs">{formatVnd(l.shortageValue)}</p>}
                  </td>
                )}
                {preview && (
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {l.preview && (
                      <>
                        <span>
                          {formatNumber(l.preview.onHand, 0)} {unit}
                        </span>
                        {units.length > 0 && (
                          <p className="text-muted-foreground text-xs">{readQuantity(l.preview.onHand, l.baseUnit, units)}</p>
                        )}
                        {l.preview.shortage > 0 && (
                          <p className="text-destructive inline-flex items-center gap-1 text-xs font-medium">
                            <AlertTriangle className="size-3" aria-hidden="true" />
                            Thiếu {formatNumber(l.preview.shortage, 0)} {unit}
                          </p>
                        )}
                      </>
                    )}
                  </td>
                )}
                {canViewValues && (posted || preview) && (
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatVnd(posted ? l.unitCost : l.preview?.avgCost)}</td>
                )}
                {canViewValues && (posted || preview) && (
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                    {formatVnd(posted ? l.value : l.preview?.estimatedValue)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
        {canViewValues && (posted || preview || received) && (
          <tfoot className="bg-muted/40 border-t">
            <tr className="[&>td]:px-3 [&>td]:py-2.5">
              <td />
              <td className="font-medium">{lines.length} dòng</td>
              <td />
              <td />
              {received && <td />}
              {received && (
                <td className="text-destructive text-right text-xs tabular-nums">{totalShortage > 0 && formatVnd(totalShortage)}</td>
              )}
              {preview && <td />}
              {(posted || preview) && <td className="text-muted-foreground text-right">Cộng</td>}
              {(posted || preview) && (
                <td className="text-right font-semibold tabular-nums">{formatVnd(posted ? totalValue : totalEstimate)}</td>
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
