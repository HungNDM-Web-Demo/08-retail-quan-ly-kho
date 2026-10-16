import type { Metadata } from 'next'
import { Suspense } from 'react'
import { StocktakesPage } from '@/features/stocktakes/pages/StocktakesPage'

export const metadata: Metadata = { title: 'Kiểm kê' }

export default function Page() {
  return (
    <Suspense>
      <StocktakesPage />
    </Suspense>
  )
}
