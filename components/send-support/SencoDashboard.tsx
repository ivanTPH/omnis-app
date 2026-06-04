'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { SencoDashboardData } from '@/app/actions/send-support'
import { triggerEarlyWarningAnalysis, generateILPFromConcern } from '@/app/actions/send-support'
import { ConcernStatusBadge } from './ConcernList'
import { SeverityBadge } from './EarlyWarningPanel'

type Props = { data: SencoDashboardData }

const COLLAPSED_COUNT = 5

export default function SencoDashboard({ data }: Props) {
  const [running,          setRunning]          = useState(false)
  const [result,           setResult]           = useState<{ flagsCreated: number } | null>(null)
  const [reviewsExpanded,  setReviewsExpanded]  = useState(false)
  const [alertsExpanded,   setAlertsExpanded]   = useState(false)
  const [expandedAlert,    setExpandedAlert]    = useState<string | null>(null)
  const [ilpGenerating,    setIlpGenerating]    = useState<Record<string, boolean>>({})
  const [ilpDone,          setIlpDone]          = useState<Record<string, boolean>>({})
  const [ilpError,         setIlpError]         = useState<Record<string, string>>({})

  async function handleGenerateIlp(concernId: string, studentId: string) {
    setIlpGenerating(p => ({ ...p, [studentId]: true }))
    setIlpError(p => ({ ...p, [studentId]: '' }))
    try {
      const r = await generateILPFromConcern(concernId)
      if (r.success) {
        setIlpDone(p => ({ ...p, [studentId]: true }))
      } else {
        setIlpError(p => ({ ...p, [studentId]: r.error ?? 'Generation failed' }))
      }
    } catch {
      setIlpError(p => ({ ...p, [studentId]: 'Generation failed — please try again' }))
    } finally {
      setIlpGenerating(p => ({ ...p, [studentId]: false }))
    }
  }

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
    { label: 'Open Concerns',       value: data.openConcerns,      iconName: 'warning',         color: data.openConcerns > 0 ? 'text-amber-600' : 'text-gray-400',    href: '/senco/concerns' },
    { label: 'High Severity Flags', value: data.highSeverityFlags, iconName: 'radar',           color: data.highSeverityFlags > 0 ? 'text-red-600' : 'text-gray-400', href: '/senco/early-warning' },
    { label: 'Students with ILP',   value: data.studentsWithIlp,   iconName: 'favorite_border', color: 'text-blue-600',                                                href: '/senco/ilp' },
    { label: 'Reviews Due (14d)',    value: data.ilpReviewsDue,     iconName: 'schedule',        color: data.ilpReviewsDue > 0 ? 'text-orange-600' : 'text-gray-400',  href: '/senco/ilp' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* KPI row — each card links to the relevant section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <Link key={k.label} href={k.href} className="card-stat hover:shadow-md hover:border-gray-300 transition-all group">
            <div className="flex items-center gap-2 mb-2">
              <Icon name={k.iconName} size="md" className={k.color} />
              <span className="text-xs text-gray-500 font-medium">{k.label}</span>
              <Icon name="arrow_forward" size="sm" className="ml-auto text-gray-300 group-hover:text-gray-500 transition-colors" />
            </div>
            <div className={`text-3xl font-bold ${k.color}`}>{k.value}</div>
          </Link>
        ))}
      </div>

      {/* Concerns without ILP — action panel */}
      {data.concernsWithoutIlp.length > 0 && (
        <div className="bg-white border border-green-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-green-100 flex items-center gap-2 bg-green-50">
            <Icon name="auto_awesome" size="sm" className="text-green-600" />
            <h3 className="font-medium text-green-900 text-sm">Students with Concerns — No ILP Yet</h3>
            <span className="ml-auto text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-medium">
              {data.concernsWithoutIlp.length} student{data.concernsWithoutIlp.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {data.concernsWithoutIlp.map(c => (
              <div key={c.studentId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{c.studentName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.category} · {c.description.slice(0, 60)}{c.description.length > 60 ? '…' : ''}</p>
                  {ilpError[c.studentId] && <p className="text-xs text-red-500 mt-1">{ilpError[c.studentId]}</p>}
                </div>
                <div className="shrink-0">
                  {ilpDone[c.studentId] ? (
                    <Link href="/senco/ilp" className="flex items-center gap-1 text-xs text-green-700 font-medium hover:underline">
                      <Icon name="check_circle" size="sm" className="text-green-600" />
                      ILP created — View
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleGenerateIlp(c.id, c.studentId)}
                      disabled={ilpGenerating[c.studentId]}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      {ilpGenerating[c.studentId]
                        ? <><Icon name="refresh" size="sm" className="animate-spin" /> Generating…</>
                        : <><Icon name="description" size="sm" /> Generate ILP</>
                      }
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent concerns — each row links to the concerns page to review and action */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Icon name="warning" size="sm" className="text-amber-500" />
            <h3 className="font-medium text-gray-900 text-sm">Recent Concerns</h3>
            <Link href="/senco/concerns" className="ml-auto text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5">
              View all <Icon name="arrow_forward" size="sm" />
            </Link>
          </div>
          {data.recentConcerns.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No concerns raised.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.recentConcerns.map(c => (
                <Link
                  key={c.id}
                  href="/senco/concerns"
                  className="flex items-start justify-between gap-2 px-4 py-3 hover:bg-amber-50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-amber-900">{c.studentName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.category} · raised by {c.raiserName}</p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-1">{c.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <ConcernStatusBadge status={c.status} />
                    <Icon name="chevron_right" size="sm" className="text-gray-300 group-hover:text-amber-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Active flags — each row links to early warning page to dismiss/action */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Icon name="radar" size="sm" className="text-blue-500" />
            <h3 className="font-medium text-gray-900 text-sm">Active Warning Flags</h3>
            <Link href="/senco/early-warning" className="ml-auto text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5">
              View all <Icon name="arrow_forward" size="sm" />
            </Link>
          </div>
          {data.activeFlags.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No active flags.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.activeFlags.map(f => (
                <Link
                  key={f.id}
                  href="/senco/early-warning"
                  className="flex items-start justify-between gap-2 px-4 py-3 hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-blue-900">{f.studentName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{f.flagType.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{f.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <SeverityBadge severity={f.severity} />
                    <Icon name="chevron_right" size="sm" className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Reviews — 30-day schedule (collapsible) */}
      {data.upcomingReviews.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setReviewsExpanded(v => !v)}
            className="w-full px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-blue-50 hover:bg-blue-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Icon name="calendar_today" size="sm" className="text-blue-600" />
              <h3 className="font-semibold text-blue-900 text-sm">Upcoming Reviews — Next 30 Days</h3>
              <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                {data.upcomingReviews.length}
              </span>
            </div>
            <Icon name={reviewsExpanded ? 'expand_less' : 'expand_more'} size="sm" className="text-blue-600 shrink-0" />
          </button>
          <div className="divide-y divide-gray-50">
            {(reviewsExpanded ? data.upcomingReviews : data.upcomingReviews.slice(0, COLLAPSED_COUNT)).map(r => (
              <div key={r.ilpId} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.studentName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.planType} · {r.sendCategory}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-[12px] font-semibold text-gray-700">
                      {new Date(r.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      r.daysUntil <= 7  ? 'bg-red-100 text-red-700' :
                      r.daysUntil <= 14 ? 'bg-orange-100 text-orange-700' :
                                          'bg-blue-100 text-blue-700'
                    }`}>
                      {r.daysUntil === 0 ? 'Today' : r.daysUntil === 1 ? 'Tomorrow' : `${r.daysUntil}d`}
                    </span>
                  </div>
                  <Link href="/senco/ilp" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Go to ILP records">
                    <Icon name="arrow_forward" size="sm" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50 flex items-center justify-between">
            {data.upcomingReviews.length > COLLAPSED_COUNT && (
              <button onClick={() => setReviewsExpanded(v => !v)} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium">
                {reviewsExpanded ? 'Show less' : `Show all ${data.upcomingReviews.length}`}
              </button>
            )}
            <Link href="/senco/ilp" className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 ml-auto">
              View all ILP records <Icon name="arrow_forward" size="sm" />
            </Link>
          </div>
        </div>
      )}

      {/* Plan Coherence Alerts — collapsible, expandable rows */}
      {data.planCoherenceAlerts.length > 0 && (
        <div className="bg-white border border-purple-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setAlertsExpanded(v => !v)}
            className="w-full px-4 py-3 border-b border-purple-100 flex items-center gap-2 bg-purple-50 hover:bg-purple-100 transition-colors text-left"
          >
            <Icon name="smart_toy" size="sm" className="text-purple-600" />
            <h3 className="font-semibold text-purple-900 text-sm">AI Plan Coherence Review</h3>
            <span className="ml-auto text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-medium">
              {data.planCoherenceAlerts.length} student{data.planCoherenceAlerts.length !== 1 ? 's' : ''}
            </span>
            <Icon name={alertsExpanded ? 'expand_less' : 'expand_more'} size="sm" className="text-purple-600 shrink-0" />
          </button>
          <div className="divide-y divide-gray-50">
            {(alertsExpanded ? data.planCoherenceAlerts : data.planCoherenceAlerts.slice(0, COLLAPSED_COUNT)).map(a => {
              const hasUrgent = a.ilpCoherence === 'URGENT' || a.ehcpCoherence === 'URGENT' || a.kPlanCoherence === 'URGENT'
              const isOpen    = expandedAlert === a.studentId
              const badgeCls  = (v: string) =>
                v === 'URGENT'        ? 'bg-red-100 text-red-700 border border-red-200' :
                v === 'REVIEW_NEEDED' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                        'bg-green-100 text-green-700 border border-green-200'
              return (
                <div key={a.studentId} className={hasUrgent ? 'bg-red-50/30' : ''}>
                  <button
                    onClick={() => setExpandedAlert(isOpen ? null : a.studentId)}
                    className="w-full px-4 py-3 flex items-start gap-3 hover:bg-purple-50/40 transition-colors text-left"
                  >
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
                      {!isOpen && a.summaryNarrative && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{a.summaryNarrative}</p>
                      )}
                    </div>
                    <Icon name={isOpen ? 'expand_less' : 'expand_more'} size="sm" className="text-gray-400 shrink-0 mt-0.5" />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3 border-t border-purple-100 bg-purple-50/20">
                      {a.summaryNarrative && (
                        <p className="text-sm text-gray-700 leading-snug pt-3">{a.summaryNarrative}</p>
                      )}
                      {a.conflicts.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-1.5">Issues Detected</p>
                          <ul className="space-y-1">
                            {a.conflicts.map((c, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                <Icon name="report_problem" size="sm" className="text-amber-500 shrink-0 mt-0.5" />
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {a.suggestions.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider mb-1.5">Suggested Actions</p>
                          <ul className="space-y-1">
                            {a.suggestions.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                <Icon name="lightbulb" size="sm" className="text-purple-500 shrink-0 mt-0.5" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <Link
                        href="/senco/ilp"
                        className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium mt-1"
                      >
                        Open ILP Records <Icon name="arrow_forward" size="sm" />
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="px-4 py-2 border-t border-gray-50 bg-gray-50 flex items-center justify-between">
            {data.planCoherenceAlerts.length > COLLAPSED_COUNT && (
              <button onClick={() => setAlertsExpanded(v => !v)} className="text-[11px] text-purple-600 hover:text-purple-800 font-medium">
                {alertsExpanded ? 'Show less' : `Show all ${data.planCoherenceAlerts.length}`}
              </button>
            )}
            <p className="text-[10px] text-gray-400 italic ml-auto">AI plan review — advisory only</p>
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
