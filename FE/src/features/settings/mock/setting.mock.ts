import { permissions } from '@/config/permissions'
import { mockDelay } from '@/lib/data-source'
import { auditUpdate } from '@/mock/mock-audit'
import { requirePermission } from '@/mock/mock-auth'
import { mockBlobs, readImageSize } from '@/mock/mock-blobs'
import { validation } from '@/mock/mock-errors'
import { getSettingsMap, settingsDb, syncSeedEntries } from '@/mock/system-data'
import type {
  PublicSettings,
  SettingItem,
  UpdateSettingsRequest,
  UploadedImage,
} from '../types/setting.types'

const ENTITY = 'Setting'
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']

const isPublicKey = (key: string) => key.startsWith('Brand.') || key.startsWith('Company.')

export const settingMock = {
  /** GET /api/settings/public: công khai, chỉ Brand.* và Company.* */
  async getPublic(): Promise<PublicSettings> {
    await mockDelay(50, 150)
    syncSeedEntries()
    return Object.fromEntries(Object.entries(getSettingsMap()).filter(([key]) => isPublicKey(key)))
  },

  async getAll(): Promise<SettingItem[]> {
    await mockDelay()
    requirePermission(permissions.settings.view)
    return settingsDb.all().map(({ key, value, groupName }) => ({ key, value, groupName }))
  },

  async update(request: UpdateSettingsRequest): Promise<void> {
    await mockDelay()
    requirePermission(permissions.settings.update)
    const existing = settingsDb.all()
    const unknown = request.items.filter((item) => !existing.some((s) => s.key === item.key))
    if (unknown.length) {
      throw validation(
        Object.fromEntries(unknown.map((item) => [item.key, 'Khóa cài đặt không tồn tại'])),
        `Khóa cài đặt không tồn tại: ${unknown.map((i) => i.key).join(', ')}`
      )
    }
    for (const item of request.items) {
      const before = existing.find((s) => s.key === item.key)!
      const value = item.value ?? ''
      if (before.value === value) continue
      const after = settingsDb.update(before.id, { value })!
      auditUpdate(ENTITY, before, after)
    }
  },

  /** POST /api/uploads/images: JPG/PNG/WebP/SVG tối đa 2 MB, lưu vào IndexedDB. */
  async uploadImage(file: File): Promise<UploadedImage> {
    await mockDelay(300, 600)
    requirePermission(permissions.settings.update)
    if (!IMAGE_TYPES.includes(file.type)) {
      throw validation({ file: 'Chỉ nhận ảnh JPG, PNG, WebP hoặc SVG' })
    }
    if (file.size > MAX_IMAGE_BYTES) throw validation({ file: 'Ảnh tối đa 2 MB' })
    const [stored, size] = await Promise.all([mockBlobs.put(file, file.name), readImageSize(file)])
    return { url: stored.url, width: size.width, height: size.height, sizeBytes: file.size }
  },
}
