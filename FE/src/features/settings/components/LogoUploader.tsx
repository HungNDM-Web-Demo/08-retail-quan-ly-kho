'use client'

import { useRef, useState } from 'react'
import { ImageUp, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { BrandMark } from '@/components/shared/BrandLogo'
import { Button } from '@/components/ui/button'
import { appConfig } from '@/config/app.config'
import { getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { useUploadImage } from '../hooks/use-settings'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/svg+xml'
const MAX_BYTES = 2 * 1024 * 1024

type LogoUploaderProps = {
  value: string
  appName: string
  onChange: (url: string) => void
  disabled?: boolean
}

/** Tải logo (JPG/PNG/WebP/SVG ≤ 2 MB). Ảnh lưu ngay khi chọn, logo đổi khi bấm Lưu cài đặt. */
export function LogoUploader({ value, appName, onChange, disabled }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadImage()
  const [error, setError] = useState<string | null>(null)
  const isDefault = !value || value === appConfig.logoUrl

  const handleFile = (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!ACCEPT.split(',').includes(file.type)) return setError('Chỉ nhận ảnh JPG, PNG, WebP hoặc SVG.')
    if (file.size > MAX_BYTES) return setError('Ảnh tối đa 2 MB.')
    upload.mutate(file, {
      onSuccess: (image) => {
        onChange(image.url)
        toast.success('Đã tải logo lên', { description: 'Bấm "Lưu thay đổi" để áp dụng.' })
      },
      onError: (err) => setError(Object.values(getFieldErrors(err))[0] ?? getErrorMessage(err)),
    })
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="bg-muted/50 flex size-24 shrink-0 items-center justify-center rounded-xl border border-dashed">
        <BrandMark size="lg" logoUrl={value} appName={appName || 'Ứng dụng'} className="size-16 text-xl" />
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ImageUp aria-hidden="true" />}
            {isDefault ? 'Tải logo lên' : 'Đổi logo'}
          </Button>
          {!isDefault && (
            <Button type="button" variant="ghost" disabled={disabled} onClick={() => onChange(appConfig.logoUrl)}>
              <RotateCcw aria-hidden="true" />
              Dùng logo mặc định
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {error ? (
          <p role="alert" className="text-destructive text-[0.8125rem]">
            {error}
          </p>
        ) : (
          <p className="text-muted-foreground text-[0.8125rem]">
            JPG, PNG, WebP hoặc SVG, tối đa 2 MB. Nên dùng ảnh vuông, nền trong suốt. Logo mặc định hiển thị chữ viết tắt
            trên màu chủ đạo.
          </p>
        )}
      </div>
    </div>
  )
}
