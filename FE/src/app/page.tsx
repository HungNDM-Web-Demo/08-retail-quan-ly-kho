import { RootRedirect } from '@/features/auth/components/RootRedirect'

/** Dự án có trang công khai (landing, menu QR…) thì thay nội dung trang này. */
export default function HomePage() {
  return <RootRedirect />
}
