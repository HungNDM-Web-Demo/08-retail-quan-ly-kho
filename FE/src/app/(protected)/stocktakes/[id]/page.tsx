import type { Metadata } from 'next'
import { Suspense } from 'react'
import { StocktakeDetailPage } from '@/features/stocktakes/pages/StocktakeDetailPage'

export const metadata: Metadata = { title: 'Kiểm kê' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense>
      <StocktakeDetailPage key={id} id={id} />
    </Suspense>
  )
}
