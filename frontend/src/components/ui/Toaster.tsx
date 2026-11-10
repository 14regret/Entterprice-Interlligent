import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'

import { AnimatePresence, m } from 'motion/react'

import { cn } from '@/lib/cn'
import { DUR, EASE_OUT } from '@/lib/motion'

type ToastTone = 'info' | 'success' | 'error'

interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

type PushToast = (message: string, tone?: ToastTone) => void

const ToastContext = createContext<PushToast | null>(null)

export function useToast(): PushToast {
  const push = useContext(ToastContext)
  if (!push) throw new Error('useToast 必须在 <ToastProvider> 内使用')
  return push
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const push = useCallback<PushToast>((message, tone = 'info') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 4600)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}

      <div
        aria-live="polite"
        className="pointer-events-none fixed right-5 bottom-5 z-[60] flex w-[min(360px,calc(100vw-2.5rem))] flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <m.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 8, filter: 'blur(2px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: DUR.base, ease: EASE_OUT }}
              className="pointer-events-auto flex items-start gap-2.5 border border-rail-line bg-rail px-3 py-2.5 text-[12px] leading-5 text-rail-ink"
            >
              <span
                className={cn(
                  'mt-[7px] h-[5px] w-[5px] shrink-0',
                  toast.tone === 'error'
                    ? 'bg-signal'
                    : toast.tone === 'success'
                      ? 'bg-accent-2'
                      : 'bg-rail-muted',
                )}
              />
              <span className="min-w-0">{toast.message}</span>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
