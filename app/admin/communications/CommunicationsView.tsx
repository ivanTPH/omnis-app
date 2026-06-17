'use client'

import { useState, useTransition } from 'react'
import { useRouter }               from 'next/navigation'
import Icon                        from '@/components/ui/Icon'
import {
  type CommunicationRow,
  type CommunicationRecipientRow,
  sendCommunication,
  getCommunicationRecipients,
} from '@/app/actions/communications'

const TARGET_OPTIONS = [
  { value: 'ALL_PARENTS', label: 'All parents',     yearGroup: undefined },
  { value: 'YEAR_7',      label: 'Year 7 parents',  yearGroup: 7  },
  { value: 'YEAR_8',      label: 'Year 8 parents',  yearGroup: 8  },
  { value: 'YEAR_9',      label: 'Year 9 parents',  yearGroup: 9  },
  { value: 'YEAR_10',     label: 'Year 10 parents', yearGroup: 10 },
  { value: 'YEAR_11',     label: 'Year 11 parents', yearGroup: 11 },
  { value: 'YEAR_12',     label: 'Year 12 parents', yearGroup: 12 },
  { value: 'YEAR_13',     label: 'Year 13 parents', yearGroup: 13 },
]

function scopeLabel(scope: string): string {
  if (scope === 'ALL_PARENTS') return 'All parents'
  if (scope.startsWith('YEAR_')) return `Year ${scope.replace('YEAR_', '')} parents`
  if (scope.startsWith('CLASS_')) return `Class ${scope.replace('CLASS_', '')}`
  return scope
}

