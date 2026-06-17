'use client'

import { useState, useTransition } from 'react'
import { useRouter }               from 'next/navigation'
import Icon                        from '@/components/ui/Icon'
import {
  type SafeguardingLog,
  type SafeguardingRow,
  logSafeguardingRecord,
  updateSafeguardingRecord,
} from '@/app/actions/safeguarding'

const CATEGORIES = [
  'Abuse (physical)', 'Abuse (emotional)', 'Abuse (sexual)', 'Neglect',
  'Self-harm', 'Mental health concern', 'Domestic violence', 'Radicalisation',
  'CSE / exploitation', 'Bullying (severe)', 'Online safety', 'Other',
]
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const STATUSES   = ['open', 'referred', 'monitoring', 'closed']

const PRIORITY_PILL: Record<string, string> = {
  low:      'bg-gray-100 text-gray-600',
  medium:   'bg-amber-100 text-amber-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-rose-100 text-rose-700',
}
const STATUS_PILL: Record<string, string> = {
  open:       'bg-blue-100 text-blue-700',
  referred:   'bg-purple-100 text-purple-700',
  monitoring: 'bg-amber-100 text-amber-700',
  closed:     'bg-green-100 text-green-700',
}

function RecordCard({
  record,
  onUpdate,
}: {
  record: SafeguardingRow
  onUpdate: (id: string, data: { status?: string; dslNotes?: string }) => void
}) {
  const [expanded, setExpanded]   = useState(false)
  const [dslNotes, setDslNotes]   = useState(record.dslNotes ?? '')
  const [status, setStatus]       = useState(record.status)
  const [saving, startSave]       = useTransition()

  const handleSave = () => {
    startSave(async () => {
      await onUpdate(record.id, { status, dslNotes })
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <Icon name={expanded ? 'expand_less' : 'expand_more'} size="sm" className="mt-0.5 text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900">{record.studentName}</span>
            {record.yearGroup && <span className="text-xs text-gray-400">Y{record.yearGroup}</span>}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${PRIORITY_PILL[record.priority] ?? 'bg-gray-100 text-gray-600'}`}>
              {record.priority}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[record.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {record.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{record.category} · logged by {record.authorName} · {new Date(record.createdAt).toLocaleDateString('en-GB')}</p>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{record.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Status</label>
              <select
                className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">DSL Referred</p>
              <p className="text-sm text-gray-800">{record.referredToDSL ? 'Yes' : 'No'}</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">DSL Notes</label>
            <textarea
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={3}
              placeholder="Add DSL notes..."
              value={dslNotes}
              onChange={e => setDslNotes(e.target.value)}
            />
          </div>

          {record.resolvedAt && (
            <p className="text-xs text-gray-400">Resolved: {new Date(record.resolvedAt).toLocaleDateString('en-GB')}</p>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SafeguardingView({ log }: { log: SafeguardingLog }) {
  const router   = useRouter()
  const [showLog, setShowLog]   = useState<SafeguardingRow[]>(log.open)
  const [activeSection, setActiveSection] = useState<'open' | 'referred' | 'monitoring' | 'closed'>('open')
  const [showModal, setShowModal] = useState(false)
  const [, startTransition]     = useTransition()

  // Log modal state
  const [studentId, setStudentId]     = useState('')
  const [category, setCategory]       = useState(CATEGORIES[0])
  const [priority, setPriority]       = useState('medium')
  const [description, setDescription] = useState('')
  const [referredToDSL, setReferredToDSL] = useState(false)
  const [dslNotes, setDslNotes]       = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const sections: Array<{ key: 'open' | 'referred' | 'monitoring' | 'closed'; label: string; colour: string; data: SafeguardingRow[] }> = [
    { key: 'open',       label: 'Open',       colour: 'bg-blue-50 text-blue-800',   data: log.open },
    { key: 'referred',   label: 'Referred',   colour: 'bg-purple-50 text-purple-800', data: log.referred },
    { key: 'monitoring', label: 'Monitoring', colour: 'bg-amber-50 text-amber-800', data: log.monitoring },
    { key: 'closed',     label: 'Closed',     colour: 'bg-green-50 text-green-800',  data: log.closed },
  ]

  const switchSection = (key: typeof activeSection) => {
    setActiveSection(key)
    setShowLog(log[key])
  }

  const handleUpdate = async (id: string, data: { status?: string; dslNotes?: string }) => {
    await updateSafeguardingRecord(id, data)
    router.refresh()
  }

  const handleLog = async () => {
    if (!studentId.trim()) { setError('Student ID required'); return }
    if (!description.trim()) { setError('Description required'); return }
    setSaving(true)
    setError(null)
    const res = await logSafeguardingRecord({ studentId: studentId.trim(), category, priority, description, referredToDSL, dslNotes: dslNotes || undefined })
    setSaving(false)
    if (!res.ok) { setError(res.error ?? 'Failed'); return }
    setShowModal(false)
    setStudentId(''); setDescription(''); setDslNotes(''); setReferredToDSL(false)
    startTransition(() => router.refresh())
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Safeguarding Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">Confidential — authorised staff only</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700"
        >
          <Icon name="add_alert" size="sm" />
          Log concern
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: log.stats.total, colour: 'text-gray-800' },
          { label: 'Open', value: log.stats.open, colour: 'text-blue-700' },
          { label: 'Referred', value: log.stats.referred, colour: 'text-purple-700' },
          { label: 'Critical', value: log.stats.critical, colour: 'text-rose-700' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className={`text-3xl font-bold ${stat.colour}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Section tabs */}
      <div className="flex gap-2">
        {sections.map(s => (
          <button
            key={s.key}
            onClick={() => switchSection(s.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeSection === s.key ? s.colour + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            {s.label} ({s.data.length})
          </button>
        ))}
      </div>

      {/* Records */}
      <div className="space-y-2">
        {showLog.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Icon name="shield" size="lg" className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No {activeSection} records</p>
          </div>
        ) : (
          showLog.map(r => (
            <RecordCard key={r.id} record={r} onUpdate={handleUpdate} />
          ))
        )}
      </div>

      {/* Log modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Log Safeguarding Concern</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <Icon name="close" size="sm" />
              </button>
            </div>

            {error && <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Student ID <span className="text-rose-500">*</span></label>
                <input
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Paste student user ID"
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Category</label>
                  <select
                    className="w-full text-sm border border-gray-200 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Priority</label>
                  <select
                    className="w-full text-sm border border-gray-200 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                  >
                    {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Description <span className="text-rose-500">*</span></label>
                <textarea
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={4}
                  placeholder="Describe the concern in detail..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={referredToDSL} onChange={e => setReferredToDSL(e.target.checked)} className="rounded" />
                Referred to DSL (Designated Safeguarding Lead)
              </label>

              {referredToDSL && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">DSL Notes</label>
                  <textarea
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    rows={2}
                    placeholder="Notes from DSL discussion..."
                    value={dslNotes}
                    onChange={e => setDslNotes(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleLog}
                disabled={saving}
                className="px-4 py-2 bg-rose-600 text-white text-sm rounded-lg hover:bg-rose-700 disabled:opacity-50"
              >
                {saving ? 'Logging…' : 'Log concern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
