'use client'
import { useState, useTransition }  from 'react'
import Icon                          from '@/components/ui/Icon'
import Link                          from 'next/link'
import {
  getExclusionLog, logExclusion, resolveExclusion,
  type ExclusionRow, type ExclusionLog,
} from '@/app/actions/exclusions'

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  internal:   'Internal',
  fixed_term: 'Fixed-Term',
  permanent:  'Permanent',
}
const TYPE_COLORS: Record<string, string> = {
  internal:   'bg-amber-100 text-amber-700',
  fixed_term: 'bg-orange-100 text-orange-700',
  permanent:  'bg-rose-100 text-rose-700',
}
const STATUS_COLORS: Record<string, string> = {
  active:    'bg-rose-100 text-rose-700',
  returned:  'bg-emerald-100 text-emerald-700',
  appealed:  'bg-amber-100 text-amber-700',
  overturned:'bg-purple-100 text-purple-700',
}

const YEARS = [7, 8, 9, 10, 11, 12, 13]

// ── Row ───────────────────────────────────────────────────────────────────────

function ExclRow({ e, onResolved }: { e: ExclusionRow; onResolved: (id: string, status: string) => void }) {
  const [showReintegrate, setShowReintegrate] = useState(false)
  const [plan, setPlan]   = useState(e.reintegrationPlan ?? '')
  const [, start] = useTransition()

  const startDate = new Date(e.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
  const endDate   = e.endDate ? new Date(e.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : null

  function resolve(status: string) {
    start(async () => {
      const r = await resolveExclusion(e.id, { status, reintegrationPlan: plan || undefined })
      if (r.ok) { onResolved(e.id, status); setShowReintegrate(false) }
    })
  }

  return (
    <>
      <tr className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${e.type === 'permanent' ? 'bg-rose-50/20' : ''}`}>
        <td className="px-4 py-2.5">
          <Link href={`/students/${e.studentId}`} className="font-medium text-gray-900 hover:text-blue-600 text-[12px]">
            {e.studentName}
          </Link>
          {e.yearGroup && <span className="ml-1.5 text-[10px] text-gray-400">Y{e.yearGroup}</span>}
          {e.sendStatus && (
            <span className="ml-1.5 inline-block px-1 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-800">
              {e.sendStatus.replace('_', ' ')}
            </span>
          )}
        </td>
        <td className="px-4 py-2.5">
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${TYPE_COLORS[e.type] ?? 'bg-gray-100 text-gray-600'}`}>
            {TYPE_LABELS[e.type] ?? e.type}
          </span>
        </td>
        <td className="px-4 py-2.5 text-[12px] text-gray-600 max-w-[180px] truncate">{e.reason}</td>
        <td className="px-4 py-2.5 text-[11px] text-gray-500 whitespace-nowrap">
          <div>{startDate}{endDate ? ` → ${endDate}` : ''}</div>
          <div className="text-gray-400">{e.daysCount} day{e.daysCount !== 1 ? 's' : ''}</div>
        </td>
        <td className="px-4 py-2.5">
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[e.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
          </span>
          {e.parentContacted && (
            <div className="flex items-center gap-0.5 text-[10px] text-emerald-600 mt-0.5">
              <Icon name="call" size="sm" /><span>Parent contacted</span>
            </div>
          )}
        </td>
        <td className="px-4 py-2.5 text-[11px] text-gray-400">{e.authorName}</td>
        <td className="px-4 py-2.5">
          {e.status === 'active' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowReintegrate(v => !v)}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
              >
                Return
              </button>
              <button
                onClick={() => resolve('appealed')}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
              >
                Appealed
              </button>
            </div>
          )}
        </td>
      </tr>
      {showReintegrate && (
        <tr>
          <td colSpan={7} className="px-4 pb-3 bg-emerald-50/50">
            <div className="flex items-start gap-2">
              <textarea
                value={plan} onChange={e => setPlan(e.target.value)} rows={2}
                placeholder="Reintegration plan (optional) — meeting notes, support arrangements, targets…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
              <button
                onClick={() => resolve('returned')}
                className="px-3 py-2 text-[11px] font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap"
              >
                Confirm Return
              </button>
              <button
                onClick={() => setShowReintegrate(false)}
                className="px-3 py-2 text-[11px] text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Log form ──────────────────────────────────────────────────────────────────

function LogForm({ onLogged }: { onLogged: () => void }) {
  const [open, setOpen]         = useState(false)
  const [studentId, setStudId]  = useState('')
  const [type, setType]         = useState('fixed_term')
  const [reason, setReason]     = useState('')
  const [startDate, setStart]   = useState(() => new Date().toISOString().slice(0, 10))
  const [endDate, setEnd]       = useState('')
  const [days, setDays]         = useState<number>(1)
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function save() {
    if (!studentId.trim() || !reason.trim()) { setError('Student ID and reason are required'); return }
    setSaving(true); setError('')
    const res = await logExclusion({
      studentId: studentId.trim(), type, reason: reason.trim(),
      startDate, endDate: endDate || undefined, daysCount: days,
      notes: notes || undefined,
    })
    setSaving(false)
    if (!res.ok) { setError(res.error ?? 'Failed'); return }
    setStudId(''); setReason(''); setEnd(''); setNotes(''); setOpen(false)
    onLogged()
  }

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors"
    >
      <Icon name="add" size="sm" /> Log Exclusion
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-gray-900">Log Exclusion</h3>
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
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Type</label>
            <select
              value={type} onChange={e => setType(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="internal">Internal (on-site)</option>
              <option value="fixed_term">Fixed-Term</option>
              <option value="permanent">Permanent</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Reason</label>
            <textarea
              value={reason} onChange={e => setReason(e.target.value)} rows={2}
              placeholder="Reason for exclusion…"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Start date</label>
              <input
                type="date" value={startDate} onChange={e => setStart(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">End date</label>
              <input
                type="date" value={endDate} onChange={e => setEnd(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Days</label>
              <input
                type="number" value={days} onChange={e => setDays(Number(e.target.value))}
                min={0.5} max={45} step={0.5}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Notes (optional)</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Additional context, parent meeting notes…"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />
          </div>
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
            className="flex-1 px-4 py-2 text-[12px] font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Log Exclusion'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function ExclusionView({
  initialData,
  initialYear,
}: {
  initialData: ExclusionLog
  initialYear: number | undefined
}) {
  const [data, setData]         = useState<ExclusionLog>(initialData)
  const [yearGroup, setYearGroup] = useState<number | undefined>(initialYear)
  const [loading, setLoading]   = useState(false)

  async function reloadYear(y: number | undefined) {
    setYearGroup(y); setLoading(true)
    const d = await getExclusionLog(y)
    setData(d); setLoading(false)
  }

  function handleResolved(id: string, status: string) {
    setData(prev => {
      const update = (rows: ExclusionRow[]) => rows.map(r => r.id === id ? { ...r, status } : r)
      // Move from active to recent if no longer active
      const updatedActive = prev.active.filter(r => r.id !== id)
      const resolvedRow = prev.active.find(r => r.id === id)
      const updatedRecent = resolvedRow
        ? [{ ...resolvedRow, status }, ...prev.recent]
        : update(prev.recent)
      return {
        ...prev,
        stats: { ...prev.stats, active: updatedActive.length },
        active: updatedActive,
        recent: updatedRecent,
      }
    })
  }

  const { stats, active, recent } = data

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
            <h1 className="text-[22px] font-bold text-gray-900">Exclusion Log</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              Current and historical exclusion records · last 3 months
            </p>
          </div>
          <LogForm onLogged={() => reloadYear(yearGroup)} />
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Total (3 mths)',  value: stats.total,     color: 'text-gray-900' },
            { label: 'Active',          value: stats.active,    color: stats.active > 0 ? 'text-rose-600' : 'text-gray-300' },
            { label: 'Fixed-Term',      value: stats.fixedTerm, color: 'text-orange-600' },
            { label: 'Internal',        value: stats.internal,  color: 'text-amber-600' },
            { label: 'Permanent',       value: stats.permanent, color: stats.permanent > 0 ? 'text-rose-700' : 'text-gray-300' },
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
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${!yearGroup ? 'bg-rose-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            All Years
          </button>
          {YEARS.map(y => (
            <button
              key={y}
              onClick={() => reloadYear(y)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${yearGroup === y ? 'bg-rose-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              Year {y}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <Icon name="refresh" size="lg" className="text-gray-300 mx-auto mb-3 animate-spin" />
          </div>
        ) : stats.total === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
            <Icon name="check_circle" size="lg" className="text-gray-300 mx-auto mb-3" />
            <p className="text-[13px] text-gray-500 font-medium">No exclusions recorded in this period</p>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div className="bg-white border border-rose-200 rounded-xl overflow-hidden mb-4">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-rose-100 bg-rose-50/50">
                  <Icon name="block" size="sm" className="text-rose-500" />
                  <h2 className="text-[13px] font-semibold text-rose-800">Active Exclusions</h2>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">{active.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-2 font-semibold text-gray-400">Student</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-400">Type</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-400">Reason</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-400">Dates</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-400">Status</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-400">Logged by</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {active.map(e => <ExclRow key={e.id} e={e} onResolved={handleResolved} />)}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {recent.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                  <Icon name="history" size="sm" className="text-gray-500" />
                  <h2 className="text-[13px] font-semibold text-gray-800">Recent (resolved/appealed)</h2>
                  <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{recent.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-2 font-semibold text-gray-400">Student</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-400">Type</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-400">Reason</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-400">Dates</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-400">Status</th>
                        <th className="text-left px-4 py-2 font-semibold text-gray-400">Logged by</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map(e => <ExclRow key={e.id} e={e} onResolved={handleResolved} />)}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
