'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Archive, Users, ExternalLink } from 'lucide-react'
import type { ThreadDetail, MessageRow } from '@/app/actions/messaging'
import { sendMessage, archiveThread, getThread } from '@/app/actions/messaging'
import MessageBubble from './MessageBubble'
import MessageComposer from './MessageComposer'

export default function ThreadView({
  thread:     initialThread,
  currentUserId,
  onArchived,
}: {
  thread:        ThreadDetail
  currentUserId: string
  onArchived?:   () => void
}) {
  const [thread, setThread]     = useState(initialThread)
  const [archiving, startArch]  = useTransition()
  const bottomRef               = useRef<HTMLDivElement>(null)

  // Scroll to bottom on load and new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.messages.length])

  // Poll for new messages every 30s
  useEffect(() => {
    const id = setInterval(async () => {
      const updated = await getThread(thread.id)
      if (updated) setThread(updated)
    }, 30_000)
    return () => clearInterval(id)
  }, [thread.id])

  async function handleSend(body: string) {
    const msg = await sendMessage(thread.id, body)
    setThread(prev => ({
      ...prev,
      messages: [...prev.messages, msg],
    }))
  }

  function handleArchive() {
    startArch(async () => {
      await archiveThread(thread.id)
      onArchived?.()
    })
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Thread header */}
      <div className="shrink-0 px-5 py-3.5 border-b border-gray-200 bg-white flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h2 className="text-[14px] font-semibold text-gray-900 truncate">{thread.subject}</h2>
            {thread.isPrivate && (
              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Private</span>
            )}
            {thread.context && thread.context !== 'general' && (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium capitalize">
                {thread.context.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <Users size={11} />
            <span>{thread.participants.map(p => `${p.firstName} ${p.lastName}`).join(', ')}</span>
          </div>
          {thread.contextId && thread.context === 'homework' && (
            <a
              href={`/homework/${thread.contextId}`}
              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline mt-0.5"
            >
              <ExternalLink size={10} /> View homework
            </a>
          )}
        </div>
        <button
          onClick={handleArchive}
          disabled={archiving}
          className="shrink-0 flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          title="Archive thread"
        >
          <Archive size={13} />
          Archive
        </button>
      </div>

      {/* SEND privacy notice */}
      {thread.isPrivate && (
        <div className="shrink-0 bg-purple-50 border-b border-purple-100 px-5 py-2">
          <p className="text-[11px] text-purple-700">
            This is a private thread (SEND-related). Only participants can see these messages.
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto px-5 py-4">
        {thread.messages.map(m => (
          <MessageBubble
            key={m.id}
            message={m}
            isOwn={m.senderId === currentUserId}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <MessageComposer onSend={handleSend} />
    </div>
  )
}
