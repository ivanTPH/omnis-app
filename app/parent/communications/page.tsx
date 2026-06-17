'use client'

import { useEffect, useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import {
  getParentCommunications,
  markCommunicationRead,
  type ParentCommunicationRow,
} from '@/app/actions/communications'

function dateStr(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function CommItem({ item }: { item: ParentCommunicationRow }) {
  const [expanded, setExpanded]   = useState(false)
  const [isRead, setIsRead]       = useState(item.readAt != null)
  const [, startT]                = useTransition()

  const handleExpand = () => {
    setExpanded(e => !e)
    if (!isRead) {
      setIsRead(true)
      startT(async () => { await markCommunicationRead(item.id) })
    }
  }

  return (
    <div className={`rounded-lg border overflow-hidden transition-colors ${isRead ? 'border-gray-200 bg-white' : 'border-indigo-200 bg-indigo-50'}`}>
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50/80"
        onClick={handleExpand}
      >
        <Icon name={expanded ? 'expand_less' : 'expand_more'} size="sm" className="mt-0.5 text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {!isRead && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />}
            <span className={`text-sm font-medium ${isRead ? 'text-gray-900' : 'text-indigo-900'} truncate`}>
              {item.title}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{item.authorName} · {dateStr(item.createdAt)}</p>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.body}</p>
        </div>
      )}
    </div>
  )
}

export default function ParentCommunicationsPage() {
  const [items, setItems]     = useState<ParentCommunicationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getParentCommunications().then(data => { setItems(data); setLoading(false) })
  }, [])

  const unreadCount = items.filter(i => i.readAt == null).length

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">School Messages</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {unreadCount > 0 ? `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}` : 'All messages read'}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(n => <div key={n} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="mail_outline" size="lg" className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No messages from school yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => <CommItem key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )
}
