/** DTO cài đặt, khớp QUY-UOC-API §4.5. */

/** GET /api/settings/public → chỉ khóa nhóm Brand.* và Company.* */
export type PublicSettings = Record<string, string>

/** GET /api/settings */
export type SettingItem = { key: string; value: string; groupName: string }

/** PUT /api/settings → 204 */
export type UpdateSettingsRequest = { items: { key: string; value: string }[] }

/** POST /api/uploads/images (multipart, field "file") */
export type UploadedImage = { url: string; width: number; height: number; sizeBytes: number }

/** Khóa cài đặt nền (QUY-UOC-API §4.5). Dự án thêm khóa riêng vào project.json → settings. */
export const settingKeys = {
  appName: 'Brand.AppName',
  logoUrl: 'Brand.LogoUrl',
  primaryColor: 'Brand.PrimaryColor',
  companyName: 'Company.Name',
  companyHotline: 'Company.Hotline',
  companyZalo: 'Company.Zalo',
  companyEmail: 'Company.Email',
  companyAddress: 'Company.Address',
  companyWebsite: 'Company.Website',
} as const
