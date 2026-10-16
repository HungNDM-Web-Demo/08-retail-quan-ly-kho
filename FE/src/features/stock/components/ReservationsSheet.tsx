'use client'

import Link from 'next/link'
import { ArrowRight, Hourglass } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { docKindLabels } from '@/config/inventory-labels'
import { QuantityReading } from '@/features/inventory/components/QuantityReading'
import { docPath } from '@/features/inventory/lib/links'
import { formatDateTime } from '@/lib/format'
import type { UnitReading } from '@/types/inventory'
import { useReservations } from '../hooks/use-stock'

export type ReservationTarget = {
  productId: string
  productCode: string
  productName: string
  baseUnit: string
  units: UnitReading[]
  /** Kho có phần chờ xuất (một kho, hoặc từng kho khi xem "Tất cả kho") */
  warehouses: { id: string; code: string }[]
}

/** Ngăn kéo "Chờ xuất": phiếu xuất, phiếu chuyển Chờ duyệt đang giữ chỗ (UC-08 bước 4, TC-21, BR-03) */
export function ReservationsSheet({ target, onClose }: { target: ReservationTarget | null; onClose: () => void }) {
  return (
    <Sheet open={!!target} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>Chờ xuất</SheetTitle>
          <SheetDescription>
            {target ? `${target.productCode} · ${target.productName}` : ''}. Phiếu chờ duyệt đang giữ chỗ, chưa trừ tồn thực.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {target?.warehouses.map((w) => <WarehouseReservations key={w.id} warehouse={w} target={target} />)}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function WarehouseReservations({ warehouse, target }: { warehouse: { id: string; code: string }; target: ReservationTarget }) {
  const q = useReservations(warehouse.id, target.productId)
  return (
    <section className="space-y-2" aria-label={`Giữ chỗ tại ${warehouse.code}`}>
      {target.warehouses.length > 1 && <h3 className="text-sm font-semibold">Kho {warehouse.code}</h3>}
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-20 rounded-lg" />
      ) : q.data.length === 0 ? (
        <EmptyState compact icon={Hourglass} title="Không có phiếu nào đang giữ chỗ" />
      ) : (
        <ul className="divide-y rounded-lg border">
          {q.data.map((r) => (
            <li key={r.docId}>
              <Link
                href={docPath(r.kind, r.docId)}
                className="hover:bg-muted/50 focus-visible:ring-ring/50 flex items-center gap-3 px-3 py-3 outline-none focus-visible:ring-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                    <span className="font-mono">{r.docCode ?? 'Chưa có mã'}</span>
                    <span className="text-muted-foreground font-normal">
                      {docKindLabels[r.kind]}
                      {r.toWarehouseCode ? ` ${r.warehouseCode} → ${r.toWarehouseCode}` : ''}
                    </span>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {r.createdByName} · gửi {formatDateTime(r.submittedAt)}
                  </div>
                </div>
                <QuantityReading quantity={r.baseQuantity} baseUnit={target.baseUnit} units={target.units} className="text-right text-sm" />
                <ArrowRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
