'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { gradeLabel, gradePillClass } from '@/lib/grading'
import type { SubjectGradeSummary, GradeHistorySubmission } from '@/app/actions/student'

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ grades }: { grades: number[] }) {
  if (grades.length < 2) return null
  const W = 80, H = 28
  // grades ordered desc; reverse to show oldest→newest left→right
  const ordered = [...grades].reverse()
  const pts = ordered.map((g, i) => {
    const x = (i / (ordered.length - 1)) * W
    const y = H - ((g - 1) / 8) * H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const latest = ordered[ordered.length - 1]
  const prev   = ordered[ordered.length - 2]
  const color  = latest > prev ? '#22c55e' : latest < prev ? '#ef4444' : '#94a3b8'
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {ordered.map((g, i) => {
        const x = (i / (ordered.length - 1)) * W
        const y = H - ((g - 1) / 8) * H
        return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill={color} />
      })}
    </svg>
  )
}

// ── Grade pill ────────────────────────────────────────────────────────────────

function GradePill({ grade }: { grade: number }) {
  return (
    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-bold ${gradePillClass(grade)}`}>
      {gradeLabel(grade)}
    </span>
  )
}

// ── Trend arrow ───────────────────────────────────────────────────────────────

function TrendArrow({ grades }: { grades: number[] }) {
  if (grades.length < 2) return null
  // grades[0] = most recent
  const diff = grades[0] - grades[1]
  if (diff > 0) return <Icon name="arrow_upward" size="sm" className="text-green-600" />
  if (diff < 0) return <Icon name="arrow_downward" size="sm" className="text-red-500" />
  return <Icon name="arrow_forward" size="sm" className="text-gray-400" />
}

// ── Homework row ──────────────────────────────────────────────────────────────

function HomeworkRow({ hw }: { hw: GradeHistorySubmission }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-gray-50 px-2 -mx-2 rounded-lg transition-colors"
      >
        <Icon name={open ? 'expand_less' : 'expand_more'} size="sm" className="text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-gray-800 truncate">{hw.title}</p>
          <p className="text-[11px] text-gray-400">{hw.className} · {new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        </div>
        <GradePill grade={hw.gcseGrade} />
      </button>
      {open && hw.feedback && (
        <div className="ml-6 mr-2 mb-2 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
          <p className="text-[11px] font-semibold text-amber-700 mb-1 flex items-center gap-1">
            <Icon name="feedback" size="sm" />Teacher feedback
          </p>
          <p className="text-[12px] text-gray-700 whitespace-pre-wrap">{hw.feedback}</p>
        </div>
      )}
      {open && !hw.feedback && (
        <div className="ml-6 mr-2 mb-2 text-[11px] text-gray-400 italic">No feedback recorded for this piece.</div>
      )}
    </div>
  )
}

// ── Subject card ──────────────────────────────────────────────────────────────

function SubjectCard({ summary }: { summary: SubjectGradeSummary }) {
  const [open, setOpen] = useState(false)
  const grades = summary.submissions.map(s => s.gcseGrade) // desc (newest first)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <Icon name={open ? 'expand_less' : 'expand_more'} size="sm" className="text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-semibold text-gray-900">{summary.subject}</p>
            <TrendArrow grades={grades} />
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">{summary.submissions.length} marked piece{summary.submissions.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Sparkline */}
        {grades.length >= 2 && (
          <div className="hidden sm:block">
            <Sparkline grades={grades} />
          </div>
        )}

        {/* Summary grades */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-gray-400 mb-0.5">Current avg</p>
            <GradePill grade={summary.avgGrade} />
          </div>
          {summary.predictedGrade != null && (
            <div className="text-right">
              <p className="text-[10px] text-gray-400 mb-0.5">Predicted</p>
              <span className="text-[12px] font-semibold text-gray-500">{gradeLabel(summary.predictedGrade)}</span>
            </div>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-3 space-y-0.5">
          {summary.submissions.map(hw => (
            <HomeworkRow key={hw.homeworkId} hw={hw} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StudentGradesView({ summaries }: { summaries: SubjectGradeSummary[] }) {
  if (summaries.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-6">
          <Icon name="school" size="lg" className="text-blue-700" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">My Grades</h1>
        <p className="text-gray-500">No marked work yet. Your grades will appear here once your teacher has returned your homework.</p>
      </div>
    )
  }

  const allGrades = summaries.flatMap(s => s.submissions.map(hw => hw.gcseGrade))
  const overallAvg = allGrades.length > 0 ? Math.round(allGrades.reduce((a, b) => a + b, 0) / allGrades.length) : null
  const totalPieces = summaries.reduce((a, s) => a + s.submissions.length, 0)
  const subjectsWithPrediction = summaries.filter(s => s.predictedGrade != null)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Grades</h1>
      <p className="text-[13px] text-gray-400 mb-6">{totalPieces} piece{totalPieces !== 1 ? 's' : ''} marked across {summaries.length} subject{summaries.length !== 1 ? 's' : ''}</p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          {overallAvg != null ? (
            <>
              <p className="text-2xl font-bold text-gray-900">{gradeLabel(overallAvg)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Overall avg</p>
            </>
          ) : (
            <p className="text-gray-400 text-sm">—</p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalPieces}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pieces marked</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{summaries.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Subject{summaries.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Predicted vs current summary (if any predictions) */}
      {subjectsWithPrediction.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
          <p className="text-[12px] font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
            <Icon name="analytics" size="sm" />Predicted grades
          </p>
          <div className="space-y-1.5">
            {subjectsWithPrediction.map(s => {
              const diff = s.avgGrade - (s.predictedGrade ?? s.avgGrade)
              const icon = diff >= 0 ? 'trending_up' : 'trending_down'
              const color = diff >= 0 ? 'text-green-700' : 'text-amber-700'
              return (
                <div key={s.subject} className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-700">{s.subject}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500">avg {gradeLabel(s.avgGrade)}</span>
                    <span className="text-[11px] text-gray-400">vs predicted {gradeLabel(s.predictedGrade!)}</span>
                    <Icon name={icon} size="sm" className={color} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Subject cards */}
      <div className="space-y-3">
        {summaries.map(s => (
          <SubjectCard key={s.subject} summary={s} />
        ))}
      </div>
    </div>
  )
}
