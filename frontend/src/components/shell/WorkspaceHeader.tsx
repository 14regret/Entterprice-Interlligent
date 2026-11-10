import { Menu, Plus } from 'lucide-react'

import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'

export function WorkspaceHeader({
  sessionId,
  model,
  documentCount,
  onNew,
  onOpenSidebar,
}: {
  sessionId: string
  model: string
  documentCount: number
  onNew: () => void
  onOpenSidebar: () => void
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-canvas px-4 lg:px-6">
      <IconButton
        label="打开知识库"
        onClick={onOpenSidebar}
        className="lg:hidden"
      >
        <Menu size={16} />
      </IconButton>

      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="text-[13px] font-medium text-ink">对话</h1>
        <span className="font-mono text-[9.5px] tracking-[0.08em] text-muted">
          <span className="text-muted/70">SID</span> {sessionId.slice(0, 8)}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3 lg:gap-4">
        <dl className="hidden items-center gap-4 font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted md:flex">
          <div className="flex items-baseline gap-1.5">
            <dt>Model</dt>
            <dd className="normal-case tracking-normal text-ink-2">{model}</dd>
          </div>
          <span aria-hidden="true" className="h-3 w-px bg-line" />
          <div className="flex items-baseline gap-1.5">
            <dt>Docs</dt>
            <dd className="tabular-nums text-ink-2">{documentCount}</dd>
          </div>
          <span aria-hidden="true" className="h-3 w-px bg-line" />
          <div className="flex items-baseline gap-1.5">
            <dt>Memory</dt>
            <dd className="text-ink-2">6 轮</dd>
          </div>
        </dl>

        <Button variant="outline" size="sm" onClick={onNew}>
          <Plus size={13} strokeWidth={2} />
          新对话
        </Button>
      </div>
    </header>
  )
}
