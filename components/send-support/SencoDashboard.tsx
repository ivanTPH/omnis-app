'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { SencoDashboardData } from '@/app/actions/send-support'
import { triggerEarlyWarningAnalysis } from '@/app/actions/send-support'
import { ConcernStatusBadge } from './ConcernList'
import { SeverityBadge } from './EarlyWarningPanel'

type Props = { data: SencoDashboardData }

export default function SencoDashboard({ data }: Props) {
  const [running, setRunning] = useState(false)
  const [result,  setResult]  = useState<{ flagsCreated: number } | null>(null)

  async function runAnalysis() {
    setRunning(true)
    try {
      const r = await triggerEarlyWarningAnalysis()
      setResult(r)
    } finally {
      setRunning(false)
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
          <div key={k.label} className="card-stat">
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
            {data.openConcernsList.map(c => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{c.studentName}</p>
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                        {c.category.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Raised by {c.raiserName} · {new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">{c.description}</p>
                  </div>
                </div>
              </div>
            ))}
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

      {/* Upcoming Reviews — 30-day schedule */}
      {data.upcomingReviews.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-blue-50">
            <div className="flex items-center gap-2">
              <Icon name="calendar_today" size="sm" className="text-blue-600" />
              <h3 className="font-semibold text-blue-900 text-sm">Upcoming Reviews — Next 30 Days</h3>
            </div>
            <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-medium">
              {data.upcomingReviews.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {data.upcomingReviews.map(r => (
              <div key={r.ilpId} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.studentName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.planType} · {r.sendCategory}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-[12px] font-semibold text-gray-700">
                      {new Date(r.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      r.daysUntil <= 7
                        ? 'bg-red-100 text-red-700'
                        : r.daysUntil <= 14
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {r.daysUntil === 0 ? 'Today' : r.daysUntil === 1 ? 'Tomorrow' : `${r.daysUntil}d`}
                    </span>
                  </div>
                  <Link
                    href="/senco/ilp"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Go to ILP records"
                  >
                    <Icon name="arrow_forward" size="sm" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50">
            <Link href="/senco/ilp" className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
              View all ILP records <Icon name="arrow_forward" size="sm" />
            </Link>
          </div>
        </div>
      )}

      {/* Plan Coherence Alerts (from AI Plan Synthesis agent) */}
      {data.planCoherenceAlerts.length > 0 && (
        <div className="bg-white border border-purple-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-purple-100 flex items-center gap-2 bg-purple-50">
            <Icon name="smart_toy" size="sm" className="text-purple-600" />
            <h3 className="font-semibold text-purple-900 text-sm">AI Plan Coherence Review</h3>
            <span className="ml-auto text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-medium">
              {data.planCoherenceAlerts.length} student{data.planCoherenceAlerts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {data.planCoherenceAlerts.map(a => {
              const hasUrgent = a.ilpCoherence === 'URGENT' || a.ehcpCoherence === 'URGENT' || a.kPlanCoherence === 'URGENT'
              const badgeCls = (v: string) =>
                v === 'URGENT'       ? 'bg-red-100 text-red-700 border border-red-200' :
                v === 'REVIEW_NEEDED'? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                      'bg-green-100 text-green-700 border border-green-200'
              return (
                <div key={a.studentId} className={`px-4 py-3 ${hasUrgent ? 'bg-red-50/30' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{a.studentName}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {a.ilpCoherence !== 'OK' && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeCls(a.ilpCoherence)}`}>
                            ILP · {a.ilpCoherence.replace('_', ' ')}
                          </span>
                        )}
                        {a.ehcpCoherence !== 'OK' && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeCls(a.ehcpCoherence)}`}>
                            EHCP · {a.ehcpCoherence.replace('_', ' ')}
                          </span>
                        )}
                        {a.kPlanCoherence !== 'OK' && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeCls(a.kPlanCoherence)}`}>
                            K Plan · {a.kPlanCoherence.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      {a.summaryNarrative && (
                        <p className="text-xs text-gray-600 mt-1.5 leading-snug line-clamp-2">{a.summaryNarrative}</p>
                      )}
                    </div>
                    <Link
                      href={`/senco/ilp`}
                      className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                      title="View ILP"
                    >
                      <Icon name="arrow_forward" size="sm" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="px-4 py-2 border-t border-gray-50 bg-gray-50">
            <p className="text-[10px] text-gray-400 italic">AI plan review runs nightly — flag is advisory only</p>
          </div>
        </div>
      )}

      {/* Links */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/senco/concerns" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="warning" size="sm" /> All Concerns
        </Link>
        <Link href="/senco/ilp" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="favorite_border" size="sm" /> ILP Records
        </Link>
        <Link href="/senco/early-warning" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="radar" size="sm" /> Early Warning
        </Link>
        <Link href="/send-scorer" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="people" size="sm" /> Resource Scorer
        </Link>
      </div>
    </div>
  )
}
