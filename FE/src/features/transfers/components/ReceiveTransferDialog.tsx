'use client'

import { useMemo, useState } from 'react'
import { PackageCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CatalogProduct, TransferDto } from '@/types/inventory'
import { CartonInput } from '@/features/inventory/components/CartonInput'
import { baseUnitWord, largestUnit } from '@/features/inventory/lib/uom'

/**
 * Xác nhận nhận hàng chuyển đến (UC-06 bước 4, 07 §4.3): số thực nhận mặc định bằng số chuyển, nhập theo thùng + lẻ,
 * cột thiếu tự tính; lỗi vượt số chuyển hiện tại dòng.
 */
export function ReceiveTransferDialog({
  open,
  onOpenChange,
  transfer,
  catalog,
  errors,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  transfer: TransferDto
  catalog: Map<string, CatalogProduct>
  errors: Record<string, string>
  pending: boolean
  onConfirm: (received: Record<string, number>) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-3xl">
        <ReceiveBody transfer={transfer} catalog={catalog} errors={errors} pending={pending} onCancel={() => onOpenChange(false)} onConfirm={onConfirm} />
      </DialogContent>
    </Dialog>
  )
}

function ReceiveBody({
  transfer,
  catalog,
  errors,
  pending,
  onCancel,
  onConfirm,
}: {
  transfer: TransferDto
  catalog: Map<string, CatalogProduct>
  errors: Record<string, string>
  pending: boolean
  onCancel: () => void
  onConfirm: (received: Record<string, number>) => void
}) {
  // Mặc định thực nhận = số chuyển; trạng thái đặt lại mỗi lần mở (DialogContent gỡ khi đóng)
  const [received, setReceived] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(transfer.lines.map((l) => [l.id, l.baseQuantity]))
  )
  // Dòng sửa sau lần gửi không còn hiện lỗi cũ của máy chủ (vẫn kiểm vượt số chuyển ngay tại chỗ)
  const [edited, setEdited] = useState<Set<string>>(() => new Set())

  const shortageTotal = useMemo(
    () => transfer.lines.reduce((s, l) => s + Math.max(0, l.baseQuantity - (received[l.id] ?? 0)) * (l.unitCost ?? 0), 0),
    [received, transfer.lines]
  )
  const missing = transfer.lines.some((l) => received[l.id] == null)

  return (
    <>
        <DialogHeader>
          <DialogTitle>Xác nhận nhận hàng {transfer.code}</DialogTitle>
          <DialogDescription>
            Từ {transfer.fromWarehouseCode} tới {transfer.toWarehouseCode}. Đếm thực tế rồi nhập số nhận; thiếu sẽ ghi hao hụt
            vận chuyển.
          </DialogDescription>
        </DialogHeader>
        {errors.lines && <p className="text-destructive text-sm">{errors.lines}</p>}
        <div className="max-h-[55vh] overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-muted-foreground sticky top-0 text-xs">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                <th>Mặt hàng</th>
                <th className="!text-right">Số chuyển</th>
                <th className="w-64">Thực nhận</th>
                <th className="!text-right">Thiếu</th>
              </tr>
            </thead>
            <tbody>
              {transfer.lines.map((l, i) => {
                const p = catalog.get(l.productId)
                const unit = largestUnit(p?.units ?? [])
                const got = received[l.id]
                const short = got == null ? 0 : l.baseQuantity - got
                const error = (edited.has(l.id) ? undefined : errors[`lines.${i}.receivedBaseQuantity`]) ?? (got != null && got > l.baseQuantity ? `Không vượt số lượng chuyển ${formatNumber(l.baseQuantity, 0)} ${baseUnitWord(l.baseUnit)}` : undefined)
                return (
                  <tr key={l.id} className={cn('border-t align-top', error && 'bg-destructive/5')}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{l.productName}</p>
                      <p className="text-muted-foreground text-xs">{l.productCode}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(l.baseQuantity, 0)} {baseUnitWord(l.baseUnit)}
                      <p className="text-muted-foreground text-xs">
                        {formatNumber(l.quantity, 0)} {l.unitName}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <CartonInput
                        value={got}
                        onChange={(v) => {
                          setReceived((r) => ({ ...r, [l.id]: v }))
                          setEdited((s) => new Set(s).add(l.id))
                        }}
                        baseUnit={l.baseUnit}
                        unit={unit}
                        invalid={!!error}
                        idPrefix={`recv-${i}`}
                      />
                      {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
                    </td>
                    <td className={cn('px-3 py-2 text-right tabular-nums', short > 0 && 'text-destructive font-medium')}>
                      {short > 0 ? `${formatNumber(short, 0)} ${baseUnitWord(l.baseUnit)}` : '—'}
                      {short > 0 && transfer.canViewValues && <p className="text-xs">{formatVnd(short * (l.unitCost ?? 0))}</p>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {transfer.canViewValues && shortageTotal > 0 && (
          <p className="text-destructive text-sm">Hao hụt vận chuyển: {formatVnd(shortageTotal)}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Hủy
          </Button>
          <Button
            disabled={pending || missing}
            onClick={() => {
              setEdited(new Set())
              onConfirm(Object.fromEntries(Object.entries(received).map(([k, v]) => [k, v ?? 0])))
            }}
          >
            <PackageCheck aria-hidden="true" /> Hoàn tất nhận
          </Button>
        </DialogFooter>
    </>
  )
}
