'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Bộ lọc lưu trên URL (07 §4.5: `?warehouseId=…`) để chia sẻ link, quay lại đúng chỗ.
 * `set({ key: value })`: value rỗng/undefined thì xóa tham số; thay URL không thêm lịch sử.
 */
export function useUrlParams() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const set = useCallback(
    (patch: Record<string, string | number | boolean | null | undefined>) => {
      const next = new URLSearchParams(params.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === null || value === '' || value === false) next.delete(key)
        else next.set(key, String(value))
      }
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [params, router, pathname]
  )

  return { params, get: (key: string) => params.get(key) ?? undefined, set }
}
