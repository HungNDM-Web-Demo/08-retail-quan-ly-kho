'use client'

import { useEffect } from 'react'
import { BRAND_VARS_STORAGE_KEY, brandCssVariables } from '@/lib/brand-color'
import { writeJson } from '@/lib/storage'
import { useUiStore } from '@/stores/ui.store'
import { useBrand } from '../hooks/use-settings'

/**
 * Gán màu thương hiệu lúc chạy: Brand.PrimaryColor (hoặc màu đang thử trên thanh công cụ demo)
 * → biến CSS --brand* trên <html>, theme.css dùng làm --primary cho cả sáng và tối.
 */
export function BrandThemeSync() {
  const { primaryColor, isLoading } = useBrand()
  const preview = useUiStore((s) => s.brandPreviewColor)
  const color = preview ?? primaryColor

  useEffect(() => {
    if (isLoading && !preview) return
    const vars = brandCssVariables(color)
    const root = document.documentElement
    Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value))
    writeJson('local', BRAND_VARS_STORAGE_KEY, vars)
  }, [color, isLoading, preview])

  return null
}
