import type { Transition } from 'motion/react'

/**
 * Motion tokens. Everything animated in the app reads from here so the
 * MotionSites pass can swap values in one place instead of hunting magic
 * numbers across components.
 */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const
export const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const

export const DUR = {
  instant: 0.12,
  fast: 0.18,
  base: 0.26,
  slow: 0.42,
} as const

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.7,
}

export const messageEnter = {
  initial: { opacity: 0, y: 8, filter: 'blur(3px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -4, filter: 'blur(2px)' },
}

export const messageEnterReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const rowEnter = {
  initial: { opacity: 0, x: -4 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, height: 0 },
}
