'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { BookOpenText, Info, Loader2, Lock, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { routeTo } from '@/config/route-path'
import { ProductThumb } from '@/features/inventory/components/ProductThumb'
import { readQuantity } from '@/features/inventory/lib/uom'
import { useWarehouses } from '@/features/warehouses/hooks/use-warehouses'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductDetailDto, ProductGroupDto } from '@/types/inventory'
import { useProductDetail, useSaveProduct } from '../hooks/use-products'
import {
  MAX_UNITS,
  productFormSchema,
  productMessages,
  toSaveProductRequest,
  type ProductFormValues,
} from '../schemas/product.schema'

const EMPTY: ProductFormValues = {
  code: '',
  name: '',
  groupId: '',
  baseUnit: '',
  barcode: '',
  spec: '',
  units: [],
  levels: [],
}

const numText = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))

function toFormValues(p: ProductDetailDto): ProductFormValues {
  return {
    code: p.code,
    name: p.name,
    groupId: p.groupId,
    baseUnit: p.baseUnit,
    barcode: p.barcode ?? '',
    spec: p.spec ?? '',
    units: p.units.map((u) => ({
      id: u.id,
      name: u.name,
      factor: String(u.factor),
      barcode: u.barcode ?? '',
      isUsed: u.isUsed,
    })),
    levels: p.levels.map((l) => ({
      warehouseId: l.warehouseId,
      warehouseCode: l.warehouseCode,
      warehouseName: l.warehouseName,
      onHand: l.onHand,
      minQty: numText(l.minQty),
      maxQty: numText(l.maxQty),
    })),
  }
}

/**
 * Thêm, sửa, xem mặt hàng (SCR-02, UC-01, FR-07, FR-08): thông tin, tối đa 2 đơn vị quy đổi (ô hệ số khóa khi
 * đơn vị đã có chứng từ, TC-03), "Ngưỡng tồn theo kho" mỗi kho một dòng. `readOnly`: thủ kho chỉ xem.
 */
