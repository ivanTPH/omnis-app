'use client'
import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { sendParentMessage } from '@/app/actions/parent'
import { MessageSquare, Send, User, Info } from 'lucide-react'

type Message = {
  id:         string
  senderType: string
  content:    string
  sentAt:     Date | string
  readAt?:    Date | string | null
}

type Conversation = {
  id:             string
  studentId:      string
  status:         string
  updatedAt:      Date | string
  teacher:        { id: string; firstName: string; lastName: string }
  parentMessages: Message[]
}

type Child = { id: string; firstName: string; lastName: string }

export default function ParentMessagesView({
  conversations,
  children,
}: {
  conversations: Conversation[]
  children:      Child[]
}) {
  const router  = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null)
  const [draft, setDraft]           = useState('')
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  const conv = conversations.find(c => c.id === selectedId) ?? null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedId, conv?.parentMessages.length])

  function child(studentId: string) {
    return children.find(c => c.id === studentId)
  }

  function handleSend() {
    if (!conv || !draft.trim()) return
    const content = draft.trim()
    setDraft('')
    startTransition(async () => {
      await sendParentMessage(conv.id, content)
      router.refresh()
    })
  }

  return (
    <div className="flex h-full">

      {/* ── Left: conversation list ── */}
      <div className="w-72 border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-[14px] font-semibold text-gray-900">Messages</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Conversations with teachers</p>
        </div>

        <div className="flex-1 overflow-auto">
          {conversations.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-400">
              <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-[13px] font-medium">No conversations</p>
              <p className="text-[11px] mt-1">Teachers can open a conversation from their marking view</p>
            </div>
          ) : (
            conversations.map(c => {
              const kid  = child(c.studentId)
              const last = c.parentMessages[c.parentMessages.length - 1]
              const unread = c.parentMessages.some(m => m.senderType === 'TEACHER' && !m.readAt)
              const active = c.id === selectedId
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-4 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition ${active ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <User size={14} className="text-gray-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-semibold text-gray-900 truncate">
                          {c.teacher.firstName} {c.teacher.lastName}
                        </p>
                        {unread && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        )}
                      </div>
                      {kid && (
                        <p className="text-[10px] text-gray-400">Re: {kid.firstName} {kid.lastName}</p>
                      )}
                      {last && (
                        <p className="text-[11px] text-gray-500 truncate mt-0.5 leading-tight">{last.content}</p>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Info note */}
        <div className="px-4 py-3 border-t border-gray-100 shrink-0">
          <div className="flex items-start gap-1.5">
            <Info size={11} className="text-gray-300 mt-0.5 shrink-0" />
            <p className="text-[10px] text-gray-400 leading-snug">
              Conversations are opened by teachers. Contact the school office for urgent matters.
            </p>
          </div>
        </div>
      </div>

      {/* ── Right: thread ── */}
      {conv ? (
        <div className="flex-1 flex flex-col min-w-0">

          {/* Thread header */}
          <div className="px-6 py-4 border-b border-gray-200 shrink-0">
            <p className="text-[14px] font-semibold text-gray-900">
              {conv.teacher.firstName} {conv.teacher.lastName}
            </p>
            {child(conv.studentId) && (
              <p className="text-[12px] text-gray-400">
                Regarding {child(conv.studentId)!.firstName} {child(conv.studentId)!.lastName}
              </p>
            )}
            {conv.status === 'CLOSED' && (
              <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                Closed
              </span>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto px-6 py-5 space-y-3">
            {conv.parentMessages.length === 0 ? (
              <p className="text-center text-[13px] text-gray-400 py-12">
                No messages yet. Write your first message below.
              </p>
            ) : (
              conv.parentMessages.map(msg => {
                const isParent = msg.senderType === 'PARENT'
                return (
                  <div key={msg.id} className={`flex ${isParent ? 'justify-end' : 'justify-start'}`}>
                    {!isParent && (
                      <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center shrink-0 mr-2 mt-1">
                        <User size={12} className="text-gray-500" />
                      </div>
                    )}
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      isParent
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                    }`}>
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${isParent ? 'text-blue-200' : 'text-gray-400'}`}>
                        {new Date(msg.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {' · '}
                        {new Date(msg.sentAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Compose */}
          <div className="px-6 py-4 border-t border-gray-200 shrink-0">
            {conv.status === 'CLOSED' ? (
              <p className="text-[12px] text-gray-400 text-center py-2">
                This conversation has been closed. Please contact the school office for further support.
              </p>
            ) : (
              <>
                <div className="flex items-end gap-3">
                  <textarea
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 min-h-[80px] max-h-[160px] transition"
                    placeholder="Write a message… (⌘↵ to send)"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
                    }}
                    disabled={isPending}
                  />
                  <button
                    onClick={handleSend}
                    disabled={isPending || !draft.trim()}
                    className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0"
                  >
                    <Send size={16} />
                  </button>
                </div>
                <p className="text-[10px] text-gray-300 mt-1.5">Messages are moderated by the school</p>
              </>
            )}
          </div>

        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <MessageSquare size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-[14px] font-medium">No conversations yet</p>
            <p className="text-[12px] mt-1 max-w-xs">
              Teachers can start a conversation from the homework marking view. Contact the school office for urgent matters.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
