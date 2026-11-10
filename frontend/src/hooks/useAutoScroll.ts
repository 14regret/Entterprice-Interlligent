import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchEvent,
  type WheelEvent,
} from 'react'

/**
 * Keeps the transcript pinned to the newest content while the user is already
 * at the bottom, and yields immediately once they scroll up to read.
 *
 * `stick` covers "near the bottom"; `paused` is the user-intent latch set by a
 * wheel-up or a downward touch drag. The latch is only cleared when the user
 * returns to the bottom or explicitly jumps there.
 */
export function useAutoScroll(dependency: unknown) {
  const ref = useRef<HTMLDivElement | null>(null)
  const stick = useRef(true)
  const paused = useRef(false)
  const touchY = useRef(0)
  const [atBottom, setAtBottom] = useState(true)

  const pause = useCallback(() => {
    paused.current = true
    stick.current = false
    setAtBottom(false)
  }, [])

  const onScroll = useCallback(() => {
    const el = ref.current
    if (!el) return

    const distance = el.scrollHeight - el.scrollTop - el.clientHeight

    if (distance < 72) {
      stick.current = true
      paused.current = false
      setAtBottom(true)
    } else {
      stick.current = false
      setAtBottom(false)
    }
  }, [])

  const onWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      // Scrolling toward older content, not just any wheel event.
      const el = ref.current
      if (!el || el.scrollTop <= 0) return
      if (event.deltaY < 0) pause()
    },
    [pause],
  )

  const onTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    touchY.current = event.touches[0]?.clientY ?? 0
  }, [])

  const onTouchMove = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      const el = ref.current
      if (!el || el.scrollTop <= 0) return

      const current = event.touches[0]?.clientY ?? 0
      // Finger moving down means the content is moving toward older messages.
      if (current > touchY.current + 4) pause()
      touchY.current = current
    },
    [pause],
  )

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = ref.current
    if (!el) return

    el.scrollTo({ top: el.scrollHeight, behavior })
    stick.current = true
    paused.current = false
    setAtBottom(true)
  }, [])

  useEffect(() => {
    if (!stick.current || paused.current) return

    const el = ref.current
    if (!el) return

    el.scrollTop = el.scrollHeight
  }, [dependency])

  return {
    ref,
    onScroll,
    onWheel,
    onTouchStart,
    onTouchMove,
    atBottom,
    scrollToBottom,
  }
}
