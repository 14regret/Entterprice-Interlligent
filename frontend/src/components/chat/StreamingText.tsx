import { useEffect, useRef, useState } from 'react'

import { useReducedMotion } from 'motion/react'

import { cn } from '@/lib/cn'

/**
 * Typewriter rendering driven by the SSE token stream.
 *
 * Tokens arrive in uneven network chunks, so the component keeps a reveal
 * pointer and advances it on rAF toward the latest target. That decouples the
 * visual cadence from transport jitter without ever inventing text.
 */
export function StreamingText({
  text,
  streaming,
  className,
}: {
  text: string
  streaming: boolean
  className?: string
}) {
  const reduce = useReducedMotion()
  const prefersStill = Boolean(reduce)

  const [visible, setVisible] = useState(() =>
    streaming && !prefersStill ? 0 : text.length,
  )
  const visibleRef = useRef(visible)
  const targetRef = useRef(text.length)
  targetRef.current = text.length

  useEffect(() => {
    if (prefersStill) {
      visibleRef.current = text.length
      setVisible(text.length)
      return
    }

    let frame = 0

    const step = () => {
      const target = targetRef.current
      if (visibleRef.current < target) {
        const remaining = target - visibleRef.current
        const delta = Math.max(1, Math.ceil(remaining * 0.2))
        visibleRef.current = Math.min(target, visibleRef.current + delta)
        setVisible(visibleRef.current)
      } else if (!streaming) {
        return
      }
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [streaming, prefersStill, text.length])

  return (
    <span className={cn('whitespace-pre-wrap', className)}>
      {text.slice(0, Math.min(visible, text.length))}
      {streaming ? (
        <span className="type-caret" aria-hidden="true" />
      ) : null}
    </span>
  )
}
