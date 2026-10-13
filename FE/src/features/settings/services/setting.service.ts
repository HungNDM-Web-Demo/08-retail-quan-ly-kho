import { apiRoutes } from '@/config/api-routes'
import { apiCall } from '@/lib/axios'
import { isMockMode } from '@/lib/data-source'
import { settingMock } from '../mock/setting.mock'
import type {
  PublicSettings,
  SettingItem,
  UpdateSettingsRequest,
  UploadedImage,
} from '../types/setting.types'

export const settingService = {
  getPublic: (): Promise<PublicSettings> =>
    isMockMode() ? settingMock.getPublic() : apiCall.get<PublicSettings>(apiRoutes.settings.public),

  getAll: (): Promise<SettingItem[]> =>
    isMockMode() ? settingMock.getAll() : apiCall.get<SettingItem[]>(apiRoutes.settings.list),

  update: (request: UpdateSettingsRequest): Promise<void> =>
    isMockMode() ? settingMock.update(request) : apiCall.put(apiRoutes.settings.list, request),

  uploadImage: (file: File): Promise<UploadedImage> => {
    if (isMockMode()) return settingMock.uploadImage(file)
    const form = new FormData()
    form.append('file', file)
    // Ghi đè Content-Type JSON mặc định của lib/axios.ts (nếu không axios đổi FormData thành JSON);
    // trình duyệt tự thêm boundary cho multipart
    return apiCall.post<UploadedImage>(apiRoutes.uploads.images, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
