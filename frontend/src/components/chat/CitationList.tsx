import type { Citation } from '@/types'

export function CitationList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null

  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-line pb-1.5">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted">
          依据 / SRC
        </span>
        <span className="font-mono text-[9.5px] tabular-nums text-muted">
          {String(citations.length).padStart(2, '0')}
        </span>
      </div>

      <ol className="mt-1">
        {citations.map((citation, index) => (
          <li
            key={citation.id || `${citation.docId}-${citation.chunkId}-${index}`}
            className="border-b border-line/60 py-2 last:border-b-0"
          >
            <div className="flex gap-2">
              <span className="mt-px font-mono text-[10px] leading-4 text-accent">
                [{index + 1}]
              </span>
              <div className="min-w-0">
                <p
                  className="truncate text-[11.5px] leading-4 text-ink-2"
                  title={citation.docName}
                >
                  {citation.docName}
                </p>
                <p className="mt-0.5 font-mono text-[9.5px] tracking-[0.03em] text-muted">
                  p.{citation.page} · 相关度 {citation.score.toFixed(2)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
