export const MAX_PDF_BYTES = 20 * 1024 * 1024

export function validatePdf(file: File): string | null {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) return `「${file.name}」不是 PDF 文件`
  if (file.size > MAX_PDF_BYTES) return `「${file.name}」超过 20MB 上限`
  return null
}
