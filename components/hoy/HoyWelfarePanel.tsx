'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { HoyWelfareData } from '@/app/actions/hoy-welfare'

type Props = { data: HoyWelfareData }

const FLAG_LABELS: Record<string, string> = {
  homework_decline:  'Homework decline',
  completion_drop:   'Completion drop',
  score_decline:     'Score decline',
  pattern_absence:   'Attendance pattern',
  multiple_concerns: 'Multiple concerns',
}

const CONCERN_COLOURS: Record<string, string> = {
  open:         'bg-amber-100 text-amber-800',
  under_review: 'bg-blue-100 text-blue-800',
  escalated:    'bg-red-100 text-red-800',
  monitoring:   'bg-purple-100 text-purple-800',
}

function SendBadge({ status }: { status: string | null }) {
  if (!status) return null
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
      status === 'EHCP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
    }`}>
      {status === 'EHCP' ? 'EHCP' : 'SEN'}
    </span>
  )
}

export default function HoyWelfarePanel({ data }: Props) {
  const [flagsExpanded,   setFlagsExpanded]   = useState(false)
  const [reviewsExpanded, setReviewsExpanded] = useState(false)

  const kpis = [
    {
      label:   'Needing attention',
      value:   data.studentsNeedingAttention,
      icon:    'priority_high',
      colour:  data.studentsNeedingAttention > 0 ? 'text-red-600'    : 'text-gray-300',
      bg:      data.studentsNeedingAttention > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200',
    },
    {
      label:   'Open concerns',
      value:   data.openConcernsCount,
      icon:    'warning',
      colour:  data.openConcernsCount > 0 ? 'text-amber-600' : 'text-gray-300',
      bg:      data.openConcernsCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200',
    },
    {
      label:   'High-severity flags',
      value:   data.highFlagsCount,
      icon:    'radar',
      colour:  data.highFlagsCount > 0 ? 'text-rose-600'   : 'text-gray-300',
      bg:      data.highFlagsCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-gray-50 border-gray-200',
    },
    {
      label:   'ILP reviews (14d)',
      value:   data.ilpReviewsDue14d,
      icon:    'schedule',
      colour:  data.ilpReviewsDue14d > 0 ? 'text-blue-600'  : 'text-gray-300',
      bg:      data.ilpReviewsDue14d > 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200',
    },
  ]

  return (
    <div className="space-y-6">

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className={`border rounded-xl p-5 ${k.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide leading-tight">{k.label}</p>
              <Icon name={k.icon} size="sm" className={k.colour} />
            </div>
            <p className={`text-3xl font-bold ${k.colour}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {data.studentsNeedingAttention === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <Icon name="check_circle" size="lg" className="text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-green-900">No students need immediate attention</p>
          <p className="text-sm text-green-700 mt-1">
            {data.yearGroup ? `Year ${data.yearGroup}` : 'All students'} — no open concerns, high flags, or missed homework patterns detected.
          </p>
        </div>
      )}

      {/* Students needing attention */}
      {data.alerts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 bg-red-50 border-b border-red-100 flex items-center gap-2">
            <Icon name="priority_high" size="sm" className="text-red-600" />
            <h2 className="font-semibold text-red-900 text-sm">Students needing attention</h2>
            <span className="ml-auto text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-medium">
              {data.alerts.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {data.alerts.map(a => (
              <div key={a.studentId} className={`px-5 py-3.5 flex items-start gap-3 ${
                a.riskLevel === 'urgent' ? 'bg-red-50/40' : ''
              }`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  a.riskLevel === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {a.studentName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>

                {/* Name + badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{a.studentName}</span>
                    {a.yearGroup && (
                      <span className="text-[10px] text-gray-400">Yr {a.yearGroup}</span>
                    )}
                    <SendBadge status={a.sendStatus} />
                    {a.riskLevel === 'urgent' && (
                      <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Urgent</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {a.alerts.map((alert, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full border font-medium bg-white text-gray-700 border-gray-200">
                        {alert}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Link to student file */}
                <Link
                  href={`/students/${a.studentId}?tab=Pastoral`}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-emerald-600 transition-colors"
                  title="Open pastoral notes"
                >
                  <Icon name="open_in_new" size="sm" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail panels — concerns + flags side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Open SEND concerns */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Icon name="warning" size="sm" className="text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900">Open SEND Concerns</h3>
            <Link href="/senco/concerns" className="ml-auto text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5">
              View all <Icon name="arrow_forward" size="sm" />
            </Link>
          </div>
          {data.concerns.length === 0 ? (
            <p className="p-5 text-sm text-gray-400">No open concerns.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.concerns.map(c => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{c.studentName}</p>
                      <p className="text-xs text-gray-500 mt-0.5 capitalize">{c.category.replace(/_/g, ' ')} · raised by {c.raiserName}</p>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{c.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${CONCERN_COLOURS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-gray-400">{c.daysOpen}d open</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Early warning flags */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setFlagsExpanded(v => !v)}
            className="w-full px-4 py-3 border-b border-gray-100 flex items-center gap-2 text-left hover:bg-gray-50 transition-colors"
          >
            <Icon name="radar" size="sm" className="text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-900">Early Warning Flags</h3>
            <span className="ml-auto text-[11px] text-gray-400">{data.flags.length}</span>
            <Icon name={flagsExpanded ? 'expand_less' : 'expand_more'} size="sm" className="text-gray-400 shrink-0" />
          </button>
          {data.flags.length === 0 ? (
            <p className="p-5 text-sm text-gray-400">No active flags.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {(flagsExpanded ? data.flags : data.flags.slice(0, 5)).map(f => (
                <div key={f.id} className="px-4 py-3 flex items-start gap-3">
                  <span className={`mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    f.severity === 'high'   ? 'bg-red-100 text-red-700' :
                    f.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                                              'bg-gray-100 text-gray-600'
                  }`}>
                    {f.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{f.studentName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{FLAG_LABELS[f.flagType] ?? f.flagType} · {f.daysActive}d active</p>
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{f.description}</p>
                  </div>
                </div>
              ))}
              {data.flags.length > 5 && (
                <button
                  onClick={() => setFlagsExpanded(v => !v)}
                  className="w-full px-4 py-2.5 text-[11px] text-blue-600 hover:text-blue-800 font-medium text-center border-t border-gray-50"
                >
                  {flagsExpanded ? 'Show less' : `Show all ${data.flags.length} flags`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ILP reviews due */}
      {data.ilpReviews.length > 0 && (
        <div className="bg-white border border-blue-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setReviewsExpanded(v => !v)}
            className="w-full px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2 text-left hover:bg-blue-100 transition-colors"
          >
            <Icon name="schedule" size="sm" className="text-blue-600" />
            <h3 className="text-sm font-semibold text-blue-900">ILP Reviews Due — Next 14 Days</h3>
            <span className="ml-auto text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-medium">
              {data.ilpReviews.length}
            </span>
            <Icon name={reviewsExpanded ? 'expand_less' : 'expand_more'} size="sm" className="text-blue-600 shrink-0" />
          </button>
          <div className="divide-y divide-gray-50">
            {(reviewsExpanded ? data.ilpReviews : data.ilpReviews.slice(0, 4)).map(r => (
              <div key={r.ilpId} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{r.studentName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.sendCategory}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-[12px] font-semibold text-gray-700">
                      {new Date(r.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      r.daysUntil <= 3  ? 'bg-red-100 text-red-700' :
                      r.daysUntil <= 7  ? 'bg-amber-100 text-amber-700' :
                                          'bg-blue-100 text-blue-700'
                    }`}>
                      {r.daysUntil === 0 ? 'Today' : r.daysUntil === 1 ? 'Tomorrow' : `${r.daysUntil}d`}
                    </span>
                  </div>
                  <Link href="/senco/ilp" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400 hover:text-blue-600 transition-colors" title="Open ILP records">
                    <Icon name="arrow_forward" size="sm" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {data.ilpReviews.length > 4 && (
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <button onClick={() => setReviewsExpanded(v => !v)} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium">
                {reviewsExpanded ? 'Show less' : `Show all ${data.ilpReviews.length}`}
              </button>
              <Link href="/senco/ilp" className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                View ILP records <Icon name="arrow_forward" size="sm" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Quick links */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/senco/concerns" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="warning" size="sm" /> SEND Concerns
        </Link>
        <Link href="/senco/early-warning" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="radar" size="sm" /> Early Warning
        </Link>
        <Link href="/senco/ilp" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="task_alt" size="sm" /> ILP Records
        </Link>
        <Link href="/hoy/analytics" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="bar_chart" size="sm" /> Year Analytics
        </Link>
      </div>
    </div>
  )
}
