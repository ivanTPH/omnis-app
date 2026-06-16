'use client'

import { useState, useEffect, useTransition } from 'react'
import Link                                    from 'next/link'
import Icon                                    from '@/components/ui/Icon'
import { getBulkIlpTargets, bulkUpdateIlpTargets } from '@/app/actions/send-support'
import type { BulkIlpTargetRow }               from '@/app/actions/send-support'

const STATUS_OPTIONS = [
  { value: 'active',       label: 'Active' },
  { value: 'achieved',     label: 'Achieved' },
  { value: 'not_achieved', label: 'Not achieved' },
  { value: 'deferred',     label: 'Deferred' },
]

const STATUS_PILL: Record<string, string> = {
  active:       'bg-blue-100 text-blue-700',
  achieved:     'bg-emerald-100 text-emerald-700',
  not_achieved: 'bg-rose-100 text-rose-700',
  deferred:     'bg-amber-100 text-amber-700',
}

export default function SencoBulkReviewPage() {
  const [targets, setTargets]     = useState<BulkIlpTargetRow[]>([])
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [loading, setLoading]     = useState(true)
  const [saving, startSave]       = useTransition()
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [filter, setFilter]       = useState<'active' | 'all'>('active')

  useEffect(() => {
    getBulkIlpTargets()
      .then(rows => { setTargets(rows); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const displayed = filter === 'active'
    ? targets.filter(t => (overrides[t.targetId] ?? t.status) === 'active')
    : targets

  const dirtyCount = Object.keys(overrides).length

  function setStatus(targetId: string, newStatus: string) {
    setOverrides(prev => {
      const orig = targets.find(t => t.targetId === targetId)?.status
      if (orig === newStatus) {
        const next = { ...prev }
        delete next[targetId]
        return next
      }
      return { ...prev, [targetId]: newStatus }
    })
    setSavedCount(null)
  }

  function handleSave() {
    if (dirtyCount === 0) return
    const updates = Object.entries(overrides).map(([targetId, status]) => ({ targetId, status }))
    startSave(async () => {
      const result = await bulkUpdateIlpTargets(updates)
      if (result.ok) {
        setSavedCount(result.updated)
        setOverrides({})
        const fresh = await getBulkIlpTargets()
        setTargets(fresh)
      }
    })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Link href="/senco/ilp" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <Icon name="chevron_left" size="sm" /> ILP Records
        </Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Bulk Target Review</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            Update ILP target statuses across all students in one action
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedCount != null && (
            <span className="flex items-center gap-1 text-[12px] text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
              <Icon name="check_circle" size="sm" />
              {savedCount} target{savedCount !== 1 ? 's' : ''} updated
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={dirtyCount === 0 || saving}
            className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {saving
              ? <Icon name="refresh" size="sm" className="animate-spin" />
              : <Icon name="save" size="sm" />}
            Save{dirtyCount > 0 ? ` (${dirtyCount})` : ''}
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 mb-4">
        {(['active', 'all'] as const).map(key => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
              filter === key
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {key === 'active' ? 'Active only' : 'All targets'}
          </button>
        ))}
        <span className="ml-auto text-[12px] text-gray-400">{displayed.length} targets</span>
      </div>

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl py-12 text-center">
          <Icon name="refresh" size="md" className="text-gray-300 animate-spin mx-auto mb-3" />
          <p className="text-[13px] text-gray-400">Loading targets…</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-12 text-center">
          <Icon name="check_circle" size="lg" color="#d1d5db" />
          <p className="text-sm text-gray-500 mt-3">
            {filter === 'active' ? 'No active targets — all reviewed!' : 'No ILP targets found.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Student</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Target</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden md:table-cell">Strategy</th>
                <th className="text-center px-4 py-2.5 font-semibold text-gray-500 w-24">Due</th>
                <th className="text-right px-4 py-2.5 font-semibold text-gray-500 w-36">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayed.map(t => {
                const current = overrides[t.targetId] ?? t.status
                const isDirty = current !== t.status
                return (
                  <tr key={t.targetId} className={`hover:bg-gray-50 transition-colors ${isDirty ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{t.studentName}</p>
                      {t.yearGroup && <p className="text-[10px] text-gray-400">Year {t.yearGroup}</p>}
                    </td>
                    <td className="px-4 py-2.5 max-w-[200px]">
                      <p className="truncate text-gray-700" title={t.target}>{t.target}</p>
                    </td>
                    <td className="px-4 py-2.5 max-w-[160px] hidden md:table-cell">
                      <p className="truncate text-gray-500" title={t.strategy}>{t.strategy}</p>
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-500">
                      {new Date(t.targetDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <select
                        value={current}
                        onChange={e => setStatus(t.targetId, e.target.value)}
                        className={`text-[11px] font-semibold px-2 py-1 rounded cursor-pointer border-0 outline-none ${STATUS_PILL[current] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {STATUS_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sticky save bar */}
      {dirtyCount > 0 && (
        <div className="fixed bottom-6 right-6 bg-blue-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50">
          <span className="text-[13px] font-medium">{dirtyCount} unsaved change{dirtyCount !== 1 ? 's' : ''}</span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-[12px] font-semibold underline hover:no-underline disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save now'}
          </button>
        </div>
      )}
    </div>
  )
}
