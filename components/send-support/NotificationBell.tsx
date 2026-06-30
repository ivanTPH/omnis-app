'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
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

const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
  new_concern:         { icon: 'warning',          color: 'text-amber-500',  label: 'New concern' },
  concern_escalated:   { icon: 'report_problem',   color: 'text-red-500',    label: 'Concern escalated' },
  ilp_created:         { icon: 'description',      color: 'text-blue-500',   label: 'ILP created' },
  ilp_review_due:      { icon: 'event',            color: 'text-orange-500', label: 'Review due' },
  pattern_detected:    { icon: 'bar_chart',        color: 'text-purple-500', label: 'Pattern detected' },
  review_requested:    { icon: 'visibility',       color: 'text-blue-500',   label: 'Review requested' },
  HOMEWORK_SUBMITTED:  { icon: 'assignment',       color: 'text-indigo-500', label: 'Homework submitted' },
  HOMEWORK_GRADED:     { icon: 'check_circle',     color: 'text-green-500',  label: 'Homework graded' },
  PLAN_REVIEW_DUE:     { icon: 'event',            color: 'text-orange-500', label: 'Plan review due' },
  SUBMISSION_FLAGGED:  { icon: 'flag',             color: 'text-red-500',    label: 'Submission flagged' },
  new_message:         { icon: 'chat_bubble',      color: 'text-blue-500',   label: 'New message' },
  GENERAL:             { icon: 'notifications',    color: 'text-gray-400',   label: 'Notification' },
  ILP_EVIDENCE_REQUEST:{ icon: 'link',             color: 'text-teal-500',   label: 'Evidence request' },
  ILP_EVIDENCE_SUGGESTED: { icon: 'auto_awesome', color: 'text-teal-500',   label: 'Evidence suggested' },
  SYSTEM:              { icon: 'info',             color: 'text-blue-400',   label: 'System' },
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
        <Icon name="notifications" size="md" />
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
                  <Icon name="check" size="sm" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <Icon name="close" size="sm" />
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
                        <p className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-0.5">
                          <Icon
                            name={(TYPE_META[n.type] ?? TYPE_META.GENERAL).icon}
                            size="sm"
                            className={(TYPE_META[n.type] ?? TYPE_META.GENERAL).color}
                          />
                          {(TYPE_META[n.type] ?? { label: n.type.replace(/_/g, ' ').toLowerCase() }).label}
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
                          <Icon name="check" size="sm" />
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
