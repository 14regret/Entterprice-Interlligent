import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

type Variant = 'primary' | 'outline' | 'ghost' | 'signal'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-surface hover:bg-accent',
  outline:
    'border border-line-strong text-ink-2 hover:border-ink hover:text-ink',
  ghost: 'text-ink-2 hover:bg-raise hover:text-ink',
  signal: 'border border-signal/40 text-signal hover:bg-signal/5',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-[12px]',
  md: 'h-9 px-3.5 text-[12.5px]',
}

export function Button({
  className,
  variant = 'outline',
  size = 'md',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xs font-medium transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
}
