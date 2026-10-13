'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'

type SearchInputProps = {
  value?: string
  /** Gọi sau khi ngừng gõ `delay` ms */
  onSearch: (value: string) => void
  placeholder?: string
  delay?: number
  className?: string
  'aria-label'?: string
}

/** Ô tìm kiếm có icon, nút xóa nhanh, tự trì hoãn khi gõ. Tìm không phân biệt dấu ở phía dữ liệu. */
export function SearchInput({
  value = '',
  onSearch,
  placeholder = 'Tìm kiếm…',
  delay = 350,
  className,
  ...props
}: SearchInputProps) {
  const [text, setText] = useState(value)
  const debounced = useDebounce(text, delay)
  const onSearchRef = useRef(onSearch)

  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  useEffect(() => {
    onSearchRef.current(debounced.trim())
  }, [debounced])

  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={props['aria-label'] ?? placeholder}
        className="pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => setText('')}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md outline-none focus-visible:ring-3"
          aria-label="Xóa từ khóa"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
