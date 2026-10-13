'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Ô mật khẩu có nút hiện/ẩn. */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md transition-colors outline-none focus-visible:ring-3"
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-pressed={visible}
        tabIndex={props.disabled ? -1 : 0}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
