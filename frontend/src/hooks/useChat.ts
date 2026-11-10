import { useCallback, useRef, useState } from 'react'

import { ApiError, streamChat } from '@/lib/api'
import { describeError } from '@/lib/errors'
import type { ChatMessage } from '@/types'

export type ChatPhase = 'idle' | 'sending' | 'streaming'

function newId() {
  return crypto.randomUUID()
}

export function useChat() {
  const [sessionId, setSessionId] = useState<string>(newId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [phase, setPhase] = useState<ChatPhase>('idle')
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const busyRef = useRef(false)
  const sessionRef = useRef(sessionId)
  sessionRef.current = sessionId

  const send = useCallback(async (raw: string) => {
    const question = raw.trim()
    if (!question || busyRef.current) return

    busyRef.current = true
    setError(null)
    setPhase('sending')

    const assistantId = newId()
    const createdAt = Date.now()

    setMessages((prev) => [
      ...prev,
      {
        id: newId(),
        role: 'user',
        content: question,
        citations: [],
        status: 'done',
        createdAt,
      },
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        citations: [],
        status: 'pending',
        createdAt,
      },
    ])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      for await (const event of streamChat(
        { sessionId: sessionRef.current, question },
        controller.signal,
      )) {
        switch (event.type) {
          case 'meta':
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      citations: event.citations,
                      cached: event.cached,
                    }
                  : message,
              ),
            )
            break

          case 'token':
            setPhase('streaming')
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content: message.content + event.text,
                      status: 'streaming',
                    }
                  : message,
              ),
            )
            break

          case 'done':
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      status: 'done',
                      elapsedMs: event.elapsedMs,
                    }
                  : message,
              ),
            )
            break

          case 'error':
            throw new ApiError(event.message, { code: event.code })
        }
      }

      // A stream can close without an explicit `done` frame.
      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== assistantId) return message
          if (message.status === 'error' || message.status === 'stopped') {
            return message
          }
          if (!message.content.trim()) {
            return { ...message, status: 'error', error: '模型没有返回内容，请重试' }
          }
          return { ...message, status: 'done' }
        }),
      )
    } catch (err) {
      if (controller.signal.aborted) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, status: 'stopped' }
              : message,
          ),
        )
      } else {
        const message = describeError(err)
        setError(message)
        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantId
              ? { ...item, status: 'error', error: message }
              : item,
          ),
        )
      }
    } finally {
      busyRef.current = false
      abortRef.current = null
      setPhase('idle')
    }
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    busyRef.current = false
    setSessionId(newId())
    setMessages([])
    setError(null)
    setPhase('idle')
  }, [])

  return {
    sessionId,
    messages,
    phase,
    error,
    isBusy: phase !== 'idle',
    send,
    stop,
    reset,
  }
}
