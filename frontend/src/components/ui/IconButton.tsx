import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

type Tone = 'default' | 'rail'

export function IconButton({
  label,
  tone = 'default',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  tone?: Tone
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xs transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-35',
        tone === 'rail'
          ? 'text-rail-muted hover:bg-rail-2 hover:text-rail-ink'
          : 'text-muted hover:bg-raise hover:text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
