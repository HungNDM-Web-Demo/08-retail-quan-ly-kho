import type { Metadata } from 'next'
import Link from 'next/link'
import { Compass, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Không tìm thấy trang' }

export default function NotFound() {
  return (
    <main className="bg-background flex min-h-svh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="relative mx-auto w-fit">
          <p className="text-primary/15 text-[7rem] leading-none font-bold tracking-tighter select-none sm:text-[9rem]" aria-hidden="true">
            404
          </p>
          <span className="bg-primary text-primary-foreground absolute inset-0 m-auto flex size-16 items-center justify-center rounded-2xl shadow-lg">
            <Compass className="size-8" aria-hidden="true" />
          </span>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Không tìm thấy trang</h1>
        <p className="text-muted-foreground mt-3 text-sm text-pretty">
          Đường dẫn có thể đã thay đổi hoặc trang không còn tồn tại. Kiểm tra lại địa chỉ hoặc quay về trang chủ.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg">
            <Link href="/">
              <Home aria-hidden="true" />
              Về trang chủ
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
