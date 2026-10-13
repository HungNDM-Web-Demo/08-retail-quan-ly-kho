import { Skeleton } from '@/components/ui/skeleton'

/** Khung xương toàn trang khi đang kiểm tra phiên đăng nhập. */
export function AppShellSkeleton() {
  return (
    <div className="bg-background flex min-h-svh w-full" aria-busy="true" aria-label="Đang tải">
      <div className="bg-sidebar hidden w-[16.5rem] shrink-0 flex-col gap-6 border-r p-4 md:flex">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex h-16 items-center justify-between border-b px-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="size-9 rounded-full" />
        </div>
        <div className="space-y-6 p-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
