'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, CheckCheck, ExternalLink, Loader2 } from 'lucide-react'
import { markPlatformNotificationRead, markAllPlatformNotificationsRead } from '@/app/actions/messaging'
import type { PlatformNotificationRow } from '@/app/actions/messaging'

function timeAgo(date: Date | string) {
  const d    = typeof date === 'string' ? new Date(date) : date
  const secs = Math.floor((Date.now() - d.getTime()) / 1000)
  if (secs < 60)   return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

const TYPE_COLOURS: Record<string, string> = {
  HOMEWORK_REMINDER:  'bg-blue-100 text-blue-700',
  CONCERN_RAISED:     'bg-amber-100 text-amber-700',
  ILP_REVIEW_DUE:     'bg-purple-100 text-purple-700',
  EARLY_WARNING:      'bg-rose-100 text-rose-700',
  NEW_MESSAGE:        'bg-green-100 text-green-700',
  SUBMISSION_MARKED:  'bg-teal-100 text-teal-700',
}

function typeBadge(type: string) {
  const colour = TYPE_COLOURS[type] ?? 'bg-gray-100 text-gray-600'
  const label  = type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${colour}`}>
      {label}
    </span>
  )
}

export default function NotificationsView({
  notifications: initial,
}: {
  notifications: PlatformNotificationRow[]
}) {
  const [items, setItems]   = useState(initial)
  const [isPending, start]  = useTransition()
  const router              = useRouter()

  const unreadCount = items.filter(n => !n.read).length

  function handleRead(id: string) {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    start(async () => {
      await markPlatformNotificationRead(id)
      router.refresh()
    })
  }

  function handleMarkAll() {
    setItems(prev => prev.map(n => ({ ...n, read: true })))
    start(async () => {
      await markAllPlatformNotificationsRead()
      router.refresh()
    })
  }

  return (
    <div className="flex-1 overflow-auto px-6 py-6 max-w-2xl mx-auto w-full">

      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-gray-500" />
          <h1 className="text-lg font-semibold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <span className="bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            disabled={isPending}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors disabled:opacity-40"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
            Mark all read
          </button>
        )}
      </div>

      {/* list */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Bell size={40} className="mb-3 opacity-30" />
          <p className="text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(n => (
            <div
              key={n.id}
              className={`rounded-xl border px-4 py-3.5 transition-colors ${
                n.read
                  ? 'bg-white border-gray-200'
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* unread dot */}
                <div className="mt-1 shrink-0">
                  {!n.read
                    ? <div className="w-2 h-2 rounded-full bg-blue-500" />
                    : <div className="w-2 h-2 rounded-full bg-transparent" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    {typeBadge(n.type)}
                    <span className="text-[11px] text-gray-400">{timeAgo(n.createdAt)}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  {n.body && (
                    <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {n.linkHref && (
                    <Link
                      href={n.linkHref}
                      onClick={() => !n.read && handleRead(n.id)}
                      className="text-blue-500 hover:text-blue-700 transition-colors"
                      title="Go to"
                    >
                      <ExternalLink size={14} />
                    </Link>
                  )}
                  {!n.read && (
                    <button
                      onClick={() => handleRead(n.id)}
                      className="text-[11px] text-gray-400 hover:text-blue-600 transition-colors font-medium"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
