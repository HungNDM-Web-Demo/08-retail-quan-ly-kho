'use client'

import { useEffect, useState } from 'react'
import { assetUrl, isIdbUrl } from '@/lib/asset-url'
import { mockBlobs } from '@/mock/mock-blobs'

/**
 * Như `assetUrl` (lib/asset-url.ts) nhưng đọc được cả ảnh `idb://{id}` trong IndexedDB
 * (ảnh tải lên ở chế độ mock). Trả null khi đang đọc hoặc không có ảnh.
 *
 *   const src = useAssetUrl(product.imageUrl)
 *   {src && <img src={src} alt={product.name} />}
 */
export function useAssetUrl(path: string | null | undefined): string | null {
  const isIdb = isIdbUrl(path)
  const [resolved, setResolved] = useState<{ key: string; url: string | null } | null>(null)

  useEffect(() => {
    if (!isIdb || !path) return
    let cancelled = false
    void mockBlobs.getObjectUrl(path).then((url) => {
      if (!cancelled) setResolved({ key: path, url })
    })
    return () => {
      cancelled = true
    }
  }, [path, isIdb])

  if (!path) return null
  if (!isIdb) return assetUrl(path)
  return resolved?.key === path ? resolved.url : null
}
