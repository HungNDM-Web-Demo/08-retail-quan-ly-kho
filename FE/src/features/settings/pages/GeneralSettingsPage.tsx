'use client'

import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Eye, Info, Loader2, Palette, Save, Settings2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { permissions } from '@/config/permissions'
import { settingExtraLabels } from '@/config/setting-labels'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { BrandPreview } from '../components/BrandPreview'
import { ColorField } from '../components/ColorField'
import { LogoUploader } from '../components/LogoUploader'
import { useSettings, useUpdateSettings } from '../hooks/use-settings'
import { settingsFormSchema, type SettingsFormValues } from '../schemas/setting.schema'
import { settingKeys, type SettingItem } from '../types/setting.types'

/** Trường form ↔ khóa cài đặt (khóa có dấu chấm nên không dùng trực tiếp làm tên trường) */
const FIELD_KEYS = {
  appName: settingKeys.appName,
  logoUrl: settingKeys.logoUrl,
  primaryColor: settingKeys.primaryColor,
  companyName: settingKeys.companyName,
  companyHotline: settingKeys.companyHotline,
  companyZalo: settingKeys.companyZalo,
  companyEmail: settingKeys.companyEmail,
  companyAddress: settingKeys.companyAddress,
  companyWebsite: settingKeys.companyWebsite,
} as const
type KnownField = keyof typeof FIELD_KEYS
const KNOWN_KEYS: string[] = Object.values(FIELD_KEYS)

function toFormValues(items: SettingItem[]): SettingsFormValues {
  const get = (key: string) => items.find((i) => i.key === key)?.value ?? ''
  const known = Object.fromEntries(
    (Object.keys(FIELD_KEYS) as KnownField[]).map((field) => [field, get(FIELD_KEYS[field])])
  ) as Record<KnownField, string>
  return {
    ...known,
    extras: items
      .filter((i) => !KNOWN_KEYS.includes(i.key))
      .map(({ key, groupName, value }) => ({ key, groupName, value })),
  }
}

