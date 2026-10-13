'use client'

import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PermissionGroup, PermissionItem } from '../types/role.types'

/** Cột hành động chuẩn (QUY-UOC KIEN-TRUC-HE-THONG §7.3); hành động riêng gom vào cột "Khác". */
const ACTIONS = [
  { key: 'view', label: 'Xem' },
  { key: 'create', label: 'Thêm' },
  { key: 'update', label: 'Sửa' },
  { key: 'delete', label: 'Xóa' },
] as const

type CheckState = boolean | 'indeterminate'

function MatrixCheckbox({
  checked,
  onChange,
  disabled,
  label,
  title,
}: {
  checked: CheckState
  onChange: (checked: boolean) => void
  disabled?: boolean
  label: string
  title?: string
}) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={(value) => onChange(value === true)}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      className={cn(
        'border-input relative flex size-5 shrink-0 items-center justify-center rounded-[5px] border shadow-xs transition-colors duration-150 outline-none',
        'after:absolute after:-inset-3 after:content-[""]',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        'data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
        'disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30'
      )}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        {checked === 'indeterminate' ? <Minus className="size-3.5" strokeWidth={3} /> : <Check className="size-3.5" strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

const actionOf = (code: string) => code.slice(code.lastIndexOf('.') + 1)

type PermissionMatrixProps = {
  groups: PermissionGroup[]
  value: string[]
  onChange: (codes: string[]) => void
  readOnly?: boolean
}

/**
 * Ma trận quyền (UC-SYS-06 bước 2): hàng là nhóm chức năng, cột là hành động.
 * Ô đầu hàng tick/bỏ cả nhóm; ô tiêu đề cột tick/bỏ cả cột.
 */
export function PermissionMatrix({ groups, value, onChange, readOnly }: PermissionMatrixProps) {
  const selected = new Set(value)
  const allCodes = groups.flatMap((g) => g.items.map((i) => i.code))

  const toggle = (codes: string[], on: boolean) => {
    const next = new Set(selected)
    codes.forEach((code) => (on ? next.add(code) : next.delete(code)))
    // Giữ thứ tự theo danh mục quyền
    onChange(allCodes.filter((code) => next.has(code)))
  }

  const stateOf = (codes: string[]): CheckState => {
    if (codes.length === 0) return false
    const count = codes.filter((c) => selected.has(c)).length
    return count === 0 ? false : count === codes.length ? true : 'indeterminate'
  }

  const columnCodes = (action: string) =>
    groups.flatMap((g) => g.items.filter((i) => actionOf(i.code) === action).map((i) => i.code))

  const otherCodes = groups.flatMap((g) =>
    g.items.filter((i) => !ACTIONS.some((a) => a.key === actionOf(i.code))).map((i) => i.code)
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">Ma trận phân quyền theo nhóm chức năng và hành động</caption>
        <thead>
          <tr className="bg-muted/50 border-b">
            <th scope="col" className="text-muted-foreground h-12 px-4 text-left text-xs font-semibold tracking-wide uppercase">
              <span className="flex items-center gap-3">
                <MatrixCheckbox
                  checked={stateOf(allCodes)}
                  onChange={(on) => toggle(allCodes, on)}
                  disabled={readOnly}
                  label="Chọn tất cả quyền"
                />
                Chức năng
              </span>
            </th>
            {ACTIONS.map((action) => {
              const codes = columnCodes(action.key)
              return (
                <th key={action.key} scope="col" className="text-muted-foreground h-12 w-20 px-2 text-center text-xs font-semibold tracking-wide uppercase">
                  <span className="flex flex-col items-center gap-1.5">
                    {action.label}
                    <MatrixCheckbox
                      checked={stateOf(codes)}
                      onChange={(on) => toggle(codes, on)}
                      disabled={readOnly || codes.length === 0}
                      label={`Chọn cả cột ${action.label}`}
                    />
                  </span>
                </th>
              )
            })}
            <th scope="col" className="text-muted-foreground h-12 px-4 text-left text-xs font-semibold tracking-wide uppercase">
              Khác {otherCodes.length === 0 && <span className="sr-only">(không có)</span>}
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const codes = group.items.map((i) => i.code)
            const byAction = (key: string): PermissionItem | undefined =>
              group.items.find((i) => actionOf(i.code) === key)
            const others = group.items.filter((i) => !ACTIONS.some((a) => a.key === actionOf(i.code)))
            const count = codes.filter((c) => selected.has(c)).length
            return (
              <tr key={group.groupName} className="hover:bg-muted/30 border-b transition-colors last:border-0">
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <span className="flex items-center gap-3">
                    <MatrixCheckbox
                      checked={stateOf(codes)}
                      onChange={(on) => toggle(codes, on)}
                      disabled={readOnly}
                      label={`Chọn cả nhóm ${group.groupName}`}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{group.groupName}</span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {count}/{codes.length} quyền
                      </span>
                    </span>
                  </span>
                </th>
                {ACTIONS.map((action) => {
                  const item = byAction(action.key)
                  return (
                    <td key={action.key} className="px-2 py-3 text-center">
                      {item ? (
                        <span className="inline-flex">
                          <MatrixCheckbox
                            checked={selected.has(item.code)}
                            onChange={(on) => toggle([item.code], on)}
                            disabled={readOnly}
                            label={`${group.groupName}: ${item.name}`}
                          />
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50" aria-label="Không áp dụng">
                          –
                        </span>
                      )}
                    </td>
                  )
                })}
                <td className="px-4 py-3">
                  {others.length > 0 ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {others.map((item) => (
                        <label key={item.code} className="flex cursor-pointer items-center gap-2 text-sm">
                          <MatrixCheckbox
                            checked={selected.has(item.code)}
                            onChange={(on) => toggle([item.code], on)}
                            disabled={readOnly}
                            label={`${group.groupName}: ${item.name}`}
                          />
                          {item.name}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/50" aria-hidden="true">
                      –
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
