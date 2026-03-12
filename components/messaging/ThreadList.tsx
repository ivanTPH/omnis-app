'use client'
import { useState } from 'react'
import { Lock, Archive } from 'lucide-react'
import type { ThreadSummary } from '@/app/actions/messaging'
import StudentAvatar from '@/components/StudentAvatar'

function timeAgo(date: Date): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 3600_000)   return `${Math.max(1, Math.floor(diff / 60_000))}m`
  if (diff < 86400_000)  return `${Math.floor(diff / 3600_000)}h`
  if (diff < 604800_000) return `${Math.floor(diff / 86400_000)}d`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const CONTEXT_COLOURS: Record<string, string> = {
  homework:       'bg-blue-100 text-blue-700',
  send:           'bg-purple-100 text-purple-700',
  parent_evening: 'bg-amber-100 text-amber-700',
  general:        'bg-gray-100 text-gray-600',
}

export default function ThreadList({
  threads,
  activeThreadId,
  onSelect,
}: {
  threads:       ThreadSummary[]
  activeThreadId?: string | null
  onSelect:      (id: string) => void
}) {
  const [showArchived, setShowArchived] = useState(false)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto divide-y divide-gray-100">
        {threads.length === 0 && (
          <p className="text-[12px] text-gray-400 text-center py-12 px-4">No messages yet</p>
        )}
        {threads.map(t => {
          const isActive = t.id === activeThreadId
          const hasUnread = t.unreadCount > 0
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`w-full text-left px-4 py-3 transition-colors hover:bg-gray-50 ${
                isActive ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''
              }`}
            >
              {/* Participant avatars */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  {t.participants.slice(0, 3).map(p => (
                    <StudentAvatar
                      key={p.id}
                      firstName={p.firstName}
                      lastName={p.lastName}
                      avatarUrl={p.avatarUrl}
                      size="xs"
                    />
                  ))}
                  {t.participants.length > 3 && (
                    <span className="text-[10px] text-gray-400 ml-1">+{t.participants.length - 3}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400">{timeAgo(t.updatedAt)}</span>
                  {t.isPrivate && <Lock size={10} className="text-purple-400" />}
                  {t.unreadCount > 0 && (
                    <span className="w-4 h-4 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {t.unreadCount > 9 ? '9+' : t.unreadCount}
                    </span>
                  )}
                </div>
              </div>

              <p className={`text-[12px] truncate ${hasUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                {t.subject}
              </p>

              <div className="flex items-center gap-1.5 mt-0.5">
                {t.context && t.context !== 'general' && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${CONTEXT_COLOURS[t.context] ?? CONTEXT_COLOURS.general}`}>
                    {t.context.replace(/_/g, ' ')}
                  </span>
                )}
                {t.lastMessage && (
                  <p className="text-[11px] text-gray-400 truncate flex-1">
                    {t.lastSender ? `${t.lastSender.split(' ')[0]}: ` : ''}{t.lastMessage}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="border-t border-gray-100 px-4 py-2">
        <button
          onClick={() => setShowArchived(v => !v)}
          className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-600"
        >
          <Archive size={12} />
          {showArchived ? 'Hide archived' : 'Show archived'}
        </button>
      </div>
    </div>
  )
}
