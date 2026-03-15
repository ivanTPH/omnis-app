'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, Check } from 'lucide-react'
import { getMyNotifications, markNotificationRead, markAllNotificationsRead } from '@/app/actions/send-support'
import type { SendNotificationRow } from '@/app/actions/send-support'
import {
  getMyPlatformNotifications,
  markPlatformNotificationRead,
  markAllPlatformNotificationsRead,
} from '@/app/actions/messaging'
import type { PlatformNotificationRow } from '@/app/actions/messaging'

type UnifiedNotification =
  | (SendNotificationRow  & { source: 'send';     linkHref?: null })
  | (PlatformNotificationRow & { source: 'platform'; isRead: boolean })

const TYPE_LABELS: Record<string, string> = {
  new_concern:         '🔔 New concern',
  concern_escalated:   '⚠️ Concern escalated',
  ilp_created:         '📋 ILP created',
  ilp_review_due:      '📅 Review due',
  pattern_detected:    '📊 Pattern detected',
  review_requested:    '👁 Review requested',
  HOMEWORK_SUBMITTED:  '📝 Homework submitted',
  HOMEWORK_GRADED:     '✅ Homework graded',
  PLAN_REVIEW_DUE:     '📅 Plan review due',
  SUBMISSION_FLAGGED:  '🚩 Submission flagged',
  new_message:         '💬 New message',
  GENERAL:             '🔔 Notification',
}

export default function NotificationBell() {
  const router = useRouter()
  const [sendNotifs,     setSendNotifs]     = useState<SendNotificationRow[]>([])
  const [platformNotifs, setPlatformNotifs] = useState<PlatformNotificationRow[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Merge + sort by date descending
  const unified: UnifiedNotification[] = [
    ...sendNotifs.map(n => ({ ...n, source: 'send' as const, linkHref: null })),
    ...platformNotifs.map(n => ({ ...n, source: 'platform' as const, isRead: n.read })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const unread = unified.filter(n => (n.source === 'send' ? !n.isRead : !n.read)).length

  async function load() {
    try {
      const [send, platform] = await Promise.all([
        getMyNotifications(),
        getMyPlatformNotifications(),
      ])
      setSendNotifs(send)
      setPlatformNotifs(platform)
    } catch {
      // silent
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleMarkRead(n: UnifiedNotification) {
    if (n.source === 'send') {
      await markNotificationRead(n.id)
      setSendNotifs(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x))
    } else {
      await markPlatformNotificationRead(n.id)
      setPlatformNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
    }
  }

  async function handleMarkAll() {
    await Promise.all([markAllNotificationsRead(), markAllPlatformNotificationsRead()])
    setSendNotifs(prev => prev.map(n => ({ ...n, isRead: true })))
    setPlatformNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  function handleItemClick(n: UnifiedNotification) {
    handleMarkRead(n)
    const href = n.source === 'platform' ? n.linkHref : null
    if (href) {
      setOpen(false)
      router.push(href)
    }
  }

  const isUnread = (n: UnifiedNotification) =>
    n.source === 'send' ? !n.isRead : !n.read

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={handleMarkAll} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <Check size={11} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {unified.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">No notifications.</p>
            ) : (
              unified.map(n => {
                const hasLink = n.source === 'platform' && !!n.linkHref
                return (
                  <div
                    key={`${n.source}-${n.id}`}
                    className={`px-4 py-3 ${isUnread(n) ? 'bg-blue-50' : 'bg-white'} ${hasLink ? 'cursor-pointer hover:bg-blue-50/80' : ''}`}
                    onClick={hasLink ? () => handleItemClick(n) : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-500 mb-0.5">
                          {TYPE_LABELS[n.type] ?? n.type}
                        </p>
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">{n.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(n.createdAt).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      {isUnread(n) && (
                        <button
                          onClick={e => { e.stopPropagation(); handleMarkRead(n) }}
                          className="shrink-0 p-1 hover:bg-blue-100 rounded text-blue-500"
                          title="Mark as read"
                        >
                          <Check size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
