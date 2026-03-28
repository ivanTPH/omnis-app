'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import { getClassKPlanActions, type ClassKPlanAction } from '@/app/actions/send-support'
import dynamic from 'next/dynamic'
import type { LearnerPassportRow } from '@/app/actions/send-support'

const KPlanModal = dynamic(() => import('./KPlanModal'), { ssr: false })

// ── Keyword patterns for the summary line ────────────────────────────────────

const SUMMARY_KEYWORDS: { label: string; re: RegExp }[] = [
  { label: 'visual timers',        re: /visual.timer/i },
  { label: 'front seating',        re: /front.*(row|seat|class)|sit.*front/i },
  { label: 'printed handouts',     re: /print|handout/i },
  { label: 'check-ins',            re: /check.?in|check.*after.*task/i },
  { label: 'extra processing time', re: /extra.*time|processing.time|additional.*time/i },
  { label: 'broken-down instructions', re: /2.?3.step|break.*instruct|instruct.*step|step.*max/i },
  { label: 'overlays\/tools',      re: /overlay|reading.*tool|assistive/i },
  { label: 'quiet seating',        re: /quiet|distract/i },
]

function buildSummaryLine(actions: ClassKPlanAction[]): string {
  const counts: { label: string; n: number }[] = []
  for (const kw of SUMMARY_KEYWORDS) {
    let n = 0
    for (const a of actions) {
      if (a.teacherActions.some(t => kw.re.test(t))) n++
    }
    if (n > 0) counts.push({ label: kw.label, n })
  }
  counts.sort((a, b) => b.n - a.n)
  return counts.slice(0, 3).map(c => `${c.n} student${c.n > 1 ? 's' : ''} need ${c.label}`).join(' · ')
}

// ── SEND badge ────────────────────────────────────────────────────────────────

function SendBadge({ status, needArea }: { status: string | null; needArea: string | null }) {
  if (!status || status === 'NONE') return null
  return status === 'EHCP' ? (
    <span title={needArea ?? 'EHCP'} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 shrink-0">
      EHCP
    </span>
  ) : (
    <span title={needArea ?? 'SEN Support'} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 shrink-0">
      SEN
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ClassSendActionsCard({ classId }: { classId: string }) {
  const [actions,     setActions]     = useState<ClassKPlanAction[]>([])
  const [loading,     setLoading]     = useState(true)
  const [expanded,    setExpanded]    = useState(false) // show all vs first 4
  const [modal,       setModal]       = useState<{ action: ClassKPlanAction; passport: LearnerPassportRow } | null>(null)
  const [loadingModal, setLoadingModal] = useState<string | null>(null) // studentId

  useEffect(() => {
    getClassKPlanActions(classId)
      .then(setActions)
      .finally(() => setLoading(false))
  }, [classId])

  if (loading) return (
    <div className="flex items-center gap-2 text-[12px] text-gray-400 py-2">
      <Icon name="refresh" size="sm" className="animate-spin" /> Loading SEND actions…
    </div>
  )

  if (actions.length === 0) return null

  const summaryLine = buildSummaryLine(actions)
  const SHOW_MAX    = 4
  const shown       = expanded ? actions : actions.slice(0, SHOW_MAX)

  async function openModal(action: ClassKPlanAction) {
    setLoadingModal(action.studentId)
    try {
      const { getStudentLearnerPassport } = await import('@/app/actions/send-support')
      const passport = await getStudentLearnerPassport(action.studentId)
      if (passport) setModal({ action, passport })
    } finally {
      setLoadingModal(null)
    }
  }

  return (
    <>
      <div className="border border-teal-200 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-teal-50 border-b border-teal-100">
          <div className="flex items-center gap-2">
            <Icon name="menu_book" size="sm" className="text-teal-600 shrink-0" />
            <span className="text-[12px] font-semibold text-teal-800">Class SEND Actions</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded-full font-semibold">
              {actions.length} K Plan{actions.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Summary line */}
        {summaryLine && (
          <div className="px-4 py-2 bg-teal-50/50 border-b border-teal-100">
            <p className="text-[11px] text-teal-700">{summaryLine}</p>
          </div>
        )}

        {/* Student cards */}
        <div className="divide-y divide-gray-100">
          {shown.map(a => (
            <div key={a.studentId} className="px-4 py-3">
              {/* Name row */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px] font-semibold text-gray-900">{a.studentName}</span>
                <SendBadge status={a.sendStatus} needArea={a.needArea} />
                {a.needArea && (
                  <span className="text-[10px] text-gray-400 truncate">{a.needArea}</span>
                )}
                <button
                  onClick={() => openModal(a)}
                  disabled={loadingModal === a.studentId}
                  className="ml-auto flex items-center gap-1 text-[10px] text-teal-600 hover:text-teal-800 font-medium disabled:opacity-50"
                >
                  {loadingModal === a.studentId ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="menu_book" size="sm" />}
                  K Plan
                </button>
                <a
                  href={`/student/${a.studentId}/send`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-blue-500"
                  title="Open full SEND record"
                >
                  <Icon name="open_in_new" size="sm" />
                </a>
              </div>

              {/* Top 3 actions */}
              <ul className="space-y-1">
                {a.teacherActions.slice(0, 3).map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-gray-700">
                    <span className={`mt-0.5 w-4 h-4 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      a.sendStatus === 'EHCP'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {i + 1}
                    </span>
                    {action}
                  </li>
                ))}
                {a.teacherActions.length > 3 && (
                  <li className="text-[11px] text-gray-400 pl-6">
                    +{a.teacherActions.length - 3} more — open K Plan to see all
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>

        {/* Show all / collapse */}
        {actions.length > SHOW_MAX && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-teal-600 hover:bg-teal-50 border-t border-teal-100 transition-colors"
          >
            {expanded
              ? <><Icon name="expand_less" size="sm" /> Show fewer</>
              : <><Icon name="expand_more" size="sm" /> Show all {actions.length} students</>
            }
          </button>
        )}
      </div>

      {modal && (
        <KPlanModal
          passport={modal.passport}
          studentName={modal.action.studentName}
          studentId={modal.action.studentId}
          userRole="TEACHER"
          onClose={() => setModal(null)}
          onUpdated={() => setModal(null)}
        />
      )}
    </>
  )
}
