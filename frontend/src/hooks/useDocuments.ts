import { useCallback, useEffect, useState } from 'react'

import { deleteDocument, listDocuments, uploadPdf } from '@/lib/api'
import { describeError } from '@/lib/errors'
import type { DocumentMeta } from '@/types'

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next = await listDocuments()
      setDocuments(next)
      setOffline(false)
      setError(null)
    } catch (err) {
      setOffline(true)
      setError(describeError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const hasProcessing = documents.some((doc) => doc.status === 'processing')

  useEffect(() => {
    if (!hasProcessing) return
    const timer = window.setInterval(() => {
      void refresh()
    }, 2500)
    return () => window.clearInterval(timer)
  }, [hasProcessing, refresh])

  const upload = useCallback(async (file: File) => {
    const created = await uploadPdf(file)
    setDocuments((prev) => [created, ...prev.filter((doc) => doc.id !== created.id)])
    setOffline(false)
    return created
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteDocument(id)
    setDocuments((prev) => prev.filter((doc) => doc.id !== id))
  }, [])

  return {
    documents,
    loading,
    offline,
    error,
    upload,
    remove,
    refresh,
  }
}
