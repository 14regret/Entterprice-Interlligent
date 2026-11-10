import { AnimatePresence } from 'motion/react'

import type { ChatMessage } from '@/types'

import { MessageItem } from './MessageItem'

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="mx-auto w-full max-w-[860px] px-5 pt-2 pb-6 sm:px-6 xl:px-0">
      <AnimatePresence initial={false}>
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
      </AnimatePresence>
    </div>
  )
}
