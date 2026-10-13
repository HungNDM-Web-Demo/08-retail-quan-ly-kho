'use client'

import { useState } from 'react'
import { Database, Presentation, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { appConfig } from '@/config/app.config'
import { useDemoEnvironment } from '@/features/demo/hooks/use-demo'
import { ResetDataButton, ResetDataDialog } from './ResetDataButton'
import { RoleSwitcher } from './RoleSwitcher'
import { ThemePicker } from './ThemePicker'

/**
 * Thanh công cụ demo nổi góc dưới phải (SCR-SYS-07, KIEN-TRUC-HE-THONG §8.3):
 * đổi vai trò nhanh, đổi sáng/tối, thử màu thương hiệu, đặt lại dữ liệu.
 * Chỉ hiện khi NEXT_PUBLIC_DEMO_TOOLBAR=true.
 */
export function DemoToolbar() {
  if (!appConfig.demoToolbar) return null
  return <DemoToolbarPanel />
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 px-4 py-4">
      <h3 className="text-muted-foreground text-[0.6875rem] font-semibold tracking-wider uppercase">{title}</h3>
      {children}
    </section>
  )
}

function DemoToolbarPanel() {
  const [open, setOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const environment = useDemoEnvironment()

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="cta"
            className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 h-12 gap-2 rounded-full pr-5 pl-4 shadow-lg transition-shadow hover:shadow-xl"
            aria-label="Mở công cụ trình diễn"
          >
            <Presentation className="size-5" aria-hidden="true" />
            <span className="font-semibold">Demo</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={12}
          collisionPadding={16}
          className="w-[min(23rem,calc(100vw-2rem))] gap-0 overflow-y-auto p-0"
          style={{ maxHeight: 'min(40rem, calc(100dvh - 7rem))' }}
        >
          <div className="bg-popover sticky top-0 z-10 flex items-start justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold">Công cụ trình diễn</p>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Database className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {environment.label} · {environment.description}
                </span>
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" className="-mr-1 shrink-0" onClick={() => setOpen(false)} aria-label="Đóng">
              <X />
            </Button>
          </div>

          <Section title="Đổi vai trò nhanh">
            <RoleSwitcher onSwitched={() => setOpen(false)} />
          </Section>
          <Separator />
          <Section title="Giao diện">
            <ThemePicker />
          </Section>
          <Separator />
          <Section title="Dữ liệu">
            <ResetDataButton
              onRequest={() => {
                setOpen(false)
                setResetOpen(true)
              }}
            />
          </Section>
        </PopoverContent>
      </Popover>
      <ResetDataDialog open={resetOpen} onOpenChange={setResetOpen} />
    </>
  )
}
