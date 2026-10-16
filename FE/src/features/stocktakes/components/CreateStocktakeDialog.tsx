'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { routeTo } from '@/config/route-path'
import { WarehouseSelect } from '@/features/inventory/components/WarehouseSelect'
import { handleDocError, newRequestId } from '@/features/inventory/hooks/use-doc-action'
import { useMyWarehouses, useProductGroups } from '@/features/inventory/hooks/use-inventory'
import { errorCode, errorExtension } from '@/features/inventory/lib/problem'
import { useWarehouses } from '@/features/warehouses/hooks/use-warehouses'
import { usePermissions } from '@/hooks/use-permissions'
import { getErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { useStocktakeMutations } from '../hooks/use-stocktakes'

/**
 * Tạo phiếu kiểm kê (UC-11 bước 1–2, 07 §4.4): kho, toàn kho hoặc chọn nhóm, người đếm (mặc định thủ kho đầu tiên
 * của kho). Kho đang có phiếu mở → báo mã phiếu, mở được phiếu đó.
 */
export function CreateStocktakeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <CreateBody onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

/** Nội dung hộp tạo kiểm kê; trạng thái đặt lại mỗi lần mở (DialogContent gỡ khi đóng) */
function CreateBody({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { user } = usePermissions()
  const myWarehouses = useMyWarehouses()
  const groups = useProductGroups()
  const warehouses = useWarehouses()
  const m = useStocktakeMutations()
  const [pickedWarehouseId, setWarehouseId] = useState('')
  const [scopeAll, setScopeAll] = useState(true)
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [counterChoice, setCounterId] = useState<{ warehouseId: string; id: string } | null>(null)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [rid, setRid] = useState(newRequestId)
  const [openDoc, setOpenDoc] = useState<string | null>(null)
  const warehouseId = pickedWarehouseId || (myWarehouses.data?.find((w) => w.isActive)?.id ?? '')

  const keepers = useMemo(
    () => warehouses.data?.find((w) => w.id === warehouseId)?.keepers ?? [],
    [warehouses.data, warehouseId]
  )
  const counters = useMemo(() => {
    const list = [...keepers]
    if (user && !list.some((k) => k.id === user.id)) list.push({ id: user.id, username: user.username, fullName: `${user.fullName} (tôi)` })
    return list
  }, [keepers, user])
  // Mặc định thủ kho đầu tiên của kho (quyết định 21); đổi kho thì về mặc định của kho mới
  const counterId =
    counterChoice?.warehouseId === warehouseId ? counterChoice.id : (keepers[0]?.id ?? user?.id ?? '')

  const submit = () => {
    setErrors({})
    setOpenDoc(null)
    m.create.mutate(
      { warehouseId, scopeAll, groupIds: scopeAll ? [] : groupIds, counterId, note, clientRequestId: rid },
      {
        onSuccess: (doc) => {
          toast.success(`Đã tạo phiếu kiểm kê ${doc.code}, chốt sổ sách ${doc.totalLines} dòng`)
          onClose()
          router.push(routeTo.stocktake(doc.id))
        },
        onError: (error) => {
          setRid(newRequestId())
          if (errorCode(error) === 'KhoDaCoPhieuKiemKe') {
            setOpenDoc(errorExtension<string>(error, 'stocktakeId') ?? null)
            setErrors({ form: getErrorMessage(error) })
            return
          }
          handleDocError(error, { onFieldErrors: setErrors })
          if (errorCode(error)) setErrors((e) => ({ ...e, form: getErrorMessage(error) }))
        },
      }
    )
  }

  return (
    <>
        <DialogHeader>
          <DialogTitle>Tạo phiếu kiểm kê</DialogTitle>
          <DialogDescription>
            Hệ thống chốt số sổ sách ngay khi tạo. Trong lúc kiểm, duyệt phiếu nhập, xuất, chuyển của hàng trong phạm vi bị khóa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FormField label="Kho" required error={errors.warehouseId}>
            <WarehouseSelect value={warehouseId} onChange={setWarehouseId} activeOnly className="h-10" />
          </FormField>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Phạm vi</legend>
            <RadioGroup value={scopeAll ? 'all' : 'groups'} onValueChange={(v) => setScopeAll(v === 'all')} className="flex gap-6">
              <Label className="flex min-h-11 items-center gap-2 font-normal">
                <RadioGroupItem value="all" /> Toàn kho
              </Label>
              <Label className="flex min-h-11 items-center gap-2 font-normal">
                <RadioGroupItem value="groups" /> Theo nhóm hàng
              </Label>
            </RadioGroup>
            {!scopeAll && (
              <div className={cn('grid gap-1 rounded-lg border p-2 sm:grid-cols-2', errors.groupIds && 'border-destructive')}>
                {(groups.data ?? []).map((g) => (
                  <Label key={g.id} className="hover:bg-muted flex min-h-10 items-center gap-2 rounded-md px-2 font-normal">
                    <Checkbox
                      checked={groupIds.includes(g.id)}
                      onCheckedChange={(c) => setGroupIds((ids) => (c ? [...ids, g.id] : ids.filter((x) => x !== g.id)))}
                    />
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} aria-hidden="true" />
                    {g.name}
                  </Label>
                ))}
              </div>
            )}
            {errors.groupIds && <p className="text-destructive text-sm">{errors.groupIds}</p>}
          </fieldset>
          <FormField label="Người đếm" htmlFor="st-counter" required error={errors.counterId} hint="Người duyệt phải khác người đếm">
            <Select value={counterId || undefined} onValueChange={(v) => setCounterId({ warehouseId, id: v })}>
              <SelectTrigger id="st-counter" className="h-10 w-full">
                <SelectValue placeholder="Chọn người đếm" />
              </SelectTrigger>
              <SelectContent>
                {counters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Ghi chú">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
          </FormField>
          {errors.form && (
            <div role="alert" className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm">
              {errors.form}
              {openDoc && (
                <Button variant="link" className="ml-1 h-auto p-0" onClick={() => router.push(routeTo.stocktake(openDoc))}>
                  Mở phiếu đang kiểm
                </Button>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={m.create.isPending}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={m.create.isPending || !warehouseId}>
            {m.create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ClipboardList aria-hidden="true" />}
            Tạo và chốt sổ sách
          </Button>
        </DialogFooter>
    </>
  )
}
