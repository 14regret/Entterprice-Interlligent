import { AnimatePresence } from 'motion/react'

import type { DocumentMeta } from '@/types'

import { DocumentItem } from './DocumentItem'

export function DocumentList({
  documents,
  loading,
  onDelete,
  onError,
}: {
  documents: DocumentMeta[]
  loading: boolean
  onDelete: (id: string) => Promise<void>
  onError: (message: string) => void
}) {
  if (loading && documents.length === 0) {
    return (
      <p className="mt-3 font-mono text-[10px] tracking-[0.08em] text-rail-muted">
        读取索引…
      </p>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="mt-2 py-2">
        <p className="text-[12px] text-rail-ink/90">还没有文档</p>
        <p className="mt-1 text-[11px] leading-4 text-rail-muted">
          上传第一份 PDF，索引完成后即可提问。
        </p>
      </div>
    )
  }

  return (
    <ul className="mt-1 divide-y divide-rail-line/60 border-t border-rail-line/60">
      <AnimatePresence initial={false}>
        {documents.map((doc) => (
          <DocumentItem
            key={doc.id}
            doc={doc}
            onDelete={onDelete}
            onError={onError}
          />
        ))}
      </AnimatePresence>
    </ul>
  )
}
