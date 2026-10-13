'use client'

import { cloneElement, isValidElement, useId } from 'react'
import { AlertCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type FormFieldProps = {
  label: string
  /** id của ô nhập; bỏ trống thì tự sinh và gắn vào phần tử con */
  htmlFor?: string
  required?: boolean
  /** Gợi ý dưới ô (ẩn khi có lỗi) */
  hint?: React.ReactNode
  /** Thông báo lỗi hiển thị ngay dưới ô */
  error?: string
  className?: string
  children: React.ReactElement<Record<string, unknown>>
}

/**
 * Nhãn + ô nhập + gợi ý/lỗi ngay dưới ô. Tự gắn id, aria-invalid, aria-describedby
 * cho phần tử con để trình đọc màn hình đọc được lỗi.
 */
export function FormField({ label, htmlFor, required, hint, error, className, children }: FormFieldProps) {
  const autoId = useId()
  const id = htmlFor ?? (children.props.id as string | undefined) ?? autoId
  const messageId = `${id}-message`
  const hasMessage = !!error || !!hint

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': hasMessage ? messageId : undefined,
        'aria-required': required || undefined,
      })
    : children

  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id} className="text-foreground">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {control}
      {error ? (
        <p id={messageId} role="alert" className="text-destructive flex items-start gap-1 text-[0.8125rem]">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-muted-foreground text-[0.8125rem]">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
