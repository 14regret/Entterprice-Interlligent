import { useEffect, useState } from 'react'

import { LazyMotion, domAnimation } from 'motion/react'

import { ChatPanel } from '@/components/chat/ChatPanel'
import { AppShell } from '@/components/shell/AppShell'
import { Sidebar } from '@/components/shell/Sidebar'
import { ToastProvider, useToast } from '@/components/ui/Toaster'
import { useChat } from '@/hooks/useChat'
import { useDocuments } from '@/hooks/useDocuments'
import { getHealth } from '@/lib/api'
import type { Health } from '@/types'

export default function App() {
  return (
    <LazyMotion features={domAnimation} strict>
      <ToastProvider>
        <Workspace />
      </ToastProvider>
    </LazyMotion>
  )
}

function Workspace() {
  const chat = useChat()
  const docs = useDocuments()
  const toast = useToast()

  const [health, setHealth] = useState<Health | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    let alive = true

    getHealth()
      .then((next) => {
        if (alive) setHealth(next)
      })
      .catch(() => {
        if (alive) setHealth(null)
      })

    return () => {
      alive = false
    }
  }, [])

  async function handleUpload(file: File) {
    const created = await docs.upload(file)
    toast(`已提交「${created.name}」，正在建立索引`, 'success')
    return created
  }

  async function handleDelete(id: string) {
    await docs.remove(id)
    toast('文档已删除', 'success')
  }

  function renderSidebar(onClose?: () => void) {
    return (
      <Sidebar
        documents={docs.documents}
        loading={docs.loading}
        offline={docs.offline}
        health={health}
        onUpload={handleUpload}
        onDelete={handleDelete}
        onClose={onClose}
      />
    )
  }

  return (
    <AppShell
      sidebar={renderSidebar()}
      drawerSidebar={renderSidebar(() => setSidebarOpen(false))}
      sidebarOpen={sidebarOpen}
      onCloseSidebar={() => setSidebarOpen(false)}
    >
      <ChatPanel
        messages={chat.messages}
        phase={chat.phase}
        sessionId={chat.sessionId}
        documents={docs.documents}
        health={health}
        offline={docs.offline}
        onSend={(question) => void chat.send(question)}
        onStop={chat.stop}
        onReset={chat.reset}
        onUpload={handleUpload}
        onOpenSidebar={() => setSidebarOpen(true)}
        onError={(message) => toast(message, 'error')}
      />
    </AppShell>
  )
}
