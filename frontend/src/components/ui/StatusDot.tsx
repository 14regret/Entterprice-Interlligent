import { cn } from '@/lib/cn'

export type DotState = 'ok' | 'warn' | 'error' | 'idle' | 'busy'

const COLORS: Record<DotState, string> = {
  ok: 'bg-accent-2',
  warn: 'bg-warn',
  error: 'bg-signal',
  idle: 'bg-rail-muted/55',
  busy: 'animate-[soft-pulse_1.6s_ease-in-out_infinite] bg-warn',
}

export function StatusDot({
  state,
  className,
}: {
  state: DotState
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-[5px] w-[5px] shrink-0 rounded-[1px]',
        COLORS[state],
        className,
      )}
    />
  )
}
