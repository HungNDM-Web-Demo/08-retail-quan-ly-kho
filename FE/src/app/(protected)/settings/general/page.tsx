import type { Metadata } from 'next'
import { GeneralSettingsPage } from '@/features/settings/pages/GeneralSettingsPage'

export const metadata: Metadata = { title: 'Cài đặt chung' }

export default function Page() {
  return <GeneralSettingsPage />
}
