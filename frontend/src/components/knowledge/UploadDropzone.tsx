import { useRef, useState, type DragEvent } from 'react'

import { Upload } from 'lucide-react'

import { cn } from '@/lib/cn'
import { validatePdf } from '@/lib/pdf'

export function UploadDropzone({
  onUpload,
  onError,
}: {
  onUpload: (file: File) => Promise<unknown>
  onError: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  async function accept(file: File | undefined) {
    if (!file) return

    const problem = validatePdf(file)
    if (problem) {
      onError(problem)
      return
    }

    setBusy(true)
    try {
      await onUpload(file)
    } catch (err) {
      onError(err instanceof Error ? err.message : '上传失败，请重试')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setDragging(false)
    void accept(event.dataTransfer.files?.[0])
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => void accept(event.target.files?.[0])}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDragging(false)
          }
        }}
        onDrop={handleDrop}
        className={cn(
          'mt-3 flex w-full flex-col gap-2 border border-dashed px-3 py-3 text-left transition-colors duration-150',
          'disabled:cursor-wait',
          dragging
            ? 'border-accent-2 bg-accent-2/[0.07]'
            : 'border-rail-line hover:border-rail-muted/70 hover:bg-rail-2/60',
        )}
      >
        <span className="flex items-center gap-2 text-[12px] text-rail-ink">
          <Upload size={13} strokeWidth={1.8} className="text-accent-2" />
          {busy ? '正在解析…' : '拖入 PDF 或点击选择'}
        </span>

        {busy ? (
          <span className="scan-line rail-scan" />
        ) : (
          <span className="flex items-center justify-between font-mono text-[9px] tracking-[0.08em] text-rail-muted">
            <span>仅解析文本层 · ≤ 20MB</span>
            <span>PDF</span>
          </span>
        )}
      </button>
    </>
  )
}