export function ProductFormSheet({
  open,
  onOpenChange,
  productId,
  groups,
  readOnly,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = thêm mới */
  productId: string | null
  groups: ProductGroupDto[] | undefined
  readOnly?: boolean
}) {
  const isNew = !productId
  const detail = useProductDetail(open ? productId : null)
  const warehouses = useWarehouses()
  const save = useSaveProduct()
  const product = detail.data

  const form = useForm<ProductFormValues>({ resolver: zodResolver(productFormSchema), defaultValues: EMPTY })
  const { errors } = form.formState
  const units = useFieldArray({ control: form.control, name: 'units' })
  const levels = useWatch({ control: form.control, name: 'levels' })
  const baseUnit = useWatch({ control: form.control, name: 'baseUnit' })
  const watchedUnits = useWatch({ control: form.control, name: 'units' })

  // Thêm mới: mỗi kho đang hoạt động một dòng ngưỡng; sửa: lấy theo chi tiết mặt hàng
  const newLevels = useMemo(
    () =>
      (warehouses.data ?? [])
        .filter((w) => w.isActive)
        .map((w) => ({ warehouseId: w.id, warehouseCode: w.code, warehouseName: w.name, onHand: 0, minQty: '', maxQty: '' })),
    [warehouses.data]
  )

  useEffect(() => {
    if (!open) return
    if (isNew) form.reset({ ...EMPTY, levels: newLevels })
    else if (product) form.reset(toFormValues(product))
  }, [open, isNew, product, newLevels, form])

  const loading = !isNew && !product
  const selectableGroups = (groups ?? []).filter((g) => g.isActive || g.id === product?.groupId)
  const readings = watchedUnits
    .map((u) => ({ name: u.name, factor: Number(u.factor) }))
    .filter((u) => u.name && Number.isInteger(u.factor) && u.factor > 1)

  const onSubmit = form.handleSubmit((values) => {
    save.mutate(
      { id: productId ?? undefined, input: toSaveProductRequest(values) },
      {
        onSuccess: (saved) => {
          toast.success(isNew ? `Đã thêm ${saved.code} – ${saved.name}` : `Đã lưu ${saved.code}`)
          onOpenChange(false)
        },
        onError: (error) => {
          if (!applyFieldErrors(form.setError, error)) toast.error(getErrorMessage(error))
        },
      }
    )
  })

  const title = isNew ? 'Thêm mặt hàng' : readOnly ? 'Thông tin mặt hàng' : 'Sửa mặt hàng'

  return (
    <Sheet open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        <SheetHeader className="border-b px-6 py-5">
          <div className="flex items-start gap-3">
            {product && (
              <ProductThumb imageUrl={product.imageUrl} name={product.name} groupColor={product.groupColor} size="lg" />
            )}
            <div className="min-w-0">
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {title}
                {product && !product.isActive && <StatusBadge tone="neutral">Ngừng sử dụng</StatusBadge>}
              </SheetTitle>
              <SheetDescription>
                {product ? `${product.code} · ${product.name}` : 'Mã hàng, đơn vị quy đổi, mã vạch và ngưỡng tồn theo kho.'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="space-y-4 p-6" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <fieldset disabled={readOnly || save.isPending} className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 py-5">
              <section className="grid gap-4 sm:grid-cols-2" aria-labelledby="product-info">
                <h3 id="product-info" className="text-sm font-semibold sm:col-span-2">
                  Thông tin
                </h3>
                <FormField label="Mã hàng" required error={errors.code?.message} hint="Chữ in hoa, số, dấu -, vd SDAC-380">
                  <Input autoComplete="off" className="uppercase" placeholder="vd: SDAC-380" {...form.register('code')} />
                </FormField>
                <FormField label="Nhóm hàng" required error={errors.groupId?.message} htmlFor="product-group">
                  <Controller
                    control={form.control}
                    name="groupId"
                    render={({ field }) => (
                      <Select
                        value={field.value || undefined}
                        // Radix gửi '' khi danh sách chưa kịp nạp lúc form.reset: bỏ qua để không mất nhóm hiện tại
                        onValueChange={(v) => v && field.onChange(v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger id="product-group" aria-invalid={!!errors.groupId || undefined} className="w-full">
                          <SelectValue placeholder="Chọn nhóm hàng" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectableGroups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} aria-hidden="true" />
                              {g.name}
                              {!g.isActive && ' (ngừng)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <FormField label="Tên mặt hàng" required error={errors.name?.message} className="sm:col-span-2">
                  <Input autoComplete="off" placeholder="vd: Sữa đặc có đường lon 380g" {...form.register('name')} />
                </FormField>
                <FormField label="Đơn vị cơ bản" required error={errors.baseUnit?.message} hint="Đơn vị nhỏ nhất, tồn và giá vốn tính theo đơn vị này">
                  <Input autoComplete="off" placeholder="vd: Lon, Chai, Túi" {...form.register('baseUnit')} />
                </FormField>
                <FormField label="Mã vạch đơn vị cơ bản" error={errors.barcode?.message}>
                  <Input inputMode="numeric" autoComplete="off" placeholder="8–14 chữ số" {...form.register('barcode')} />
                </FormField>
                <FormField label="Quy cách" error={errors.spec?.message} className="sm:col-span-2">
                  <Input autoComplete="off" placeholder="vd: Lon thiếc 380g" {...form.register('spec')} />
                </FormField>
                {product?.imageUrl && (
                  <p className="text-muted-foreground flex items-start gap-1.5 text-xs sm:col-span-2">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    Ảnh minh họa theo kiểu hàng, dùng chung cho các mặt hàng cùng kiểu.
                  </p>
                )}
              </section>

              <section className="space-y-3" aria-labelledby="product-units">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 id="product-units" className="text-sm font-semibold">
                      Đơn vị quy đổi
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      Tối đa {MAX_UNITS} đơn vị, hệ số là số {baseUnit ? baseUnit.toLowerCase() : 'đơn vị cơ bản'} trong một đơn vị.
                    </p>
                  </div>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={units.fields.length >= MAX_UNITS}
                      onClick={() => units.append({ name: '', factor: '', barcode: '', isUsed: false })}
                    >
                      <Plus aria-hidden="true" />
                      Thêm đơn vị
                    </Button>
                  )}
                </div>
                {errors.units?.message && (
                  <p role="alert" className="text-destructive text-[0.8125rem]">
                    {errors.units.message}
                  </p>
                )}
                {units.fields.length === 0 ? (
                  <p className="bg-muted/50 text-muted-foreground rounded-lg px-3 py-2.5 text-sm">
                    Chưa có đơn vị quy đổi. Thêm thùng, lốc để quét mã thùng khi nhập, xuất.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {units.fields.map((f, i) => {
                      const used = watchedUnits[i]?.isUsed
                      return (
                        <div key={f.id} className="bg-muted/30 grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_8rem_1fr_auto]">
                          <FormField label="Tên đơn vị" required error={errors.units?.[i]?.name?.message}>
                            <Input autoComplete="off" placeholder="vd: Thùng 48" {...form.register(`units.${i}.name`)} />
                          </FormField>
                          <FormField
                            label="Hệ số"
                            required
                            error={errors.units?.[i]?.factor?.message}
                            hint={used ? productMessages.unitUsed : undefined}
                          >
                            <Input
                              inputMode="numeric"
                              autoComplete="off"
                              placeholder="vd: 48"
                              disabled={used}
                              {...form.register(`units.${i}.factor`)}
                            />
                          </FormField>
                          <FormField label="Mã vạch" error={errors.units?.[i]?.barcode?.message}>
                            <Input inputMode="numeric" autoComplete="off" placeholder="vd: GTIN-14 của thùng" {...form.register(`units.${i}.barcode`)} />
                          </FormField>
                          {!readOnly && (
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={used}
                                onClick={() => units.remove(i)}
                                aria-label={used ? 'Đơn vị đã có chứng từ, không xóa được' : `Xóa đơn vị ${watchedUnits[i]?.name || i + 1}`}
                                title={used ? productMessages.unitUsed : 'Xóa đơn vị'}
                              >
                                {used ? <Lock aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-3" aria-labelledby="product-levels">
                <div>
                  <h3 id="product-levels" className="text-sm font-semibold">
                    Ngưỡng tồn theo kho
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    Theo {baseUnit ? baseUnit.toLowerCase() : 'đơn vị cơ bản'}. Để trống là không cảnh báo. Tồn tối đa dùng để đề xuất số nhập.
                  </p>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="bg-muted/50 text-muted-foreground text-xs font-semibold uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Kho</th>
                        <th className="px-3 py-2 text-right">Tồn hiện tại</th>
                        <th className="w-36 px-3 py-2 text-left">Tối thiểu</th>
                        <th className="w-36 px-3 py-2 text-left">Tối đa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levels.map((l, i) => {
                        const minErr = errors.levels?.[i]?.minQty?.message
                        const maxErr = errors.levels?.[i]?.maxQty?.message
                        return (
                          <tr key={l.warehouseId} className="border-t align-top">
                            <td className="px-3 py-2.5">
                              <div className="font-medium">{l.warehouseCode}</div>
                              <div className="text-muted-foreground text-xs">{l.warehouseName}</div>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="font-medium tabular-nums">{formatNumber(l.onHand, 0)}</div>
                              {l.onHand > 0 && readings.length > 0 && (
                                <div className="text-muted-foreground text-xs">{readQuantity(l.onHand, baseUnit || '', readings)}</div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                inputMode="numeric"
                                autoComplete="off"
                                aria-label={`Tồn tối thiểu tại ${l.warehouseCode}`}
                                aria-invalid={!!minErr || undefined}
                                className="h-9"
                                {...form.register(`levels.${i}.minQty`)}
                              />
                              {minErr && (
                                <p role="alert" className="text-destructive mt-1 text-xs">
                                  {minErr}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                inputMode="numeric"
                                autoComplete="off"
                                aria-label={`Tồn tối đa tại ${l.warehouseCode}`}
                                aria-invalid={!!maxErr || undefined}
                                className="h-9"
                                {...form.register(`levels.${i}.maxQty`)}
                              />
                              {maxErr && (
                                <p role="alert" className="text-destructive mt-1 text-xs">
                                  {maxErr}
                                </p>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {levels.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-muted-foreground px-3 py-4 text-center">
                            Chưa có kho đang hoạt động.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </fieldset>

            <SheetFooter className={cn('flex-row flex-wrap justify-end gap-2 border-t px-6 py-4')}>
              {product && (
                <Button asChild variant="ghost" className="mr-auto">
                  <Link href={routeTo.stockCard(product.id)}>
                    <BookOpenText aria-hidden="true" />
                    Xem thẻ kho
                  </Link>
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
                {readOnly ? 'Đóng' : 'Hủy'}
              </Button>
              {!readOnly && (
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {isNew ? 'Thêm mặt hàng' : 'Lưu thay đổi'}
                </Button>
              )}
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
