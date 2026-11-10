import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

type Tone = 'accent' | 'muted' | 'warn' | 'signal'

const TONES: Record<Tone, string> = {
  accent: 'border-accent/25 bg-accent-soft text-accent',
  muted: 'border-line bg-transparent text-muted',
  warn: 'border-warn/30 bg-warn/5 text-warn',
  signal: 'border-signal/30 bg-signal/5 text-signal',
}

export function Badge({
  tone = 'muted',
  className,
  children,
}: {
  tone?: Tone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] leading-4',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
