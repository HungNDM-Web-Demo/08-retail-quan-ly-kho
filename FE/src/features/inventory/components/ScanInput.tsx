'use client'

import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { ScanBarcode } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type ScanInputHandle = { focus: () => void }

/**
 * Ô quét mã vạch: máy quét giả lập bàn phím gõ chuỗi số rồi Enter (SRS §2.4). Gọi `onScan(mã)`, xóa ô và giữ tiêu
 * điểm để quét tiếp (07 §4.3). Tra cứu do người gọi làm trên catalog trong bộ nhớ (NFR-02).
 */
export const ScanInput = forwardRef<
  ScanInputHandle,
  {
    onScan: (code: string) => void
    placeholder?: string
    autoFocus?: boolean
    disabled?: boolean
    className?: string
    label?: string
  }
>(function ScanInput(
  { onScan, placeholder = 'Quét mã vạch hoặc gõ mã hàng rồi Enter', autoFocus, disabled, className, label = 'Quét mã' },
  ref
) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), [])

  return (
    <div className={cn('relative', className)}>
      <ScanBarcode
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="done"
        className="h-12 pl-11 font-mono text-base tracking-wide"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          const code = value.trim()
          if (!code) return
          setValue('')
          onScan(code)
          inputRef.current?.focus()
        }}
      />
    </div>
  )
})
