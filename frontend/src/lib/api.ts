import type {
  ChatRequestBody,
  Citation,
  DocumentMeta,
  Health,
} from '@/types'

import { readSseStream } from './sse'

const rawBase = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
const BASE = rawBase.replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status?: number
  readonly code?: string

  constructor(
    message: string,
    options: { status?: number; code?: string } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code
  }
}

export type ChatStreamEvent =
  | { type: 'meta'; citations: Citation[]; cached: boolean }
  | { type: 'token'; text: string }
  | { type: 'done'; answerId?: string; elapsedMs?: number }
  | { type: 'error'; code?: string; message: string }

export async function* streamChat(
  body: ChatRequestBody,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent, void, void> {
  const response = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) throw await toApiError(response)
  if (!response.body) {
    throw new ApiError('浏览器没有收到流式响应体', { status: response.status })
  }

  for await (const frame of readSseStream(response.body)) {
    const payload = parseData(frame.data)

    switch (frame.event) {
      case 'meta':
        yield {
          type: 'meta',
          citations: Array.isArray(payload?.citations)
            ? (payload.citations as Citation[])
            : [],
          cached: Boolean(payload?.cached),
        }
        break

      case 'token':
        yield { type: 'token', text: String(payload?.t ?? '') }
        break

      case 'done':
        yield {
          type: 'done',
          answerId: typeof payload?.answerId === 'string' ? payload.answerId : undefined,
          elapsedMs:
            typeof payload?.elapsedMs === 'number' ? payload.elapsedMs : undefined,
        }
        break

      case 'error':
        yield {
          type: 'error',
          code: typeof payload?.code === 'string' ? payload.code : undefined,
          message:
            typeof payload?.message === 'string'
              ? payload.message
              : '生成过程中断，请重试',
        }
        break

      default:
        break
    }
  }
}

export async function uploadPdf(file: File): Promise<DocumentMeta> {
  const form = new FormData()
  form.append('file', file)

  const response = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    body: form,
  })

  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as DocumentMeta
}

export async function listDocuments(): Promise<DocumentMeta[]> {
  const response = await fetch(`${BASE}/api/documents`, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) throw await toApiError(response)
  const payload = await response.json()
  return Array.isArray(payload) ? (payload as DocumentMeta[]) : []
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`${BASE}/api/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })

  if (!response.ok) throw await toApiError(response)
}

export async function getHealth(): Promise<Health> {
  const response = await fetch(`${BASE}/api/health`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(4000),
  })

  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as Health
}

function parseData(data: string): Record<string, unknown> | null {
  if (!data) return null
  try {
    const parsed: unknown = JSON.parse(data)
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = `请求失败（HTTP ${response.status}）`
  let code: string | undefined

  try {
    const payload = (await response.json()) as {
      detail?: string
      message?: string
      code?: string
    }
    message = payload.message ?? payload.detail ?? message
    code = payload.code
  } catch {
    // Non-JSON error body: keep the status-based message.
  }

  return new ApiError(message, { status: response.status, code })
}
