'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { varianceReasonLabels } from '@/config/inventory-labels'
import { formatNumber, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { VarianceReason } from '@/types/inventory'
import { formatPercent1 } from '@/features/inventory/lib/uom'

export type RequiredLine = {
  lineId: string
  productName: string
  difference: number
  differencePercent?: number | null
  differenceValue?: number | null
}

const REASONS = Object.keys(varianceReasonLabels) as VarianceReason[]

/**
 * Chọn nguyên nhân cho dòng chênh lệch lớn (UC-11 bước 5, BR-16): mỗi dòng bắt buộc một nguyên nhân, "Khác" cần
 * ghi chú; dòng chưa chọn tô đỏ; gửi lại cùng `version`, `clientRequestId` mới.
 */
export function ReasonsDialog({
  open,
  onOpenChange,
  lines,
  pending,
  onConfirm,
  noteErrors,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  lines: RequiredLine[]
  pending: boolean
  onConfirm: (reasons: { lineId: string; reason: VarianceReason; note?: string }[]) => void
  noteErrors?: Record<string, string>
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl">
        <ReasonsBody lines={lines} pending={pending} onCancel={() => onOpenChange(false)} onConfirm={onConfirm} noteErrors={noteErrors} />
      </DialogContent>
    </Dialog>
  )
}

function ReasonsBody({
  lines,
  pending,
  onCancel,
  onConfirm,
  noteErrors,
}: {
  lines: RequiredLine[]
  pending: boolean
  onCancel: () => void
  onConfirm: (reasons: { lineId: string; reason: VarianceReason; note?: string }[]) => void
  noteErrors?: Record<string, string>
}) {
  const [values, setValues] = useState<Record<string, { reason?: VarianceReason; note: string }>>({})
  const [tried, setTried] = useState(false)
  const missing = lines.filter((l) => !values[l.lineId]?.reason || (values[l.lineId]?.reason === 'Khac' && !values[l.lineId]?.note.trim()))
  const submit = () => {
    setTried(true)
    if (missing.length) return
    onConfirm(lines.map((l) => ({ lineId: l.lineId, reason: values[l.lineId].reason!, note: values[l.lineId].note.trim() || undefined })))
  }
  return (
    <>
        <DialogHeader>
          <DialogTitle>Chọn nguyên nhân cho {lines.length} dòng chênh lệch lớn</DialogTitle>
          <DialogDescription>Bắt buộc khi giá trị chênh từ 1.000.000 ₫ hoặc chênh từ 5% sổ sách.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-[55vh] space-y-3 overflow-y-auto">
          {lines.map((l, i) => {
            const v = values[l.lineId] ?? { note: '' }
            const bad = tried && (!v.reason || (v.reason === 'Khac' && !v.note.trim()))
            return (
              <li key={l.lineId} className={cn('space-y-2 rounded-lg border p-3', bad && 'border-destructive bg-destructive/5')}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{l.productName}</p>
                  <p className={cn('text-sm font-medium tabular-nums', l.difference > 0 ? 'text-success' : 'text-destructive')}>
                    {l.difference > 0 ? '+' : ''}
                    {formatNumber(l.difference, 0)}
                    {l.differencePercent != null && ` · ${formatPercent1(l.differencePercent)}`}
                    {l.differenceValue != null && ` · ${l.differenceValue > 0 ? '+' : ''}${formatVnd(l.differenceValue)}`}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[14rem_1fr]">
                  <Select
                    value={v.reason}
                    onValueChange={(r) => setValues((s) => ({ ...s, [l.lineId]: { ...v, reason: r as VarianceReason } }))}
                  >
                    <SelectTrigger className="h-11 w-full" aria-label={`Nguyên nhân ${l.productName}`} aria-invalid={bad || undefined}>
                      <SelectValue placeholder="Chọn nguyên nhân" />
                    </SelectTrigger>
                    <SelectContent>
                      {REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {varianceReasonLabels[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={v.note}
                    onChange={(e) => setValues((s) => ({ ...s, [l.lineId]: { ...v, note: e.target.value } }))}
                    placeholder={v.reason === 'Khac' ? 'Ghi chú (bắt buộc)' : 'Ghi chú'}
                    className="h-11"
                    maxLength={300}
                    aria-label={`Ghi chú ${l.productName}`}
                  />
                </div>
                {(noteErrors?.[`reasons.${i}.note`] || (bad && v.reason === 'Khac')) && (
                  <p className="text-destructive text-xs">Nhập ghi chú cho nguyên nhân Khác</p>
                )}
              </li>
            )
          })}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Để sau
          </Button>
          <Button onClick={submit} disabled={pending}>
            <Send aria-hidden="true" /> Gửi duyệt
          </Button>
        </DialogFooter>
    </>
  )
}