function dateStr(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function CommCard({ comm }: { comm: CommunicationRow }) {
  const [expanded, setExpanded]             = useState(false)
  const [showRecipients, setShowRecipients] = useState(false)
  const [recipients, setRecipients]         = useState<CommunicationRecipientRow[] | null>(null)
  const [loadingR, setLoadingR]             = useState(false)

  const readPct    = comm.sentCount > 0 ? Math.round((comm.readCount / comm.sentCount) * 100) : 0
  const unreadCount = comm.sentCount - comm.readCount

  const handleShowRecipients = async () => {
    if (recipients === null) {
      setLoadingR(true)
      const data = await getCommunicationRecipients(comm.id)
      setRecipients(data)
      setLoadingR(false)
    }
    setShowRecipients(v => !v)
  }

  const unread = recipients?.filter(r => r.readAt === null) ?? []
  const read   = recipients?.filter(r => r.readAt !== null) ?? []

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50"
        onClick={() => setExpanded(e => !e)}
      >
        <Icon name={expanded ? 'expand_less' : 'expand_more'} size="sm" className="mt-0.5 text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900 truncate">{comm.title}</span>
            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium shrink-0">
              {scopeLabel(comm.recipientScope)}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Sent by {comm.authorName} · {dateStr(comm.createdAt)} · {comm.sentCount} recipients · {readPct}% read
          </p>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{comm.body}</p>

          {/* Read-rate bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${readPct}%` }} />
            </div>
            <span className="text-xs text-gray-500 shrink-0">{comm.readCount} / {comm.sentCount} read</span>
          </div>

          {/* Who hasn't read toggle */}
          {comm.sentCount > 0 && (
            <button
              onClick={handleShowRecipients}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              {loadingR
                ? <Icon name="refresh" size="sm" className="animate-spin" />
                : <Icon name={showRecipients ? 'expand_less' : 'people'} size="sm" />
              }
              {showRecipients
                ? 'Hide recipients'
                : `View recipients${unreadCount > 0 ? ` (${unreadCount} haven't read)` : ''}`
              }
            </button>
          )}

          {showRecipients && recipients !== null && (
            <div className="border border-gray-100 rounded-lg overflow-hidden text-[11px]">
              {unread.length > 0 && (
                <div>
                  <div className="bg-amber-50 px-3 py-1.5 flex items-center gap-1.5 border-b border-gray-100">
                    <Icon name="schedule" size="sm" className="text-amber-500" />
                    <span className="font-semibold text-amber-700">Not yet read ({unread.length})</span>
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {unread.slice(0, 15).map(r => (
                      <li key={r.parentId} className="px-3 py-1.5 flex items-center gap-2 bg-white">
                        <Icon name="person" size="sm" className="text-gray-300 shrink-0" />
                        <span className="font-medium text-gray-700">{r.parentName}</span>
                        <span className="text-gray-400 truncate">{r.email}</span>
                      </li>
                    ))}
                    {unread.length > 15 && (
                      <li className="px-3 py-1.5 text-gray-400 bg-white">+ {unread.length - 15} more</li>
                    )}
                  </ul>
                </div>
              )}
              {read.length > 0 && (
                <div>
                  <div className="bg-emerald-50 px-3 py-1.5 flex items-center gap-1.5 border-t border-gray-100">
                    <Icon name="check_circle" size="sm" className="text-emerald-500" />
                    <span className="font-semibold text-emerald-700">Read ({read.length})</span>
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {read.slice(0, 10).map(r => (
                      <li key={r.parentId} className="px-3 py-1.5 flex items-center gap-2 bg-white">
                        <Icon name="done_all" size="sm" className="text-emerald-400 shrink-0" />
                        <span className="font-medium text-gray-700">{r.parentName}</span>
                        <span className="text-gray-400 ml-auto shrink-0">{shortDate(r.readAt!)}</span>
                      </li>
                    ))}
                    {read.length > 10 && (
                      <li className="px-3 py-1.5 text-gray-400 bg-white">+ {read.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CommunicationsView({ log }: { log: CommunicationRow[] }) {
  const router  = useRouter()
  const [showModal, setShowModal]   = useState(false)
  const [title, setTitle]           = useState('')
  const [body, setBody]             = useState('')
  const [target, setTarget]         = useState('ALL_PARENTS')
  const [sendEmail, setSendEmail]   = useState(true)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState<string | null>(null)
  const [, startT]                  = useTransition()

  const handleSend = async () => {
    if (!title.trim()) { setError('Subject required'); return }
    if (!body.trim())  { setError('Message body required'); return }
    setSaving(true); setError(null); setSuccess(null)

    const opt = TARGET_OPTIONS.find(o => o.value === target)
    const res = await sendCommunication({
      title,
      body,
      recipientScope: target,
      yearGroup: opt?.yearGroup,
      sendEmail,
    })
    setSaving(false)

    if (!res.ok) { setError(res.error ?? 'Failed to send'); return }
    setSuccess(`Sent to ${res.sentCount} parent${res.sentCount !== 1 ? 's' : ''}`)
    setShowModal(false)
    setTitle(''); setBody('')
    startT(() => router.refresh())
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">School Communications</h1>
          <p className="text-sm text-gray-500 mt-0.5">Letters home and parent announcements</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <Icon name="send" size="sm" />
          New communication
        </button>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
          <Icon name="check_circle" size="sm" />
          {success}
        </div>
      )}

      {/* Log */}
      {log.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="mail_outline" size="lg" className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No communications sent yet</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-indigo-600 text-sm hover:underline">
            Send your first communication
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {log.map(c => <CommCard key={c.id} comm={c} />)}
        </div>
      )}

      {/* Compose modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">New Communication</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <Icon name="close" size="sm" />
              </button>
            </div>

            {error && <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Recipients</label>
                <select
                  className="w-full text-sm border border-gray-200 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                >
                  {TARGET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Subject <span className="text-rose-500">*</span></label>
                <input
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Important update regarding school events"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Message <span className="text-rose-500">*</span></label>
                <textarea
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={6}
                  placeholder="Write your message to parents..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} className="rounded" />
                Send email notification to parents
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleSend}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                <Icon name="send" size="sm" />
                {saving ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
