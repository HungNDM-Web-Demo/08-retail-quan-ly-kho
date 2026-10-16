import type { Metadata } from 'next'
import { Suspense } from 'react'
import { TransferDetailPage } from '@/features/transfers/pages/TransferDetailPage'

export const metadata: Metadata = { title: 'Chuyển kho' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense>
      <TransferDetailPage key={id} id={id} />
    </Suspense>
  )
}
