'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { markPlatformNotificationRead, markAllPlatformNotificationsRead, dismissNotification, clearReadNotifications } from '@/app/actions/messaging'
import { logTeacherIntervention } from '@/app/actions/send-support'
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
  SEND_WARNING_ACTION: 'bg-rose-100 text-rose-700',
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

const FILTER_CHIPS = [
  { key: 'all',      label: 'All' },
  { key: 'unread',   label: 'Unread' },
  { key: 'CONCERN_RAISED',     label: 'Concerns' },
  { key: 'EARLY_WARNING',      label: 'Early Warning' },
  { key: 'ILP_REVIEW_DUE',     label: 'ILP Reviews' },
  { key: 'HOMEWORK_REMINDER',  label: 'Homework' },
  { key: 'NEW_MESSAGE',        label: 'Messages' },
]

export default function NotificationsView({
  notifications: initial,
}: {
  notifications: PlatformNotificationRow[]
}) {
  const [items, setItems]       = useState(initial)
  const [isPending, start]      = useTransition()
  const [filterKey, setFilter]  = useState('all')
  const router                  = useRouter()

  // State for EARLY_WARNING intervention log (per notification id)
  const [interventionOpen,  setInterventionOpen]  = useState<Record<string, boolean>>({})
  const [interventionNote,  setInterventionNote]  = useState<Record<string, string>>({})
  const [interventionSaved, setInterventionSaved] = useState<Record<string, boolean>>({})
  const [interventionSaving, setInterventionSaving] = useState<Record<string, boolean>>({})

  async function handleLogIntervention(notifId: string, studentId: string) {
    const note = interventionNote[notifId] ?? ''
    setInterventionSaving(prev => ({ ...prev, [notifId]: true }))
    try {
      await logTeacherIntervention(studentId, note)
      setInterventionSaved(prev => ({ ...prev, [notifId]: true }))
      setInterventionOpen(prev => ({ ...prev, [notifId]: false }))
      handleRead(notifId)
    } catch { /* ignore */ }
    finally { setInterventionSaving(prev => ({ ...prev, [notifId]: false })) }
  }

  const unreadCount  = items.filter(n => !n.read).length
  const visibleItems = items.filter(n => {
    if (filterKey === 'unread') return !n.read
    if (filterKey === 'all')    return true
    return n.type === filterKey
  })

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

  function handleDismiss(id: string) {
    setItems(prev => prev.filter(n => n.id !== id))
    start(async () => {
      await dismissNotification(id)
      router.refresh()
    })
  }

  function handleClearRead() {
    setItems(prev => prev.filter(n => !n.read))
    start(async () => {
      await clearReadNotifications()
      router.refresh()
    })
  }

  const readCount = items.filter(n => n.read).length

  return (
    <div className="flex-1 overflow-auto px-6 py-6 max-w-2xl mx-auto w-full">

      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : undefined}
        action={
          <div className="flex items-center gap-2">
            {readCount > 0 && (
              <button onClick={handleClearRead} disabled={isPending}
                className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-gray-600 font-medium transition-colors disabled:opacity-40">
                <Icon name="delete_sweep" size="sm" />
                Clear read
              </button>
            )}
            {unreadCount > 0 && (
              <button onClick={handleMarkAll} disabled={isPending}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors disabled:opacity-40">
                {isPending ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="check" size="sm" />}
                Mark all read
              </button>
            )}
          </div>
        }
      />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTER_CHIPS.map(c => {
          const count = c.key === 'all'    ? items.length
                      : c.key === 'unread' ? unreadCount
                      : items.filter(n => n.type === c.key).length
          if (c.key !== 'all' && c.key !== 'unread' && count === 0) return null
          return (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium border transition ${
                filterKey === c.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-200'
              }`}
            >
              {c.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold ${filterKey === c.key ? 'text-blue-100' : 'text-gray-400'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* list */}
      {visibleItems.length === 0 ? (
        <EmptyState
          icon="notifications_none"
          title={filterKey === 'unread' ? 'All caught up' : 'No notifications'}
          description={filterKey === 'unread' ? 'No unread notifications' : 'Nothing in this category'}
          size="md"
        />
      ) : (
        <div className="space-y-2">
          {visibleItems.map(n => (
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
                      <Icon name="open_in_new" size="sm" />
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
                  <button
                    onClick={() => handleDismiss(n.id)}
                    className="text-gray-300 hover:text-gray-500 transition-colors"
                    title="Dismiss"
                  >
                    <Icon name="close" size="sm" />
                  </button>
                </div>
              </div>

              {/* Intervention log panel for EARLY_WARNING notifications */}
              {n.type === 'EARLY_WARNING' && (() => {
                const studentId = n.linkHref?.split('/student/')[1]?.split('/')[0]?.split('?')[0]
                if (!studentId) return null
                const isSaved  = interventionSaved[n.id]
                const isOpen   = interventionOpen[n.id]
                const isSaving = interventionSaving[n.id]
                return (
                  <div className="mt-2 border-t border-rose-100 pt-2">
                    {isSaved ? (
                      <p className="text-[11px] text-green-700 flex items-center gap-1">
                        <Icon name="check_circle" size="sm" /> Intervention logged — SENCO notified
                      </p>
                    ) : isOpen ? (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          value={interventionNote[n.id] ?? ''}
                          onChange={e => setInterventionNote(prev => ({ ...prev, [n.id]: e.target.value }))}
                          placeholder="Briefly describe the intervention you have taken or plan to take…"
                          className="w-full text-xs border border-rose-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-rose-400 resize-none bg-white"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleLogIntervention(n.id, studentId)}
                            disabled={isSaving}
                            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors"
                          >
                            {isSaving ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="check" size="sm" />}
                            {isSaving ? 'Logging…' : 'Log intervention'}
                          </button>
                          <button
                            onClick={() => setInterventionOpen(prev => ({ ...prev, [n.id]: false }))}
                            className="text-[11px] text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setInterventionOpen(prev => ({ ...prev, [n.id]: true }))}
                        className="flex items-center gap-1 text-[11px] font-medium text-rose-700 hover:text-rose-900 transition-colors"
                      >
                        <Icon name="assignment_turned_in" size="sm" />
                        Log intervention taken →
                      </button>
                    )}
                  </div>
                )
              })()}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
