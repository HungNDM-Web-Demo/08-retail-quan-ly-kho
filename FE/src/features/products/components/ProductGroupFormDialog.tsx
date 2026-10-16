'use client'

import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import type { ProductGroupDto } from '@/types/inventory'
import { useSaveProductGroup } from '../hooks/use-products'
import { productGroupFormSchema, type ProductGroupFormValues } from '../schemas/product.schema'

/** Màu gợi ý cho nhóm mới (dữ liệu nhóm, không phải màu giao diện) */
const PRESET_COLORS = ['#2563EB', '#0D9488', '#16A34A', '#CA8A04', '#EA580C', '#DC2626', '#DB2777', '#7C3AED', '#475569']

/** Thêm, đổi tên nhóm hàng (UC-01 1a). Màu là chấm màu ở danh sách và nền ô ảnh mặc định. */
export function ProductGroupFormDialog({
  open,
  onOpenChange,
  group,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  group?: ProductGroupDto | null
}) {
  const save = useSaveProductGroup()
  const form = useForm<ProductGroupFormValues>({
    resolver: zodResolver(productGroupFormSchema),
    defaultValues: { code: '', name: '', color: PRESET_COLORS[0] },
  })
  const { errors } = form.formState
  const color = useWatch({ control: form.control, name: 'color' })

  useEffect(() => {
    if (!open) return
    form.reset(group ? { code: group.code, name: group.name, color: group.color } : { code: '', name: '', color: PRESET_COLORS[0] })
  }, [open, group, form])

  const onSubmit = form.handleSubmit((v) => {
    save.mutate(
      { id: group?.id, input: { code: v.code.trim().toUpperCase(), name: v.name.trim(), color: v.color.toUpperCase() } },
      {
        onSuccess: (saved) => {
          toast.success(group ? `Đã lưu nhóm ${saved.name}` : `Đã thêm nhóm ${saved.name}`)
          onOpenChange(false)
        },
        onError: (error) => {
          if (!applyFieldErrors(form.setError, error)) toast.error(getErrorMessage(error))
        },
      }
    )
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{group ? `Sửa nhóm ${group.name}` : 'Thêm nhóm hàng'}</DialogTitle>
          <DialogDescription>Nhóm dùng để lọc hàng hóa, tồn kho, báo cáo và chọn phạm vi kiểm kê.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <FormField label="Mã nhóm" required error={errors.code?.message}>
              <Input autoComplete="off" className="uppercase" placeholder="vd: SUA" {...form.register('code')} />
            </FormField>
            <FormField label="Tên nhóm" required error={errors.name?.message}>
              <Input autoComplete="off" placeholder="vd: Sữa và sản phẩm từ sữa" {...form.register('name')} />
            </FormField>
          </div>
          <FormField label="Màu nhóm" required error={errors.color?.message}>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => form.setValue('color', c, { shouldValidate: true, shouldDirty: true })}
                  aria-label={`Chọn màu ${c}`}
                  aria-pressed={color.toUpperCase() === c}
                  className="focus-visible:ring-ring/50 aria-pressed:ring-foreground size-8 rounded-full ring-2 ring-transparent ring-offset-2 outline-none focus-visible:ring-3"
                  style={{ backgroundColor: c }}
                />
              ))}
              <Input type="color" aria-label="Màu khác" className="h-9 w-14 p-1" {...form.register('color')} />
            </div>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Hủy
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {group ? 'Lưu thay đổi' : 'Thêm nhóm'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
