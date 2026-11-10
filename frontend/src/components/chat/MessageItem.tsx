import { useReducedMotion } from 'motion/react'
import { m } from 'motion/react'

import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import {
  DUR,
  EASE_OUT,
  messageEnter,
  messageEnterReduced,
} from '@/lib/motion'
import type { ChatMessage } from '@/types'

import { CitationList } from './CitationList'
import { StreamingText } from './StreamingText'

export function MessageItem({ message }: { message: ChatMessage }) {
  const reduce = useReducedMotion()
  const isUser = message.role === 'user'
  const streaming = message.status === 'streaming'
  const pending = message.status === 'pending'
  const showCitations =
    !isUser && message.content.length > 0 && message.citations.length > 0
  const showMeta =
    !isUser &&
    message.status === 'done' &&
    (typeof message.elapsedMs === 'number' || Boolean(message.cached))

  return (
    <m.article
      variants={reduce ? messageEnterReduced : messageEnter}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: DUR.base, ease: EASE_OUT }}
      aria-live={!isUser && message.status === 'done' ? 'polite' : 'off'}
      className="border-b border-line/70"
    >
      <div className="grid grid-cols-[38px_minmax(0,1fr)] gap-3 py-6 lg:grid-cols-[46px_minmax(0,1fr)] lg:gap-4">
        <div className="flex items-center gap-1.5 self-start pt-[5px] font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted">
          {!isUser ? (
            <span aria-hidden="true" className="h-[5px] w-[5px] bg-accent" />
          ) : null}
          <span>{isUser ? 'YOU' : 'NEXUS'}</span>
        </div>

        <div className="min-w-0">
          {isUser ? (
            <p className="w-fit max-w-[64ch] border border-line bg-surface px-3.5 py-2.5 text-[13.5px] leading-6 whitespace-pre-wrap text-ink">
              {message.content}
            </p>
          ) : (
            <div className="grid gap-x-6 xl:grid-cols-[minmax(0,1fr)_196px]">
              <div className="min-w-0">
                {pending && !message.content ? (
                  <div className="flex items-center gap-3 py-0.5">
                    <span className="text-[12px] text-muted">正在检索片段</span>
                    <span className="scan-line w-20" />
                  </div>
                ) : (
                  <div className="max-w-[64ch] text-[14px] leading-7 text-ink-2">
                    <StreamingText
                      text={message.content}
                      streaming={streaming}
                    />
                  </div>
                )}

                {message.status === 'stopped' ? (
                  <div className="mt-2">
                    <Badge tone="muted">已停止</Badge>
                  </div>
                ) : null}

                {message.status === 'error' ? (
                  <div
                    role="alert"
                    className={cn(
                      'mt-1 border border-signal/35 bg-signal/[0.04] px-3 py-2.5',
                      'text-[12px] leading-5 text-signal',
                    )}
                  >
                    {message.error ?? '生成失败，请重试'}
                  </div>
                ) : null}

                {showCitations ? (
                  <div className="mt-5 xl:hidden">
                    <CitationList citations={message.citations} />
                  </div>
                ) : null}

                {showMeta ? (
                  <div className="mt-3 flex items-center gap-3 font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted">
                    {message.cached ? (
                      <span className="text-accent">CACHE HIT</span>
                    ) : null}
                    {typeof message.elapsedMs === 'number' ? (
                      <span className="tabular-nums normal-case">
                        耗时 {formatElapsed(message.elapsedMs)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {showCitations ? (
                <aside className="hidden border-l border-line pl-4 xl:block">
                  <CitationList citations={message.citations} />
                </aside>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </m.article>
  )
}

function formatElapsed(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
