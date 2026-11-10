export type MessageRole = 'user' | 'assistant'

export type MessageStatus = 'pending' | 'streaming' | 'done' | 'stopped' | 'error'

export interface Citation {
  id: string
  docId: string
  docName: string
  page: number
  chunkId: string
  score: number
  snippet?: string
}

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  citations: Citation[]
  status: MessageStatus
  cached?: boolean
  elapsedMs?: number
  error?: string
  createdAt: number
}

export type DocumentStatus = 'processing' | 'ready' | 'failed'

export interface DocumentMeta {
  id: string
  name: string
  pages: number
  chunks: number
  sizeBytes: number
  status: DocumentStatus
  uploadedAt: string
  error?: string
}

export interface Health {
  status: 'ok' | 'degraded' | 'offline'
  ollama: { reachable: boolean; model: string }
  redis: { reachable: boolean; version?: string }
  index: { documents: number; chunks: number }
}

export interface ChatRequestBody {
  sessionId: string
  question: string
}
