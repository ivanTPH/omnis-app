'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import type { SencoDashboardData } from '@/app/actions/send-support'
import { triggerEarlyWarningAnalysis, reviewConcern, updateSendStatus } from '@/app/actions/send-support'
import { ConcernStatusBadge } from './ConcernList'
import { SeverityBadge } from './EarlyWarningPanel'

type Props = { data: SencoDashboardData }

export default function SencoDashboard({ data }: Props) {
  const router = useRouter()
  const [running,       setRunning]       = useState(false)
  const [result,        setResult]        = useState<{ flagsCreated: number } | null>(null)
  const [reviewing,     setReviewing]     = useState<string | null>(null)
  const [settingSen,    setSettingSen]    = useState<string | null>(null)
  const [reviewNotes,   setReviewNotes]   = useState<Record<string, string>>({})
  const [isPending,     startTransition]  = useTransition()

  async function runAnalysis() {
    setRunning(true)
    try {
      const r = await triggerEarlyWarningAnalysis()
      setResult(r)
    } finally {
      setRunning(false)
    }
  }

  async function handleReview(concernId: string) {
    setReviewing(concernId)
    try {
      await reviewConcern(concernId, 'under_review', reviewNotes[concernId] ?? '')
      router.refresh()
    } catch (err) {
      console.error('[SencoDashboard] review failed:', err)
    } finally {
      setReviewing(null)
    }
  }

  async function handleSetSenSupport(studentId: string, concernId: string) {
    setSettingSen(concernId)
    try {
      await updateSendStatus(studentId, 'SEN_SUPPORT')
      await reviewConcern(concernId, 'under_review', 'Student status updated to SEN Support.')
      router.refresh()
    } catch (err) {
      console.error('[SencoDashboard] set SEN support failed:', err)
    } finally {
      setSettingSen(null)
    }
  }

  const kpis = [
    { label: 'Open Concerns',      value: data.openConcerns,      iconName: 'warning',         color: data.openConcerns > 0 ? 'text-amber-600' : 'text-gray-400' },
    { label: 'High Severity Flags', value: data.highSeverityFlags, iconName: 'radar',           color: data.highSeverityFlags > 0 ? 'text-red-600' : 'text-gray-400' },
    { label: 'Students with ILP',  value: data.studentsWithIlp,   iconName: 'favorite_border', color: 'text-blue-600' },
    { label: 'Reviews Due (14d)',   value: data.ilpReviewsDue,     iconName: 'schedule',        color: data.ilpReviewsDue > 0 ? 'text-orange-600' : 'text-gray-400' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name={k.iconName} size="md" className={k.color} />
              <span className="text-xs text-gray-500 font-medium">{k.label}</span>
            </div>
            <div className={`text-3xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Run analysis button */}
      <div className="flex items-center gap-4">
        <button
          onClick={runAnalysis}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Icon name="trending_up" size="sm" />
          {running ? 'Analysing…' : 'Run Early Warning Analysis'}
        </button>
        {result && (
          <span className="text-sm text-gray-600">
            {result.flagsCreated === 0 ? 'No new flags detected.' : `${result.flagsCreated} new flag${result.flagsCreated > 1 ? 's' : ''} created.`}
          </span>
        )}
      </div>

      {/* Open Concerns — action required */}
      {data.openConcernsList.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-100 flex items-center gap-2 bg-amber-50">
            <Icon name="flag" size="sm" className="text-amber-500" />
            <h3 className="font-semibold text-amber-900 text-sm">
              Open Concerns — Action Required
            </h3>
            <span className="ml-auto text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">
              {data.openConcernsList.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {data.openConcernsList.map(c => {
              const urgency = c.evidenceNotes?.startsWith('urgency:') ? c.evidenceNotes.slice(8) : null
              return (
                <div key={c.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{c.studentName}</p>
                        {urgency === 'urgent' && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                            Urgent
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Raised by {c.raiserName} · {new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">{c.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={reviewNotes[c.id] ?? ''}
                      onChange={e => setReviewNotes(n => ({ ...n, [c.id]: e.target.value }))}
                      placeholder="Add review note (optional)"
                      className="flex-1 min-w-[140px] text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleReview(c.id)}
                      disabled={reviewing === c.id || settingSen === c.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 disabled:opacity-50 text-blue-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      {reviewing === c.id
                        ? <Icon name="refresh" size="sm" className="animate-spin" />
                        : <Icon name="done" size="sm" />}
                      Mark Reviewed
                    </button>
                    <button
                      onClick={() => handleSetSenSupport(c.studentId, c.id)}
                      disabled={reviewing === c.id || settingSen === c.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 hover:bg-purple-200 disabled:opacity-50 text-purple-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      {settingSen === c.id
                        ? <Icon name="refresh" size="sm" className="animate-spin" />
                        : <Icon name="person_add" size="sm" />}
                      Set SEN Support
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent concerns */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Icon name="warning" size="sm" className="text-amber-500" />
            <h3 className="font-medium text-gray-900 text-sm">Recent Concerns</h3>
          </div>
          {data.recentConcerns.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No concerns raised.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.recentConcerns.map(c => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.studentName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.category} · raised by {c.raiserName}</p>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-1">{c.description}</p>
                    </div>
                    <ConcernStatusBadge status={c.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active flags */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Icon name="radar" size="sm" className="text-blue-500" />
            <h3 className="font-medium text-gray-900 text-sm">Active Warning Flags</h3>
          </div>
          {data.activeFlags.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No active flags.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.activeFlags.map(f => (
                <div key={f.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{f.studentName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{f.flagType.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{f.description}</p>
                    </div>
                    <SeverityBadge severity={f.severity} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Links */}
      <div className="flex gap-3 flex-wrap">
        <a href="/senco/concerns" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="warning" size="sm" /> All Concerns
        </a>
        <a href="/senco/ilp" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="favorite_border" size="sm" /> ILP Records
        </a>
        <a href="/senco/early-warning" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="radar" size="sm" /> Early Warning
        </a>
        <a href="/send-scorer" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="people" size="sm" /> Resource Scorer
        </a>
      </div>
    </div>
  )
}
