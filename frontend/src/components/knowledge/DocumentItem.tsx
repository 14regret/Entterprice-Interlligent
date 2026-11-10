import { useState } from 'react'

import { Trash2 } from 'lucide-react'
import { m } from 'motion/react'

import { cn } from '@/lib/cn'
import { DUR, EASE_OUT } from '@/lib/motion'
import type { DocumentMeta, DocumentStatus } from '@/types'

import { StatusDot, type DotState } from '../ui/StatusDot'

const STATUS: Record<
  DocumentStatus,
  { dot: DotState; label: string; meta: string }
> = {
  ready: { dot: 'ok', label: '已索引', meta: '' },
  processing: { dot: 'busy', label: '解析中', meta: '正在分块与向量化' },
  failed: { dot: 'error', label: '失败', meta: '解析失败' },
}

export function DocumentItem({
  doc,
  onDelete,
  onError,
}: {
  doc: DocumentMeta
  onDelete: (id: string) => Promise<void>
  onError: (message: string) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const status = STATUS[doc.status]

  const meta =
    doc.status === 'ready'
      ? `${doc.pages} 页 · ${doc.chunks} 块`
      : (doc.error || status.meta)

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true)
      return
    }

    setDeleting(true)
    try {
      await onDelete(doc.id)
    } catch (err) {
      onError(err instanceof Error ? err.message : '删除失败，请重试')
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <m.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DUR.fast, ease: EASE_OUT }}
      className={cn('group relative', deleting && 'pointer-events-none opacity-40')}
    >
      <div className="flex items-start gap-2.5 py-2.5">
        <StatusDot state={status.dot} className="mt-[6px]" />

        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[12.5px] leading-4 text-rail-ink"
            title={doc.name}
          >
            {doc.name}
          </p>
          <p className="mt-1 flex items-center gap-1.5 font-mono text-[9.5px] tracking-[0.04em] text-rail-muted">
            <span>{status.label}</span>
            {meta ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{meta}</span>
              </>
            ) : null}
          </p>
          {doc.status === 'processing' ? (
            <span className="scan-line rail-scan mt-2" />
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void handleDelete()}
          onBlur={() => {
            if (!deleting) setConfirming(false)
          }}
          aria-label={
            confirming ? `确认删除 ${doc.name}` : `删除 ${doc.name}`
          }
          className={cn(
            'shrink-0 p-1 transition-opacity duration-150',
            confirming
              ? 'text-signal opacity-100'
              : 'text-rail-muted opacity-0 hover:text-rail-ink focus-visible:opacity-100 group-hover:opacity-100 max-lg:opacity-60',
          )}
        >
          {deleting ? (
            <span className="font-mono text-[9.5px]">删除中</span>
          ) : confirming ? (
            <span className="font-mono text-[9.5px] tracking-[0.08em]">确认</span>
          ) : (
            <Trash2 size={12} strokeWidth={1.8} />
          )}
        </button>
      </div>
    </m.li>
  )
}
