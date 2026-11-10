import { cn } from '@/lib/cn'

/**
 * Brand mark: an index spine with entry rules — the same geometry as the
 * favicon, so the browser tab and the rail read as one system.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Nexus 智询"
      className={cn('shrink-0', className)}
    >
      <rect width="32" height="32" rx="2" fill="currentColor" className="text-rail-2" />
      <path d="M10 8v16" stroke="var(--color-accent-2)" strokeWidth="2" />
      <path
        d="M10 11h5M10 16h10M10 21h4"
        stroke="var(--color-rail-ink)"
        strokeWidth="2"
      />
    </svg>
  )
}
