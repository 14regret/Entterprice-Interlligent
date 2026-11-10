import { useMemo } from 'react'

import { ArrowRight, ArrowUpRight } from 'lucide-react'

import { StatusDot } from '@/components/ui/StatusDot'
import type { DocumentMeta } from '@/types'

export function EmptyChat({
  documents,
  offline,
  onPick,
  onOpenSidebar,
}: {
  documents: DocumentMeta[]
  offline: boolean
  onPick: (question: string) => void
  onOpenSidebar: () => void
}) {
  const ready = documents.filter((doc) => doc.status === 'ready')
  const processing = documents.some((doc) => doc.status === 'processing')
  const hasReady = ready.length > 0
  const chunks = ready.reduce((sum, doc) => sum + doc.chunks, 0)

  const prompts = useMemo(() => {
    const dynamic = buildPrompts(documents)
    return dynamic.length > 0 ? dynamic : FALLBACK_PROMPTS
  }, [documents])

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[860px] flex-col justify-center px-5 py-14 sm:px-6 xl:px-0">
      <h2 className="max-w-[19ch] text-[clamp(30px,3.4vw,42px)] leading-[1.1] font-medium tracking-[-0.02em] text-balance text-ink">
        问你的文档，
        <br />
        不是问互联网。
      </h2>

      <p className="mt-4 max-w-[52ch] text-[13.5px] leading-6 text-ink-2">
        答案只来自已入库资料，并逐条标注出处；资料里没有时，它会直接说不知道。
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
        <span className="flex items-center gap-1.5">
          <StatusDot
            state={offline ? 'error' : ready.length > 0 ? 'ok' : 'idle'}
          />
          {offline ? '未连接本地服务' : '本地知识库'}
        </span>
        <span aria-hidden="true" className="text-line-strong">
          /
        </span>
        <span>{offline ? '—' : `${documents.length} 份文档`}</span>
        <span aria-hidden="true" className="text-line-strong">
          /
        </span>
        <span>{offline ? '—' : `${chunks} 个片段`}</span>
        <span aria-hidden="true" className="hidden text-line-strong sm:inline">
          /
        </span>
        <span className="hidden sm:inline">nomic-embed-text</span>
      </div>

      {offline ? (
        <div className="mt-9 border-y border-line py-4">
          <p className="text-[13px] text-ink">没连上本地服务。</p>
          <p className="mt-1 max-w-[46ch] text-[12px] leading-5 text-muted">
            启动后端（127.0.0.1:8000）后刷新页面；知识库与模型状态会自动恢复。
          </p>
        </div>
      ) : (
        <>
          {documents.length === 0 ? (
            <div className="mt-9 border-y border-line py-4">
              <p className="text-[13px] text-ink">知识库还是空的。</p>
              <p className="mt-1 max-w-[46ch] text-[12px] leading-5 text-muted">
                上传第一份 PDF。解析、分块与向量化完成后，问题才会得到有出处的回答。
              </p>
              <button
                type="button"
                onClick={onOpenSidebar}
                className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] text-accent uppercase transition-colors hover:text-ink lg:hidden"
              >
                打开知识库
                <ArrowRight size={12} strokeWidth={2} />
              </button>

              <p className="mt-3 hidden font-mono text-[10px] tracking-[0.12em] text-muted uppercase lg:block">
                在左侧知识库拖入或选择 PDF
              </p>
            </div>
          ) : !hasReady && processing ? (
            <div className="mt-9 flex items-center gap-3 border-y border-line py-4">
              <span className="text-[12px] text-muted">
                正在建立索引，完成后即可提问
              </span>
              <span className="scan-line w-24" />
            </div>
          ) : null}

          <div className="mt-8 border-y border-line">
            <div className="flex items-baseline justify-between py-2">
              <span className="font-mono text-[9.5px] tracking-[0.16em] text-muted uppercase">
                {hasReady ? '从一份文档开始' : '示例问题'}
              </span>
              <span className="font-mono text-[9.5px] text-muted">ENTER</span>
            </div>

            <ul>
              {prompts.map((prompt) => (
                <li key={prompt} className="border-t border-line">
                  <button
                    type="button"
                    onClick={() => onPick(prompt)}
                    className="group flex w-full items-center justify-between gap-5 py-3 text-left transition-colors hover:bg-surface"
                  >
                    <span className="text-pretty text-[13px] leading-5 text-ink-2 transition-colors group-hover:text-ink">
                      {prompt}
                    </span>
                    <ArrowUpRight
                      size={13}
                      strokeWidth={1.8}
                      className="shrink-0 text-muted transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                    />
                  </button>
                </li>
              ))}
            </ul>

            {!hasReady ? (
              <p className="border-t border-line py-2 font-mono text-[9.5px] tracking-[0.04em] text-muted">
                先上传资料，示例问题才会得到带出处的回答。
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

const FALLBACK_PROMPTS = [
  '如何配置本地 Ollama 模型？',
  '知识库支持哪些文档格式？',
  '引用编号怎么对应到原文？',
]

function buildPrompts(documents: DocumentMeta[]): string[] {
  const names = documents
    .filter((doc) => doc.status === 'ready')
    .slice(0, 2)
    .map((doc) => shorten(doc.name))

  if (names.length >= 2) {
    return [
      `「${names[0]}」的核心规定有哪些？`,
      `「${names[1]}」里有哪些时限和审批环节？`,
      `对比「${names[0]}」与「${names[1]}」的差异`,
    ]
  }

  if (names.length === 1) {
    return [
      `「${names[0]}」的核心内容是什么？`,
      `把「${names[0]}」总结成五条要点`,
      `「${names[0]}」里有哪些责任人？`,
    ]
  }

  return []
}

function shorten(name: string) {
  const base = name.replace(/\.pdf$/i, '')
  return base.length > 16 ? `${base.slice(0, 16)}…` : base
}
