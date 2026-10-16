import type { Metadata } from 'next'
import { Suspense } from 'react'
import { TransferPrintPage } from '@/features/transfers/pages/TransferPrintPage'

export const metadata: Metadata = { title: 'In phiếu chuyển kho' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense>
      <TransferPrintPage id={id} />
    </Suspense>
  )
}
