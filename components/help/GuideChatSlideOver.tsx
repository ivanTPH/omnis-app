'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { askGuideChat } from '@/app/actions/guide-chat'
import type { ChatMessage } from '@/app/actions/guide-chat'

const SUGGESTED = [
  'How do I create a homework?',
  'What does the RAG status mean?',
  'How do I set a predicted grade?',
  'How do I approve an EHCP?',
  'How do I create a revision program?',
  'How do I log an early warning flag?',
]

export default function GuideChatSlideOver({ onClose }: { onClose: () => void }) {
  const [messages,  setMessages]  = useState<ChatMessage[]>([])
  const [input,     setInput]     = useState('')
  const [pending,   startPending] = useTransition()
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || pending) return
    setInput('')
    const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(next)
    startPending(async () => {
      const reply = await askGuideChat(next)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    })
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed bottom-0 right-0 z-50 w-full max-w-sm h-[600px] max-h-[90dvh] bg-white shadow-2xl rounded-tl-2xl flex flex-col border-l border-t border-gray-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-blue-700 shrink-0">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <Icon name="auto_awesome" size="sm" className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Omnis Guide</p>
            <p className="text-[10px] text-blue-200">Ask me anything about the platform</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <Icon name="close" size="sm" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 leading-relaxed">
                Hi! I can guide you through any part of Omnis step by step. Try one of these:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED.map(q => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-1 hover:bg-blue-100 transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-700 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}

          {pending && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                <span className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-gray-200 px-3 py-3 bg-gray-50">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask a question… (Enter to send)"
              className="flex-1 resize-none text-sm border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white max-h-28 overflow-y-auto"
              style={{ minHeight: '40px' }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || pending}
              className="shrink-0 w-9 h-9 rounded-xl bg-blue-700 text-white flex items-center justify-center hover:bg-blue-800 disabled:opacity-40 transition-colors"
            >
              <Icon name="send" size="sm" />
            </button>
          </div>
          <p className="text-[9px] text-gray-400 mt-1.5 text-center">Powered by Claude · Answers are guidance only</p>
        </div>
      </div>
    </>
  )
}
