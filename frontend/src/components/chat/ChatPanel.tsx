import { useCallback } from 'react'

import { ChevronDown } from 'lucide-react'
import { m } from 'motion/react'

import { useAutoScroll } from '@/hooks/useAutoScroll'
import { DUR, EASE_OUT } from '@/lib/motion'
import type { ChatMessage, DocumentMeta, Health } from '@/types'

import { WorkspaceHeader } from '../shell/WorkspaceHeader'
import { Composer } from './Composer'
import { EmptyChat } from './EmptyChat'
import { MessageList } from './MessageList'
import type { ChatPhase } from '@/hooks/useChat'

export function ChatPanel({
  messages,
  phase,
  sessionId,
  documents,
  health,
  offline,
  onSend,
  onStop,
  onReset,
  onUpload,
  onOpenSidebar,
  onError,
}: {
  messages: ChatMessage[]
  phase: ChatPhase
  sessionId: string
  documents: DocumentMeta[]
  health: Health | null
  offline: boolean
  onSend: (question: string) => void
  onStop: () => void
  onReset: () => void
  onUpload: (file: File) => Promise<unknown>
  onOpenSidebar: () => void
  onError: (message: string) => void
}) {
  const { ref, onScroll, onWheel, onTouchStart, onTouchMove, atBottom, scrollToBottom } =
    useAutoScroll(messages)
  const busy = phase !== 'idle'
  const isEmpty = messages.length === 0
  const showJump = !isEmpty && !atBottom

  const handleSend = useCallback(
    (question: string) => {
      // Sending is an explicit intent to see the new turn; jump immediately so
      // a smooth animation cannot fight the user during the stream.
      scrollToBottom('auto')
      onSend(question)
    },
    [onSend, scrollToBottom],
  )

  return (
    <section className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col bg-canvas">
      <WorkspaceHeader
        sessionId={sessionId}
        model={health?.ollama.model ?? 'qwen2:1.5b'}
        documentCount={documents.length}
        onNew={onReset}
        onOpenSidebar={onOpenSidebar}
      />

      <div
        ref={ref}
        onScroll={onScroll}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        role="region"
        aria-label="对话记录"
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ scrollbarGutter: 'stable' }}
      >
        {isEmpty ? (
          <EmptyChat
            documents={documents}
            offline={offline}
            onPick={handleSend}
            onOpenSidebar={onOpenSidebar}
          />
        ) : (
          <MessageList messages={messages} />
        )}

        {showJump ? (
          <div className="pointer-events-none sticky bottom-3 z-10 flex justify-center">
            <m.button
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.fast, ease: EASE_OUT }}
              onClick={() => scrollToBottom()}
              className="pointer-events-auto inline-flex items-center gap-1.5 border border-line-strong bg-surface px-2.5 py-1.5 font-mono text-[9px] tracking-[0.12em] text-ink-2 uppercase transition-colors hover:border-ink hover:text-ink"
            >
              回到最新
              <ChevronDown size={11} strokeWidth={2} />
            </m.button>
          </div>
        ) : null}
      </div>

      <Composer
        busy={busy}
        onSend={handleSend}
        onStop={onStop}
        onUpload={onUpload}
        onError={onError}
      />
    </section>
  )
}
