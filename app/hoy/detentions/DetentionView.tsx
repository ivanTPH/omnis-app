'use client'
import { useState, useTransition }  from 'react'
import Icon                          from '@/components/ui/Icon'
import Link                          from 'next/link'
import {
  getDetentionRegister, logDetention, resolveDetention, deleteDetention,
  type DetentionRow, type DetentionRegister,
} from '@/app/actions/detentions'

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  lunchtime:    'Lunchtime',
  after_school: 'After School',
  morning:      'Morning',
  isolation:    'Isolation',
}
const TYPE_COLORS: Record<string, string> = {
  lunchtime:    'bg-amber-100 text-amber-700',
  after_school: 'bg-blue-100 text-blue-700',
  morning:      'bg-purple-100 text-purple-700',
  isolation:    'bg-rose-100 text-rose-700',
}
const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  attended:  'bg-emerald-100 text-emerald-700',
  missed:    'bg-rose-100 text-rose-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const YEARS = [7, 8, 9, 10, 11, 12, 13]

// ── Row ───────────────────────────────────────────────────────────────────────

function DetRow({
  d, onResolved, onDeleted,
}: {
  d:          DetentionRow
  onResolved: (id: string, status: 'attended' | 'missed' | 'cancelled') => void
  onDeleted:  (id: string) => void
}) {
  const [, start] = useTransition()
  const date    = new Date(d.scheduledAt)
  const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-2.5">
        <Link href={`/students/${d.studentId}`} className="font-medium text-gray-900 hover:text-blue-600 text-[12px]">
          {d.studentName}
        </Link>
        {d.yearGroup && <span className="ml-1.5 text-[10px] text-gray-400">Y{d.yearGroup}</span>}
      </td>
      <td className="px-4 py-2.5">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${TYPE_COLORS[d.type] ?? 'bg-gray-100 text-gray-600'}`}>
          {TYPE_LABELS[d.type] ?? d.type}
        </span>
      </td>
      <td className="px-4 py-2.5 text-[12px] text-gray-600 max-w-[180px] truncate">{d.reason}</td>
      <td className="px-4 py-2.5 text-[11px] text-gray-500 whitespace-nowrap">
        <div>{dateStr}</div>
        <div className="text-gray-400">{timeStr} · {d.durationMins}min{d.location ? ` · ${d.location}` : ''}</div>
      </td>
      <td className="px-4 py-2.5">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[d.status] ?? 'bg-gray-100 text-gray-500'}`}>
          {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
        </span>
        {d.parentNotified && (
          <div className="flex items-center gap-0.5 text-[10px] text-emerald-600 mt-0.5">
            <Icon name="email" size="sm" /><span>Parent notified</span>
          </div>
        )}
      </td>
      <td className="px-4 py-2.5 text-[11px] text-gray-400">{d.authorName}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1 flex-wrap">
          {d.status === 'scheduled' && (
            <>
              <button
                onClick={() => start(async () => { const r = await resolveDetention(d.id, 'attended'); if (r.ok) onResolved(d.id, 'attended') })}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
              >
                Attended
              </button>
              <button
                onClick={() => start(async () => { const r = await resolveDetention(d.id, 'missed'); if (r.ok) onResolved(d.id, 'missed') })}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors"
              >
                Missed
              </button>
              <button
                onClick={() => start(async () => { const r = await resolveDetention(d.id, 'cancelled'); if (r.ok) onResolved(d.id, 'cancelled') })}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
          <button
            onClick={() => start(async () => { const r = await deleteDetention(d.id); if (r.ok) onDeleted(d.id) })}
            className="p-1 text-gray-300 hover:text-rose-500 transition-colors"
            title="Delete"
          >
            <Icon name="delete" size="sm" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  title, icon, rows, showActions, badgeColor, onResolved, onDeleted,
}: {
  title:      string
  icon:       string
  rows:       DetentionRow[]
  showActions: boolean
  badgeColor?: string
  onResolved: (id: string, status: 'attended' | 'missed' | 'cancelled') => void
  onDeleted:  (id: string) => void
}) {
  if (rows.length === 0) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <Icon name={icon} size="sm" className="text-gray-500" />
        <h2 className="text-[13px] font-semibold text-gray-800">{title}</h2>
        <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor ?? 'bg-gray-100 text-gray-600'}`}>
          {rows.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2 font-semibold text-gray-400">Student</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-400">Type</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-400">Reason</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-400">Scheduled</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-400">Status</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-400">Set by</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map(d => (
              <DetRow key={d.id} d={d} onResolved={showActions ? onResolved : () => {}} onDeleted={onDeleted} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Log form modal ────────────────────────────────────────────────────────────

function LogForm({ onLogged }: { onLogged: () => void }) {
  const [open, setOpen]         = useState(false)
  const [studentId, setStudId]  = useState('')
  const [type, setType]         = useState('after_school')
  const [reason, setReason]     = useState('')
  const [date, setDate]         = useState(() => {
    const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1)
    return d.toISOString().slice(0, 16)
  })
  const [duration, setDuration] = useState(30)
  const [location, setLocation] = useState('')
  const [notify, setNotify]     = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function save() {
    if (!studentId.trim() || !reason.trim()) { setError('Student ID and reason are required'); return }
    setSaving(true); setError('')
    const res = await logDetention({
      studentId: studentId.trim(), type, reason: reason.trim(),
      scheduledAt:  new Date(date).toISOString(),
      durationMins: duration,
      location:     location || undefined,
      notifyParent: notify,
    })
    setSaving(false)
    if (!res.ok) { setError(res.error ?? 'Failed'); return }
    setStudId(''); setReason(''); setLocation(''); setOpen(false)
    onLogged()
  }

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
    >
      <Icon name="add" size="sm" /> Log Detention
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-gray-900">Log Detention</h3>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
            <Icon name="close" size="md" />
          </button>
        </div>

        {error && <p className="mb-3 text-[12px] text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Student ID</label>
            <input
              value={studentId} onChange={e => setStudId(e.target.value)}
              placeholder="Paste from /students/[id] URL"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Type</label>
            <select
              value={type} onChange={e => setType(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="lunchtime">Lunchtime</option>
              <option value="after_school">After School</option>
              <option value="morning">Morning</option>
              <option value="isolation">Isolation</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Reason</label>
            <textarea
              value={reason} onChange={e => setReason(e.target.value)} rows={2}
              placeholder="Brief reason for detention…"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Date & Time</label>
              <input
                type="datetime-local" value={date} onChange={e => setDate(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Duration (min)</label>
              <input
                type="number" value={duration} onChange={e => setDuration(Number(e.target.value))}
                min={5} max={180} step={5}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Location (optional)</label>
            <input
              value={location} onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Room 101, Sports Hall…"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} className="rounded" />
            <span className="text-[12px] text-gray-700">Notify parent by email</span>
          </label>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 px-4 py-2 text-[12px] font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save} disabled={saving}
            className="flex-1 px-4 py-2 text-[12px] font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Log Detention'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function DetentionView({
  initialData,
  initialYear,
}: {
  initialData: DetentionRegister
  initialYear: number | undefined
}) {
  const [data, setData]         = useState<DetentionRegister>(initialData)
  const [yearGroup, setYearGroup] = useState<number | undefined>(initialYear)
  const [loading, setLoading]   = useState(false)

  async function reloadYear(y: number | undefined) {
    setYearGroup(y); setLoading(true)
    const d = await getDetentionRegister(y)
    setData(d); setLoading(false)
  }

  function handleResolved(id: string, status: 'attended' | 'missed' | 'cancelled') {
    setData(prev => {
      const update = (rows: DetentionRow[]) => rows.map(r => r.id === id ? { ...r, status } : r)
      return { ...prev, upcoming: update(prev.upcoming), today: update(prev.today), missed: update(prev.missed), pastWeek: update(prev.pastWeek) }
    })
  }

  function handleDeleted(id: string) {
    setData(prev => {
      const remove = (rows: DetentionRow[]) => rows.filter(r => r.id !== id)
      return { ...prev, upcoming: remove(prev.upcoming), today: remove(prev.today), missed: remove(prev.missed), pastWeek: remove(prev.pastWeek) }
    })
  }

  const totalToday    = data.today.length
  const totalUpcoming = data.upcoming.length
  const totalMissed   = data.missed.length
  const totalAttended = data.pastWeek.filter(d => d.status === 'attended').length

  return (
    <main className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/hoy/dashboard" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                <Icon name="chevron_left" size="sm" /> Dashboard
              </Link>
            </div>
            <h1 className="text-[22px] font-bold text-gray-900">Detention Register</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">Manage and track student detentions</p>
          </div>
          <LogForm onLogged={() => reloadYear(yearGroup)} />
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Today',    value: totalToday,    color: totalToday > 0 ? 'text-blue-600' : 'text-gray-300' },
            { label: 'Upcoming', value: totalUpcoming, color: 'text-gray-900' },
            { label: 'Missed',   value: totalMissed,   color: totalMissed > 0 ? 'text-rose-600' : 'text-gray-300' },
            { label: 'Attended this week', value: totalAttended, color: 'text-emerald-600' },
          ].map(k => (
            <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className={`text-[24px] font-bold ${k.color}`}>{k.value}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Year filter */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => reloadYear(undefined)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${!yearGroup ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            All Years
          </button>
          {YEARS.map(y => (
            <button
              key={y}
              onClick={() => reloadYear(y)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${yearGroup === y ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              Year {y}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <Icon name="refresh" size="lg" className="text-gray-300 mx-auto mb-3 animate-spin" />
          </div>
        ) : totalToday === 0 && totalUpcoming === 0 && totalMissed === 0 && data.pastWeek.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
            <Icon name="event_available" size="lg" className="text-gray-300 mx-auto mb-3" />
            <p className="text-[13px] text-gray-500 font-medium">No detentions recorded</p>
            <p className="text-[11px] text-gray-400 mt-1">Use &quot;Log Detention&quot; to add one.</p>
          </div>
        ) : (
          <>
            <Section title="Today's Detentions" icon="today" rows={data.today} showActions badgeColor="bg-blue-100 text-blue-700" onResolved={handleResolved} onDeleted={handleDeleted} />
            <Section title="Upcoming" icon="schedule" rows={data.upcoming} showActions onResolved={handleResolved} onDeleted={handleDeleted} />
            <Section title="Missed Detentions" icon="warning" rows={data.missed} showActions badgeColor="bg-rose-100 text-rose-700" onResolved={handleResolved} onDeleted={handleDeleted} />
            <Section title="Completed This Week" icon="check_circle" rows={data.pastWeek} showActions={false} onResolved={handleResolved} onDeleted={handleDeleted} />
          </>
        )}
      </div>
    </main>
  )
}
