import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

import { DUR, EASE_OUT } from '@/lib/motion'

export function AppShell({
  sidebar,
  drawerSidebar,
  sidebarOpen,
  onCloseSidebar,
  children,
}: {
  sidebar: ReactNode
  drawerSidebar: ReactNode
  sidebarOpen: boolean
  onCloseSidebar: () => void
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  const slide = reduce ? 0 : -18

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <div className="hidden w-[308px] shrink-0 lg:block">{sidebar}</div>

      <AnimatePresence>
        {sidebarOpen ? (
          <m.div
            key="sidebar-drawer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.fast }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            <button
              type="button"
              aria-label="关闭知识库"
              onClick={onCloseSidebar}
              className="absolute inset-0 bg-rail/60"
            />

            <m.div
              initial={{ x: slide, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: slide, opacity: 0 }}
              transition={{ duration: reduce ? 0 : DUR.base, ease: EASE_OUT }}
              className="relative h-full w-[308px] max-w-[86vw]"
            >
              {drawerSidebar}
            </m.div>
          </m.div>
        ) : null}
      </AnimatePresence>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
