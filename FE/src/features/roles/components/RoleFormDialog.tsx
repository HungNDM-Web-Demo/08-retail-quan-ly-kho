'use client'

import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { applyFieldErrors, getErrorMessage } from '@/lib/api-error'
import { ROLE_CODE_MESSAGE } from '@/lib/validators'
import { useCreateRole, useUpdateRole } from '../hooks/use-roles'
import { roleFormSchema, type RoleFormValues } from '../schemas/role.schema'
import type { RoleDto } from '../types/role.types'

type RoleFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  role?: RoleDto | null
  roles: RoleDto[]
  onSaved?: (role: RoleDto) => void
}

const NONE = 'none'
const EMPTY: RoleFormValues = { code: '', name: '', description: '', copyFromId: NONE }

/** Thêm vai trò (có thể sao chép quyền từ vai trò khác) hoặc sửa tên, mô tả. */
export function RoleFormDialog({ open, onOpenChange, role, roles, onSaved }: RoleFormDialogProps) {
  const createRole = useCreateRole()
  const updateRole = useUpdateRole()
  const pending = createRole.isPending || updateRole.isPending
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema(role ? 'edit' : 'create')),
    defaultValues: EMPTY,
  })
  const { errors } = form.formState

  useEffect(() => {
    if (!open) return
    form.reset(role ? { code: role.code, name: role.name, description: role.description ?? '', copyFromId: NONE } : EMPTY)
  }, [open, role, form])

  const onError = (error: unknown) => {
    if (!applyFieldErrors(form.setError, error)) toast.error(getErrorMessage(error))
  }

  const onSubmit = form.handleSubmit((values) => {
    if (role) {
      updateRole.mutate(
        { id: role.id, input: { name: values.name, description: values.description || null } },
        {
          onSuccess: (saved) => {
            toast.success(`Đã cập nhật vai trò ${saved.name}`)
            onSaved?.(saved)
            onOpenChange(false)
          },
          onError,
        }
      )
      return
    }
    const source = roles.find((r) => r.id === values.copyFromId)
    createRole.mutate(
      {
        code: values.code,
        name: values.name,
        description: values.description || null,
        permissions: source?.permissions ?? [],
      },
      {
        onSuccess: (saved) => {
          toast.success(`Đã thêm vai trò ${saved.name}`, { description: 'Tiếp tục tick quyền trong ma trận rồi bấm Lưu.' })
          onSaved?.(saved)
          onOpenChange(false)
        },
        onError,
      }
    )
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{role ? 'Sửa vai trò' : 'Thêm vai trò'}</DialogTitle>
          <DialogDescription>
            {role ? 'Đổi tên hiển thị và mô tả của vai trò.' : 'Tạo vai trò mới, sau đó phân quyền trong ma trận.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormField
            label="Mã vai trò"
            required={!role}
            error={errors.code?.message}
            hint={role ? 'Không đổi được mã vai trò.' : ROLE_CODE_MESSAGE}
          >
            <Input
              autoComplete="off"
              spellCheck={false}
              placeholder="vd: CASHIER"
              disabled={!!role}
              className="font-mono uppercase"
              {...form.register('code')}
            />
          </FormField>
          <FormField label="Tên vai trò" required error={errors.name?.message}>
            <Input autoComplete="off" placeholder="vd: Thu ngân" {...form.register('name')} />
          </FormField>
          <FormField label="Mô tả" error={errors.description?.message} hint="Vai trò này dùng để làm gì.">
            <Textarea rows={3} placeholder="vd: Tạo đơn, thu tiền tại quầy" {...form.register('description')} />
          </FormField>
          {!role && (
            <FormField label="Sao chép quyền từ" htmlFor="copy-from">
              <Controller
                control={form.control}
                name="copyFromId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="copy-from">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Không sao chép, bắt đầu trống</SelectItem>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name} ({r.permissions.length} quyền)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          )}
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {role ? 'Lưu thay đổi' : 'Thêm vai trò'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