/** SCR-SYS-05: cài đặt chung, thương hiệu (UC-SYS-07, TC-SYS-08). */
export function GeneralSettingsPage() {
  const { can } = usePermissions()
  const canUpdate = can(permissions.settings.update)
  const settings = useSettings()
  const updateSettings = useUpdateSettings()

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: toFormValues([]),
  })
  const { errors, isDirty } = form.formState
  const [appName, logoUrl, primaryColor, extras] = useWatch({
    control: form.control,
    name: ['appName', 'logoUrl', 'primaryColor', 'extras'],
  })

  useEffect(() => {
    if (settings.data) form.reset(toFormValues(settings.data))
  }, [settings.data, form])

  const extraGroups = useMemo(() => {
    const groups = new Map<string, number[]>()
    ;(extras ?? []).forEach((item, index) => {
      groups.set(item.groupName, [...(groups.get(item.groupName) ?? []), index])
    })
    return [...groups.entries()]
  }, [extras])

  const onSubmit = form.handleSubmit((values) => {
    const items = [
      ...(Object.keys(FIELD_KEYS) as KnownField[]).map((field) => ({ key: FIELD_KEYS[field], value: values[field] })),
      ...values.extras.map(({ key, value }) => ({ key, value })),
    ]
    updateSettings.mutate(
      { items },
      {
        onSuccess: () => {
          form.reset(values)
          toast.success('Đã lưu cài đặt', { description: 'Tên, logo và màu mới đã áp dụng cho toàn bộ ứng dụng.' })
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  })

  const disabled = !canUpdate || updateSettings.isPending
  const saveButtons = canUpdate && (
    <>
      <Button type="button" variant="outline" disabled={!isDirty || updateSettings.isPending} onClick={() => form.reset()}>
        <Undo2 aria-hidden="true" />
        Hủy thay đổi
      </Button>
      <Button type="submit" form="general-settings-form" disabled={!isDirty || updateSettings.isPending}>
        {updateSettings.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
        Lưu thay đổi
      </Button>
    </>
  )

  return (
    <PermissionGuard permission={permissions.settings.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Cài đặt chung"
          icon={Settings2}
          description="Đổi tên, logo, màu chủ đạo theo khách hàng và thông tin doanh nghiệp hiển thị trên ứng dụng."
          actions={saveButtons}
        />

        {settings.error ? (
          <Card>
            <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
          </Card>
        ) : settings.isLoading ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <Skeleton className="h-[32rem] rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        ) : (
          <form id="general-settings-form" onSubmit={onSubmit} noValidate className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <fieldset disabled={disabled} className="min-w-0 space-y-6">
              {!canUpdate && (
                <div className="bg-info/10 text-info border-info/25 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm" role="note">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  Bạn chỉ có quyền xem cài đặt.
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Palette className="text-primary size-4" aria-hidden="true" />
                    Thương hiệu
                  </CardTitle>
                  <CardDescription>Hiển thị ở trang đăng nhập, thanh bên, tiêu đề trình duyệt.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5">
                  <FormField label="Tên ứng dụng" required error={errors.appName?.message}>
                    <Input placeholder="vd: POS Quán Cafe" {...form.register('appName')} />
                  </FormField>
                  <div className="grid gap-1.5">
                    <span className="text-sm font-medium">Logo</span>
                    <Controller
                      control={form.control}
                      name="logoUrl"
                      render={({ field }) => (
                        <LogoUploader value={field.value} appName={appName} onChange={(url) => field.onChange(url)} disabled={disabled} />
                      )}
                    />
                  </div>
                  <FormField label="Màu chủ đạo" htmlFor="primary-color" error={errors.primaryColor?.message}>
                    <Controller
                      control={form.control}
                      name="primaryColor"
                      render={({ field }) => (
                        <ColorField
                          id="primary-color"
                          value={field.value}
                          onChange={field.onChange}
                          disabled={disabled}
                          invalid={!!errors.primaryColor}
                        />
                      )}
                    />
                  </FormField>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Building2 className="text-primary size-4" aria-hidden="true" />
                    Thông tin doanh nghiệp
                  </CardTitle>
                  <CardDescription>In trên hóa đơn, chân trang và trang đăng nhập.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Tên doanh nghiệp" error={errors.companyName?.message} className="sm:col-span-2">
                    <Input placeholder="vd: Công ty TNHH ABC" {...form.register('companyName')} />
                  </FormField>
                  <FormField label="Hotline" error={errors.companyHotline?.message}>
                    <Input type="tel" inputMode="tel" placeholder="vd: 0909 123 456" {...form.register('companyHotline')} />
                  </FormField>
                  <FormField label="Zalo" error={errors.companyZalo?.message} hint="Số Zalo hoặc link https://zalo.me/…">
                    <Input placeholder="vd: 0909123456" {...form.register('companyZalo')} />
                  </FormField>
                  <FormField label="Email" error={errors.companyEmail?.message}>
                    <Input type="email" inputMode="email" placeholder="vd: lienhe@congty.vn" {...form.register('companyEmail')} />
                  </FormField>
                  <FormField label="Website" error={errors.companyWebsite?.message}>
                    <Input type="url" inputMode="url" placeholder="vd: https://congty.vn" {...form.register('companyWebsite')} />
                  </FormField>
                  <FormField label="Địa chỉ" error={errors.companyAddress?.message} className="sm:col-span-2">
                    <Textarea rows={2} placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố" {...form.register('companyAddress')} />
                  </FormField>
                </CardContent>
              </Card>

              {extraGroups.map(([groupName, indexes]) => (
                <Card key={groupName}>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">{groupName}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    {indexes.map((index) => (
                      <FormField
                        key={extras[index].key}
                        label={settingExtraLabels[extras[index].key]?.label ?? extras[index].key}
                        hint={settingExtraLabels[extras[index].key]?.hint}
                        error={errors.extras?.[index]?.value?.message}
                      >
                        <Input {...form.register(`extras.${index}.value`)} />
                      </FormField>
                    ))}
                  </CardContent>
                </Card>
              ))}

              {canUpdate && <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{saveButtons}</div>}
            </fieldset>

            <aside className="space-y-3 xl:sticky xl:top-20">
              <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <Eye className="size-4" aria-hidden="true" />
                Xem trước
              </h2>
              <BrandPreview appName={appName} logoUrl={logoUrl} primaryColor={primaryColor} />
              <p className="text-muted-foreground text-xs">
                Thay đổi chỉ áp dụng cho mọi người sau khi bấm &quot;Lưu thay đổi&quot;. Muốn thử nhanh màu khi trình diễn,
                dùng thanh công cụ demo.
              </p>
            </aside>
          </form>
        )}
      </div>
    </PermissionGuard>
  )
}
