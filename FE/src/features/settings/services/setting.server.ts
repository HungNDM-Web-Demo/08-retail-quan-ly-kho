import { apiRoutes } from '@/config/api-routes'
import { serverFetch } from '@/lib/server-fetch'
import { seedPublicSettings } from '@/mock/system-seed'
import type { PublicSettings } from '../types/setting.types'

/**
 * Cài đặt công khai lấy phía máy chủ (metadata trang, trang công khai render sẵn).
 * Chế độ mock trả giá trị seed; chế độ api gọi BE, lỗi thì dùng giá trị seed.
 */
export function getPublicSettingsServer(): Promise<PublicSettings> {
  return serverFetch<PublicSettings>(apiRoutes.settings.public, {
    mock: seedPublicSettings,
    fallback: seedPublicSettings(),
    revalidate: 60,
  })
}
