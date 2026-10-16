'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getErrorMessage, isApiError } from '@/lib/api-error'
import type { CountEntry, StocktakeDto } from '@/types/inventory'
import { newRequestId } from '@/features/inventory/hooks/use-doc-action'
import { useStocktakeMutations } from './use-stocktakes'

type Batch = { rid: string; entries: CountEntry[]; sending: boolean }

/**
 * Hàng đợi lượt đếm (07 §4.4): quét gửi `Cong` 1 đơn vị, nhập tay gửi `Dat`; gửi theo lô mỗi 1 giây hoặc khi rời ô,
 * mỗi lô một `clientRequestId`; mất mạng ngắn thì giữ lô và gửi lại cùng mã ở nhịp sau (máy chủ không cộng lần hai).
 * Số đếm hiển thị = số máy chủ + các lượt đang chờ (phản hồi tức thì trên tablet).
 */
export function useCountQueue(doc: StocktakeDto | undefined) {
  const { counts } = useStocktakeMutations()
  const mutate = counts.mutate
  const queue = useRef<CountEntry[]>([])
  const inflight = useRef<Batch | null>(null)
  const [pending, setPending] = useState<CountEntry[]>([])
  const [offline, setOffline] = useState(false)
  const docId = doc?.id

  const flush = useCallback(() => {
    if (!docId) return
    if (!inflight.current) {
      if (queue.current.length === 0) return
      inflight.current = { rid: newRequestId(), entries: queue.current, sending: false }
      queue.current = []
    }
    const batch = inflight.current
    if (batch.sending) return
    batch.sending = true
    mutate(
      { id: docId, input: { clientRequestId: batch.rid, entries: batch.entries } },
      {
        onSuccess: () => {
          inflight.current = null
          setOffline(false)
          setPending([...queue.current])
        },
        onError: (error) => {
          if (isApiError(error) && error.status === 0) {
            // Mất mạng: giữ lô và mã, nhịp sau gửi lại
            batch.sending = false
            setOffline(true)
            return
          }
          inflight.current = null
          setPending([...queue.current])
          toast.error(getErrorMessage(error))
        },
      }
    )
  }, [docId, mutate])

  useEffect(() => {
    const timer = window.setInterval(flush, 1000)
    return () => window.clearInterval(timer)
  }, [flush])

  const add = useCallback(
    (entry: CountEntry, immediate = false) => {
      queue.current = [...queue.current, entry]
      setPending([...(inflight.current?.entries ?? []), ...queue.current])
      if (immediate) flush()
    },
    [flush]
  )

  /** Số đếm hiển thị của một mặt hàng (đơn vị cơ bản) sau khi áp các lượt đang chờ */
  const displayCount = useCallback(
    (productId: string, server: number | null | undefined, factorOf: (unitId?: string | null) => number) => {
      let value = server ?? null
      for (const e of pending) {
        if (e.productId !== productId) continue
        const b = e.quantity * factorOf(e.unitId)
        value = e.mode === 'Cong' ? (value ?? 0) + b : b
      }
      return value
    },
    [pending]
  )

  return { add, flush, pendingCount: pending.length, offline, displayCount, busy: counts.isPending }
}
