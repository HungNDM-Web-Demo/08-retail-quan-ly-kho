'use client'

import { useEffect } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Lỗi không lường trước khi hiển thị trang. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="bg-background flex min-h-svh items-center justify-center px-4 py-12">
      <div role="alert" className="w-full max-w-md text-center">
        <div className="bg-warning/12 text-warning mx-auto flex size-16 items-center justify-center rounded-full">
          <TriangleAlert className="size-8" aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Đã có lỗi xảy ra</h1>
        <p className="text-muted-foreground mt-3 text-sm text-pretty">
          Trang gặp sự cố khi hiển thị. Bấm thử lại; nếu vẫn lỗi, tải lại trang hoặc đặt lại dữ liệu demo.
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <Button onClick={reset}>
            <RefreshCw aria-hidden="true" />
            Thử lại
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Tải lại trang
          </Button>
        </div>
      </div>
    </main>
  )
}
