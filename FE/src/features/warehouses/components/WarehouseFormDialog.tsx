'use client'

import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Info, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { applyFieldErrors, getErrorMessage, getFieldErrors } from '@/lib/api-error'
import { cleanPhone } from '@/lib/validators'
import type { WarehouseDto } from '@/types/inventory'
import { useKeeperCandidates, useSaveWarehouse } from '../hooks/use-warehouses'
import { warehouseFormSchema, type WarehouseFormValues } from '../schemas/warehouse.schema'
import { KeeperPicker } from './KeeperPicker'

const EMPTY: WarehouseFormValues = { code: '', name: '', address: '', phone: '', keeperIds: [] }
const fieldNames = ['code', 'name', 'address', 'phone', 'keeperIds'] as const
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

/**
 * Thêm, sửa kho (UC-02 luồng chính, FR-04) kèm mục "Thủ kho phụ trách" (FR-05) khi có `warehouses.assign`.
 * `mode = 'keepers'`: chỉ sửa thủ kho phụ trách.
 */
export function WarehouseFormDialog({
  open,
  onOpenChange,
  warehouse,
  canAssign,
  mode = 'full',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouse?: WarehouseDto | null
  canAssign: boolean
  mode?: 'full' | 'keepers'
}) {
  const save = useSaveWarehouse()
  const candidates = useKeeperCandidates({ enabled: open && canAssign })
  const form = useForm<WarehouseFormValues>({ resolver: zodResolver(warehouseFormSchema), defaultValues: EMPTY })
  const { errors } = form.formState
  const keepersOnly = mode === 'keepers' && !!warehouse

  useEffect(() => {
    if (!open) return
    form.reset(
      warehouse
        ? {
            code: warehouse.code,
            name: warehouse.name,
            address: warehouse.address ?? '',
            phone: warehouse.phone ?? '',
            keeperIds: warehouse.keepers.map((k) => k.id),
          }
        : EMPTY
    )
  }, [open, warehouse, form])

  const onSubmit = form.handleSubmit((v) => {
    const keepersChanged = canAssign && !sameSet(v.keeperIds, warehouse?.keepers.map((k) => k.id) ?? [])
    save.mutate(
      {
        id: warehouse?.id,
        input: keepersOnly
          ? undefined
          : {
              code: v.code.trim().toUpperCase(),
              name: v.name.trim(),
              address: v.address.trim() || undefined,
              phone: cleanPhone(v.phone.trim()) || undefined,
            },
        keeperIds: keepersChanged || keepersOnly ? v.keeperIds : undefined,
      },
      {
        onSuccess: (saved) => {
          toast.success(
            keepersOnly
              ? `Đã cập nhật thủ kho phụ trách ${saved.code}`
              : warehouse
                ? `Đã cập nhật kho ${saved.code}`
                : `Đã thêm kho ${saved.code}`
          )
          onOpenChange(false)
        },
        onError: (error) => {
          // Lỗi gán thủ kho của API nằm ở `errors.userIds` (07 §2.1), ô form là `keeperIds`
          const keeperError = getFieldErrors(error).userIds
          if (keeperError) form.setError('keeperIds', { type: 'server', message: keeperError })
          if (!applyFieldErrors(form.setError, error, fieldNames) && !keeperError) toast.error(getErrorMessage(error))
        },
      }
    )
  })

  const title = keepersOnly
    ? `Thủ kho phụ trách ${warehouse?.code}`
    : warehouse
      ? `Sửa kho ${warehouse.code}`
      : 'Thêm kho'

  return (
    <Dialog open={open} onOpenChange={(next) => !save.isPending && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {keepersOnly
              ? `${warehouse?.name}. Thủ kho chỉ thấy, thao tác trên kho được gán.`
              : 'Kho chọn được ở mọi phiếu; địa chỉ in trên phiếu nhập, xuất.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="grid max-h-[calc(100dvh-14rem)] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            {!keepersOnly && (
              <>
                <FormField
                  label="Mã kho"
                  required
                  error={errors.code?.message}
                  hint={warehouse?.hasDocuments ? 'Kho đã có chứng từ, không đổi mã được' : '2–10 ký tự chữ in hoa và số, vd KQ7'}
                >
                  <Input
                    autoComplete="off"
                    placeholder="vd: KQ7"
                    className="uppercase"
                    disabled={warehouse?.hasDocuments}
                    {...form.register('code')}
                  />
                </FormField>
                <FormField label="Số điện thoại" error={errors.phone?.message}>
                  <Input type="tel" inputMode="tel" autoComplete="off" {...form.register('phone')} />
                </FormField>
                <FormField label="Tên kho" required error={errors.name?.message} className="sm:col-span-2">
                  <Input autoComplete="off" placeholder="vd: Kho Quận 7" {...form.register('name')} />
                </FormField>
                <FormField label="Địa chỉ" error={errors.address?.message} className="sm:col-span-2">
                  <Input autoComplete="off" {...form.register('address')} />
                </FormField>
              </>
            )}
            {canAssign ? (
              <fieldset className="grid gap-2 sm:col-span-2">
                <legend className="mb-1.5 text-sm font-medium">Thủ kho phụ trách</legend>
                <Controller
                  control={form.control}
                  name="keeperIds"
                  render={({ field }) => (
                    <KeeperPicker
                      candidates={candidates.data}
                      loading={candidates.isLoading}
                      value={field.value}
                      onChange={field.onChange}
                      currentCode={warehouse?.code}
                    />
                  )}
                />
                {errors.keeperIds?.message && (
                  <p role="alert" className="text-destructive text-[0.8125rem]">
                    {errors.keeperIds.message}
                  </p>
                )}
                <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  Thủ kho được gán thấy kho này ở lần tải trang kế tiếp. Bỏ gán: phiếu nháp họ đã lập vẫn giữ, quản lý xem và hủy được.
                </p>
              </fieldset>
            ) : null}
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Hủy
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {warehouse ? 'Lưu thay đổi' : 'Thêm kho'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
