import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'

import { ArrowUp, Paperclip, Square } from 'lucide-react'
import { m, useReducedMotion } from 'motion/react'

import { cn } from '@/lib/cn'
import { describeError } from '@/lib/errors'
import { validatePdf } from '@/lib/pdf'

const WAVE_SEGMENTS = 40

/**
 * Six faint dust motes, deliberately fewer than the source prototype.
 * They sit behind the text at 10% opacity; only drift while the composer is
 * focused or the model is generating.
 */
const DUST = [
  { left: '7%', top: '26%', delay: 0, duration: 8 },
  { left: '21%', top: '68%', delay: 1.4, duration: 10 },
  { left: '43%', top: '22%', delay: 2.8, duration: 9 },
  { left: '64%', top: '72%', delay: 0.7, duration: 11 },
  { left: '83%', top: '32%', delay: 1.9, duration: 8.5 },
  { left: '94%', top: '62%', delay: 3.1, duration: 9.5 },
]

export function Composer({
  busy,
  onSend,
  onStop,
  onUpload,
  onError,
}: {
  busy: boolean
  onSend: (question: string) => void
  onStop: () => void
  onUpload: (file: File) => Promise<unknown>
  onError: (message: string) => void
}) {
  const [value, setValue] = useState('')
  const [uploading, setUploading] = useState(false)
  const [focused, setFocused] = useState(false)
  const [flareId, setFlareId] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const reduce = useReducedMotion()

  const active = focused || busy

  const wavePath = useMemo(() => {
    let path = 'M 0 4 q 15 -4 30 0'
    for (let index = 1; index < WAVE_SEGMENTS; index += 1) {
      path += ' t 30 0'
    }
    return path
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  function submit() {
    const question = value.trim()
    if (!question || busy) return
    setValue('')
    onSend(question)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing) return
    event.preventDefault()
    submit()
  }

  function handlePointerEnter(event: PointerEvent<HTMLDivElement>) {
    // One sweep per mouse entry. Touch and reduced-motion users get none.
    if (reduce || event.pointerType !== 'mouse') return
    setFlareId((current) => current + 1)
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null
    if (!next || !event.currentTarget.contains(next)) setFocused(false)
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const problem = validatePdf(file)
    if (problem) {
      onError(problem)
      event.target.value = ''
      return
    }

    setUploading(true)
    try {
      await onUpload(file)
    } catch (err) {
      onError(describeError(err))
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const canSend = value.trim().length > 0 && !busy

  return (
    <footer className="shrink-0 bg-canvas px-5 pt-4 pb-3 lg:px-6">
      <div className="mx-auto w-full max-w-[860px]">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => void handleFile(event)}
        />

        <div
          onPointerEnter={handlePointerEnter}
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={handleBlur}
          className={cn(
            'relative overflow-hidden rounded-xs border bg-rail transition-colors duration-200',
            active ? 'border-accent' : 'border-rail-line',
          )}
        >
          {/* Faint dust, behind the text, never interactive. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {DUST.map((mote) => (
              <m.span
                key={`${mote.left}-${mote.top}`}
                initial={false}
                animate={
                  active && !reduce
                    ? { y: [0, -5, 0], opacity: [0.1, 0.18, 0.1] }
                    : { y: 0, opacity: 0.1 }
                }
                transition={
                  active && !reduce
                    ? {
                        duration: mote.duration,
                        delay: mote.delay,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }
                    : { duration: 0.2 }
                }
                style={{ left: mote.left, top: mote.top }}
                className="absolute h-[2px] w-[2px] rounded-full bg-accent-2"
              />
            ))}
          </div>

          {/* One slow hover sweep; remounts on each mouse entry. */}
          {flareId > 0 && !reduce ? (
            <m.span
              key={flareId}
              aria-hidden="true"
              initial={{ x: '-130%' }}
              animate={{ x: '430%' }}
              transition={{ duration: 1.9, ease: 'easeInOut' }}
              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-accent-2/20 to-transparent"
            />
          ) : null}

          {/* Border light, only while generating. */}
          {busy && !reduce ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px overflow-hidden"
            >
              <m.span
                animate={{ x: ['-100%', '400%'] }}
                transition={{ duration: 2.8, ease: 'linear', repeat: Infinity }}
                className="block h-px w-1/3 bg-linear-to-r from-transparent via-accent-2/80 to-transparent"
              />
            </div>
          ) : null}

          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            maxLength={2000}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="问一个问题，回答会标注出处…"
            aria-label="问题"
            className={cn(
              'relative z-10 block max-h-40 w-full resize-none bg-transparent',
              'px-3.5 pt-3 pb-2 text-[13.5px] leading-6 text-rail-ink',
              'caret-[#3fa98f] outline-none placeholder:text-rail-muted',
              'focus-visible:outline-none',
            )}
          />

          {/* The divider is a hairline; the wave is a low-opacity signal over it. */}
          <div aria-hidden="true" className="relative h-2 overflow-hidden">
            <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rail-line/70" />
            <svg
              viewBox="0 0 1200 8"
              preserveAspectRatio="none"
              className={cn(
                'absolute inset-y-0 left-0 h-2 w-[200%] text-accent-2 transition-opacity duration-300',
                active ? 'opacity-45' : 'opacity-15',
                active && !reduce && 'wave-flow',
              )}
            >
              <path
                d={wavePath}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          <div className="relative z-10 flex items-center justify-between gap-2 bg-white/[0.02] px-2 py-2">
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label="上传 PDF"
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xs',
                  'text-rail-muted transition-colors duration-150',
                  'hover:bg-rail-2 hover:text-rail-ink',
                  'disabled:pointer-events-none disabled:opacity-40',
                )}
              >
                <Paperclip size={14} strokeWidth={1.8} />
              </button>

              <span
                className={cn(
                  'hidden truncate font-mono text-[9.5px] tracking-[0.08em] uppercase sm:inline',
                  value.length > 1600 ? 'text-[#d8a24a]' : 'text-rail-muted/85',
                )}
              >
                {uploading
                  ? '正在解析 PDF…'
                  : busy
                    ? '生成中 · 可随时停止'
                    : 'Enter 发送 · Shift+Enter 换行'}
              </span>

              {value.length > 1600 ? (
                <span className="font-mono text-[9.5px] text-[#d8a24a] sm:hidden">
                  {value.length} / 2000
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5">
              {busy ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="flex h-8 items-center gap-1.5 rounded-xs px-2 text-[12px] text-rail-muted transition-colors duration-150 hover:bg-rail-2 hover:text-rail-ink"
                >
                  <Square size={9} fill="currentColor" />
                  停止
                </button>
              ) : null}

              <m.button
                type="button"
                onClick={submit}
                disabled={!canSend}
                aria-label="发送问题"
                whileHover={canSend && !reduce ? { scale: 1.04 } : undefined}
                whileTap={canSend && !reduce ? { scale: 0.95 } : undefined}
                transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.6 }}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-xs',
                  'transition-[filter,background-color] duration-150',
                  canSend
                    ? 'bg-accent text-canvas hover:brightness-110'
                    : 'cursor-not-allowed bg-rail-2 text-rail-muted/50',
                )}
              >
                <ArrowUp size={15} strokeWidth={2} />
              </m.button>
            </div>
          </div>
        </div>

        <p className="mt-2 flex items-center justify-between gap-4 font-mono text-[9.5px] tracking-[0.08em] text-muted">
          <span>由本地 qwen2:1.5b 生成 · 请核对引用原文</span>
          <span className="hidden uppercase sm:inline">LOCAL / 127.0.0.1</span>
        </p>
      </div>
    </footer>
  )
}
