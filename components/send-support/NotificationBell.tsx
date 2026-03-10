'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, X, Check } from 'lucide-react'
import { getMyNotifications, markNotificationRead, markAllNotificationsRead } from '@/app/actions/send-support'
import type { SendNotificationRow } from '@/app/actions/send-support'

const TYPE_LABELS: Record<string, string> = {
  new_concern:       '🔔 New concern',
  concern_escalated: '⚠️ Concern escalated',
  ilp_created:       '📋 ILP created',
  ilp_review_due:    '📅 Review due',
  pattern_detected:  '📊 Pattern detected',
  review_requested:  '👁 Review requested',
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<SendNotificationRow[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifications.filter(n => !n.isRead).length

  async function load() {
    try {
      const data = await getMyNotifications()
      setNotifications(data)
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

  async function handleMarkRead(id: string) {
    await markNotificationRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
  }

  async function handleMarkAll() {
    await markAllNotificationsRead()
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

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
            {notifications.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">No notifications.</p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 ${n.isRead ? 'bg-white' : 'bg-blue-50'}`}
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
                    {!n.isRead && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="shrink-0 p-1 hover:bg-blue-100 rounded text-blue-500"
                        title="Mark as read"
                      >
                        <Check size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
