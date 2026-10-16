'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { cleanPhone } from '@/lib/validators'
import type { SupplierDto } from '@/types/inventory'
import { useSaveSupplier } from '../hooks/use-suppliers'
import { supplierFormSchema, type SupplierFormValues } from '../schemas/supplier.schema'

const EMPTY: SupplierFormValues = { code: '', name: '', taxCode: '', phone: '', address: '', contactName: '' }
const orUndef = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined)

/** Thêm, sửa nhà cung cấp (UC-02 1a, FR-06). Bỏ trống mã khi thêm thì hệ thống cấp NCC + 3 số kế tiếp. */
export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier?: SupplierDto | null
}) {
  const save = useSaveSupplier()
  const form = useForm<SupplierFormValues>({ resolver: zodResolver(supplierFormSchema), defaultValues: EMPTY })
  const { errors } = form.formState

  useEffect(() => {
    if (!open) return
    form.reset(
      supplier
        ? {
            code: supplier.code,
            name: supplier.name,
            taxCode: supplier.taxCode ?? '',
            phone: supplier.phone ?? '',
            address: supplier.address ?? '',
            contactName: supplier.contactName ?? '',
          }
        : EMPTY
    )
  }, [open, supplier, form])

  const onSubmit = form.handleSubmit((v) => {
    save.mutate(
      {
        id: supplier?.id,
        input: {
          code: orUndef(v.code?.toUpperCase()),
          name: v.name.trim(),
          taxCode: orUndef(v.taxCode),
          phone: orUndef(cleanPhone(v.phone) ?? undefined),
          address: orUndef(v.address),
          contactName: orUndef(v.contactName),
        },
      },
      {
        onSuccess: (saved) => {
          toast.success(supplier ? `Đã cập nhật ${saved.code}` : `Đã thêm nhà cung cấp ${saved.code}`)
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>{supplier ? `Sửa nhà cung cấp ${supplier.code}` : 'Thêm nhà cung cấp'}</DialogTitle>
          <DialogDescription>Thông tin in trên phiếu nhập và dùng để đối chiếu hóa đơn.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="grid max-h-[calc(100dvh-14rem)] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
            <FormField
              label="Mã nhà cung cấp"
              error={errors.code?.message}
              hint={supplier ? undefined : 'Bỏ trống để hệ thống tự cấp mã kế tiếp'}
            >
              <Input autoComplete="off" placeholder="vd: NCC016" className="uppercase" {...form.register('code')} />
            </FormField>
            <FormField label="Mã số thuế" error={errors.taxCode?.message}>
              <Input inputMode="numeric" autoComplete="off" placeholder="10 hoặc 13 chữ số" {...form.register('taxCode')} />
            </FormField>
            <FormField label="Tên nhà cung cấp" required error={errors.name?.message} className="sm:col-span-2">
              <Input autoComplete="off" placeholder="vd: Công ty TNHH Thương mại Minh Phát" {...form.register('name')} />
            </FormField>
            <FormField label="Người liên hệ" error={errors.contactName?.message}>
              <Input autoComplete="off" {...form.register('contactName')} />
            </FormField>
            <FormField label="Số điện thoại" error={errors.phone?.message}>
              <Input type="tel" inputMode="tel" autoComplete="off" placeholder="vd: 0283 456 7890" {...form.register('phone')} />
            </FormField>
            <FormField label="Địa chỉ" error={errors.address?.message} className="sm:col-span-2">
              <Input autoComplete="off" {...form.register('address')} />
            </FormField>
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Hủy
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {supplier ? 'Lưu thay đổi' : 'Thêm nhà cung cấp'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
