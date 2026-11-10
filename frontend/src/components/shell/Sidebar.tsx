import type { ReactNode } from 'react'

import { X } from 'lucide-react'

import { useToast } from '@/components/ui/Toaster'
import { cn } from '@/lib/cn'
import type { DocumentMeta, Health } from '@/types'

import { DocumentList } from '../knowledge/DocumentList'
import { UploadDropzone } from '../knowledge/UploadDropzone'
import { IconButton } from '../ui/IconButton'
import { StatusDot, type DotState } from '../ui/StatusDot'
import { BrandMark } from './BrandMark'

export function Sidebar({
  documents,
  loading,
  offline,
  health,
  onUpload,
  onDelete,
  onClose,
}: {
  documents: DocumentMeta[]
  loading: boolean
  offline: boolean
  health: Health | null
  onUpload: (file: File) => Promise<unknown>
  onDelete: (id: string) => Promise<void>
  onClose?: () => void
}) {
  const toast = useToast()
  const chunks = documents.reduce(
    (sum, doc) => sum + (doc.status === 'ready' ? doc.chunks : 0),
    0,
  )

  const ollamaState: DotState = !health
    ? 'idle'
    : health.ollama.reachable
      ? 'ok'
      : 'error'
  const redisState: DotState = !health
    ? 'idle'
    : health.redis.reachable
      ? 'ok'
      : 'error'

  return (
    <aside
      aria-label="知识库"
      className="flex h-full min-h-0 flex-col border-r border-rail-line bg-rail text-rail-ink"
    >
      <header className="flex h-16 shrink-0 items-center gap-2.5 border-b border-rail-line px-4">
        <BrandMark className="h-7 w-7" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[12.5px] font-semibold tracking-[0.18em] text-rail-ink">
              NEXUS
            </span>
            <span className="text-[11px] tracking-[0.24em] text-rail-muted">
              智询
            </span>
          </div>
          <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-rail-muted">
            本地知识问答
          </p>
        </div>

        {onClose ? (
          <IconButton
            tone="rail"
            label="关闭知识库"
            onClick={onClose}
            className="lg:hidden"
          >
            <X size={15} />
          </IconButton>
        ) : null}
      </header>

      <div className="scroll-rail min-h-0 flex-1 overflow-y-auto">
        <section className="px-4 pt-5">
          <SectionLabel right={<span>{offline ? '—' : documents.length}</span>}>
            知识库
          </SectionLabel>

          <UploadDropzone
            onUpload={onUpload}
            onError={(message) => toast(message, 'error')}
          />
        </section>

        <section className="mt-6 px-4 pb-6">
          <SectionLabel right={<span>{loading ? '同步中' : '按时间'}</span>}>
            文档
          </SectionLabel>

          <DocumentList
            documents={documents}
            loading={loading}
            onDelete={onDelete}
            onError={(message) => toast(message, 'error')}
          />
        </section>
      </div>

      <footer className="shrink-0 border-t border-rail-line px-4 pt-3.5 pb-4">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-rail-muted">
              文档
            </dt>
            <dd className="mt-1.5 font-mono text-[20px] leading-none tabular-nums text-rail-ink">
              {offline ? '—' : documents.length}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-rail-muted">
              分块
            </dt>
            <dd className="mt-1.5 font-mono text-[20px] leading-none tabular-nums text-rail-ink">
              {offline ? '—' : chunks}
            </dd>
          </div>
        </dl>

        <div className="mt-4 space-y-1.5 border-t border-rail-line pt-3 font-mono text-[9.5px] uppercase tracking-[0.12em] text-rail-muted">
          <StatusRow
            label="OLLAMA"
            state={ollamaState}
            value={health?.ollama.model ?? 'qwen2:1.5b'}
          />
          <StatusRow
            label="REDIS"
            state={redisState}
            value={health?.redis.version ? `v${health.redis.version}` : 'v5.0'}
          />
        </div>
      </footer>
    </aside>
  )
}

function SectionLabel({
  children,
  right,
}: {
  children: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.16em] text-rail-muted">
      <span>{children}</span>
      <span className="tabular-nums">{right}</span>
    </div>
  )
}

function StatusRow({
  label,
  state,
  value,
}: {
  label: string
  state: DotState
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      <StatusDot state={state} />
      <span>{label}</span>
      <span
        className={cn(
          'ml-auto max-w-[120px] truncate normal-case tracking-normal text-rail-muted/85',
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}
