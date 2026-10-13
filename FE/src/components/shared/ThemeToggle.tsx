'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Nút chuyển nhanh sáng/tối (FR-SYS-14). Icon đổi bằng CSS nên không lệch khi hydrate. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const label = isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={label}
        >
          <Sun className="hidden size-[1.15rem] dark:block" aria-hidden="true" />
          <Moon className="size-[1.15rem] dark:hidden" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Giao diện sáng/tối</TooltipContent>
    </Tooltip>
  )
}
