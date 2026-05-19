'use client'

import { useState, useEffect, useRef } from 'react'
import Icon from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import StudentAvatar from '@/components/StudentAvatar'
import { getThreadReadOnly, type ParentThreadSummary, type ThreadDetail } from '@/app/actions/messaging'

// ── helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime()
  if (diff < 3_600_000)   return `${Math.max(1, Math.floor(diff / 60_000))}m ago`
  if (diff < 86_400_000)  return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function rolePill(role: string) {
  if (role === 'PARENT')  return 'bg-purple-100 text-purple-700'
  if (role === 'STUDENT') return 'bg-blue-100   text-blue-700'
  return 'bg-gray-100 text-gray-600'
}

const PERIOD_LABELS: Record<string, string> = {
  all:   'All time',
  week:  'This week',
  month: 'This month',
}

// ── Thread list panel ─────────────────────────────────────────────────────────

function ThreadRow({
  thread,
  isActive,
  onClick,
}: {
  thread:   ParentThreadSummary
  isActive: boolean
  onClick:  () => void
}) {
  const parent = thread.participants.find(p => p.role === 'PARENT')
  const others = thread.participants.filter(p => p.role !== 'PARENT')

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-gray-100 transition-colors hover:bg-gray-50 ${
        isActive ? 'bg-blue-50 border-l-[3px] border-l-blue-600' : 'border-l-[3px] border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {parent && (
            <StudentAvatar
              firstName={parent.name.split(' ')[0]}
              lastName={parent.name.split(' ').slice(1).join(' ')}
              avatarUrl={parent.avatarUrl}
              userId={parent.id}
              size="xs"
            />
          )}
          <span className="text-[12px] font-semibold text-gray-900 truncate flex-1">
            {parent?.name ?? 'Parent'}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700 shrink-0">
            Parent
          </span>
        </div>
        <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(thread.updatedAt)}</span>
      </div>

      <p className="text-[12px] font-medium text-gray-700 truncate mb-0.5">{thread.subject}</p>

      {thread.lastMessage && (
        <p className="text-[11px] text-gray-400 truncate">
          {thread.lastSender?.split(' ')[0]}: {thread.lastMessage}
        </p>
      )}

      <div className="flex items-center gap-1.5 mt-1.5">
        {others.slice(0, 2).map(p => (
          <span key={p.id} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${rolePill(p.role)}`}>
            {p.name.split(' ')[0]}
          </span>
        ))}
        {others.length > 2 && (
          <span className="text-[9px] text-gray-400">+{others.length - 2}</span>
        )}
        <span className="ml-auto text-[10px] text-gray-400">
          {thread.messageCount} msg{thread.messageCount !== 1 ? 's' : ''}
        </span>
      </div>
    </button>
  )
}

// ── Read-only thread panel ─────────────────────────────────────────────────────

function ReadOnlyThreadView({ threadId }: { threadId: string }) {
  const [detail,  setDetail]  = useState<ThreadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const bottomRef             = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setDetail(null)
    getThreadReadOnly(threadId)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [threadId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [detail?.messages.length])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 gap-2">
        <Icon name="refresh" size="md" className="animate-spin" />
        <span className="text-sm">Loading conversation…</span>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState icon="chat" title="Thread not found" size="sm" />
      </div>
    )
  }

  const parentParticipants  = detail.participants.filter(p => p.role === 'PARENT')
  const staffParticipants   = detail.participants.filter(p => p.role !== 'PARENT')

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Thread header */}
      <div className="shrink-0 px-5 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="text-[14px] font-semibold text-gray-900 leading-snug">{detail.subject}</h2>
          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold shrink-0">
            Read-only
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {detail.participants.map(p => (
            <span key={p.id} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${rolePill(p.role)}`}>
              {p.firstName} {p.lastName} · {p.role.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5">
          Started {new Date(detail.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          {' · '}{detail.messages.length} message{detail.messages.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Safeguarding notice */}
      <div className="shrink-0 px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
        <Icon name="shield" size="sm" className="text-amber-600 shrink-0" />
        <p className="text-[11px] text-amber-700">
          Safeguarding view — monitoring only. Staff cannot send messages from this view.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {detail.messages.length === 0 ? (
          <EmptyState icon="chat" title="No messages" size="sm" />
        ) : (
          detail.messages.map(m => {
            const isParent = parentParticipants.some(p => p.id === m.senderId)
            return (
              <div key={m.id} className={`flex gap-2.5 ${isParent ? '' : 'flex-row-reverse'}`}>
                <StudentAvatar
                  firstName={m.senderName.split(' ')[0]}
                  lastName={m.senderName.split(' ').slice(1).join(' ')}
                  avatarUrl={m.senderAvatar}
                  size="xs"
                />
                <div className={`max-w-[70%] ${isParent ? '' : 'items-end'} flex flex-col gap-0.5`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-gray-600">{m.senderName}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                      isParent ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {isParent ? 'Parent' : (staffParticipants.find(p => p.id === m.senderId)?.role ?? 'Staff').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    isParent
                      ? 'bg-purple-50 border border-purple-100 text-gray-800 rounded-tl-sm'
                      : 'bg-blue-50 border border-blue-100 text-gray-800 rounded-tr-sm'
                  }`}>
                    {m.body}
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {new Date(m.sentAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ParentMessagesMonitor({
  initialThreads,
}: {
  initialThreads: ParentThreadSummary[]
}) {
  const [search,          setSearch]          = useState('')
  const [period,          setPeriod]          = useState<'all' | 'week' | 'month'>('all')
  const [selectedId,      setSelectedId]      = useState<string | null>(initialThreads[0]?.id ?? null)

  const now = Date.now()
  const filtered = initialThreads.filter(t => {
    if (period === 'week'  && now - new Date(t.updatedAt).getTime() > 7  * 86_400_000) return false
    if (period === 'month' && now - new Date(t.updatedAt).getTime() > 30 * 86_400_000) return false
    if (search) {
      const q = search.toLowerCase()
      const matchParticipant = t.participants.some(p => p.name.toLowerCase().includes(q))
      const matchSubject     = t.subject.toLowerCase().includes(q)
      if (!matchParticipant && !matchSubject) return false
    }
    return true
  })

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Page header */}
      <div className="shrink-0 px-6 pt-5 pb-4 bg-white border-b border-gray-200">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-[18px] font-bold text-gray-900 flex items-center gap-2">
              <Icon name="supervisor_account" size="md" className="text-purple-600" />
              Parent Conversations
            </h1>
            <p className="text-[12px] text-gray-500 mt-0.5">
              {initialThreads.length} thread{initialThreads.length !== 1 ? 's' : ''} involving parents · safeguarding monitoring view
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Icon name="shield" size="sm" className="text-amber-500" />
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
              Read-only
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or subject…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Period filter */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {(['all', 'week', 'month'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                  period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Two-panel body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left — thread list */}
        <div className="w-80 shrink-0 border-r border-gray-200 overflow-y-auto bg-white">
          {filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState icon="chat" title="No conversations found" size="sm" />
            </div>
          ) : (
            filtered.map(t => (
              <ThreadRow
                key={t.id}
                thread={t}
                isActive={selectedId === t.id}
                onClick={() => setSelectedId(t.id)}
              />
            ))
          )}
        </div>

        {/* Right — thread detail */}
        <div className="flex-1 min-w-0 bg-gray-50">
          {selectedId ? (
            <ReadOnlyThreadView key={selectedId} threadId={selectedId} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <EmptyState
                icon="supervisor_account"
                title="Select a conversation"
                description="Choose a thread from the list to review it"
                size="md"
              />
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
