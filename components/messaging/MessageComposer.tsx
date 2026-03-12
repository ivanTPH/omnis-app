'use client'
import { useState, useRef, useTransition, KeyboardEvent } from 'react'
import { Send, Loader2 } from 'lucide-react'

const MAX_CHARS = 2000

export default function MessageComposer({
  onSend,
  disabled = false,
}: {
  onSend: (body: string) => Promise<void>
  disabled?: boolean
}) {
  const [body, setBody]     = useState('')
  const [isPending, start]  = useTransition()
  const textareaRef         = useRef<HTMLTextAreaElement>(null)

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`
  }

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed || isPending) return
    start(async () => {
      await onSend(trimmed)
      setBody('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const remaining = MAX_CHARS - body.length
  const tooLong   = remaining < 0

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1 border border-gray-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
          <textarea
            ref={textareaRef}
            rows={1}
            value={body}
            onChange={e => { setBody(e.target.value); autoResize() }}
            onKeyDown={handleKeyDown}
            disabled={disabled || isPending}
            placeholder="Write a message… (Enter to send, Shift+Enter for new line)"
            className="w-full px-3 py-2.5 text-[13px] text-gray-900 leading-relaxed resize-none focus:outline-none disabled:opacity-50 bg-white"
            style={{ minHeight: 40, maxHeight: 144 }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!body.trim() || tooLong || isPending || disabled}
          className="shrink-0 w-9 h-9 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-colors"
        >
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>
      {body.length > MAX_CHARS - 200 && (
        <p className={`text-[10px] mt-1 text-right ${tooLong ? 'text-red-500' : 'text-gray-400'}`}>
          {remaining} characters remaining
        </p>
      )}
    </div>
  )
}
