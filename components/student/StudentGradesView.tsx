'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { gradeLabel, gradePillClass } from '@/lib/grading'
import type { SubjectGradeSummary, GradeHistorySubmission, TopicWeakness, TopicSummary, FormatBreakdown } from '@/app/actions/student'

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ grades }: { grades: number[] }) {
  if (grades.length < 2) return null
  const W = 80, H = 28
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

function TrendArrow({ avgGrade, predictedGrade, grades }: {
  avgGrade: number
  predictedGrade: number | null
  grades: number[]
}) {
  if (predictedGrade != null) {
    if (avgGrade > predictedGrade)  return <Icon name="arrow_upward"  size="sm" className="text-green-600" />
    if (avgGrade < predictedGrade)  return <Icon name="arrow_downward" size="sm" className="text-amber-500" />
    return <Icon name="arrow_forward" size="sm" className="text-blue-500" />
  }
  // No target — fall back to trajectory between last two submissions
  if (grades.length < 2) return null
  const diff = grades[0] - grades[1]   // grades are newest-first
  if (diff > 0) return <Icon name="arrow_upward"  size="sm" className="text-green-600" />
  if (diff < 0) return <Icon name="arrow_downward" size="sm" className="text-red-500" />
  return <Icon name="arrow_forward" size="sm" className="text-gray-400" />
}

// ── Weak topic pills ──────────────────────────────────────────────────────────

function WeakTopicList({ topics, avgGrade }: { topics: TopicWeakness[]; avgGrade: number }) {
  if (topics.length === 0) return null
  return (
    <div className="mt-3 pt-3 border-t border-amber-100">
      <p className="text-[11px] font-semibold text-amber-700 mb-2 flex items-center gap-1">
        <Icon name="priority_high" size="sm" />Focus areas — lower than your subject average
      </p>
      <div className="flex flex-wrap gap-1.5">
        {topics.map(t => (
          <span key={t.topic} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
            <span className={`font-bold px-1 py-0.5 rounded text-[10px] ${gradePillClass(t.avgGrade)}`}>{t.avgGrade}</span>
            {t.topic}
            {t.avgGrade < avgGrade - 1 && (
              <Icon name="warning" size="sm" className="text-red-500" />
            )}
          </span>
        ))}
      </div>
      <Link
        href="/student/revision"
        className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue-600 hover:text-blue-800 font-medium"
      >
        <Icon name="auto_stories" size="sm" />Add these to your revision planner
      </Link>
    </div>
  )
}

// ── Topic heatmap ─────────────────────────────────────────────────────────────

function TopicHeatmap({ topics }: { topics: TopicSummary[] }) {
  if (topics.length === 0) return null
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
        <Icon name="grid_view" size="sm" />Topic performance
      </p>
      <div className="flex flex-wrap gap-1.5">
        {topics.map(t => {
          const bg =
            t.avgGrade >= 7 ? 'bg-green-100 text-green-800 border-green-200' :
            t.avgGrade >= 5 ? 'bg-blue-100 text-blue-800 border-blue-200' :
            t.avgGrade >= 4 ? 'bg-amber-100 text-amber-800 border-amber-200' :
                              'bg-red-100 text-red-800 border-red-200'
          return (
            <span key={t.topic} title={`${t.count} piece${t.count !== 1 ? 's' : ''}, avg grade ${t.avgGrade}`}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] ${bg}`}>
              <span className="font-bold">{t.avgGrade}</span>
              <span className="max-w-[120px] truncate">{t.topic}</span>
              {t.isWeak && <Icon name="arrow_downward" size="sm" />}
            </span>
          )
        })}
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {[
          { label: 'Grade 7–9', bg: 'bg-green-200', color: 'text-green-700' },
          { label: 'Grade 5–6', bg: 'bg-blue-200',  color: 'text-blue-700'  },
          { label: 'Grade 4',   bg: 'bg-amber-200', color: 'text-amber-700' },
          { label: 'Grade 1–3', bg: 'bg-red-200',   color: 'text-red-700'   },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1 text-[10px]">
            <span className={`w-3 h-3 rounded ${l.bg} shrink-0`} />
            <span className={l.color}>{l.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Format breakdown ──────────────────────────────────────────────────────────

function FormatBreakdownPanel({ breakdown }: { breakdown: FormatBreakdown[] }) {
  if (breakdown.length <= 1) return null
  const best = breakdown[0]
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
        <Icon name="bar_chart" size="sm" />Performance by format
      </p>
      <div className="space-y-1.5">
        {breakdown.map(f => (
          <div key={f.type} className="flex items-center gap-2">
            <span className="text-[11px] text-gray-600 w-36 shrink-0">{f.label}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  f.avgGrade >= 7 ? 'bg-green-400' :
                  f.avgGrade >= 5 ? 'bg-blue-400'  :
                  f.avgGrade >= 4 ? 'bg-amber-400' : 'bg-red-400'
                }`}
                style={{ width: `${(f.avgGrade / 9) * 100}%` }}
              />
            </div>
            <span className={`text-[11px] font-bold w-8 text-right ${
              f.avgGrade >= 7 ? 'text-green-700' :
              f.avgGrade >= 5 ? 'text-blue-700'  :
              f.avgGrade >= 4 ? 'text-amber-700' : 'text-red-700'
            }`}>{gradeLabel(f.avgGrade)}</span>
            <span className="text-[10px] text-gray-400 w-12 text-right">{f.count} piece{f.count !== 1 ? 's' : ''}</span>
          </div>
        ))}
      </div>
      {best && (
        <p className="text-[11px] text-emerald-700 mt-2 flex items-center gap-1">
          <Icon name="auto_fix_high" size="sm" />
          You perform best on <strong className="mx-0.5">{best.label}</strong> tasks
        </p>
      )}
    </div>
  )
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
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-gray-400">{hw.pct}%</span>
          <GradePill grade={hw.gcseGrade} />
        </div>
      </button>
      {open && (
        <div className="ml-6 mr-2 mb-2 space-y-2">
          {hw.feedback ? (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
              <p className="text-[11px] font-semibold text-amber-700 mb-1 flex items-center gap-1">
                <Icon name="feedback" size="sm" />Teacher feedback
              </p>
              <p className="text-[12px] text-gray-700 whitespace-pre-wrap">{hw.feedback}</p>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 italic">No feedback recorded for this piece.</p>
          )}
          {hw.gcseGrade <= 4 && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-2">
              <Icon name="auto_stories" size="sm" className="text-red-500 shrink-0" />
              <p className="text-[11px] text-red-700">
                Grade {hw.gcseGrade} — consider adding this topic to your{' '}
                <Link href="/student/revision" className="underline font-medium">revision planner</Link>.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Subject card ──────────────────────────────────────────────────────────────

function SubjectCard({ summary }: { summary: SubjectGradeSummary }) {
  const [open, setOpen] = useState(false)
  const grades = summary.submissions.map(s => s.gcseGrade)

  // Trend: target-based when predictedGrade is available, else recent trajectory
  type TrendStatus = 'above_target' | 'on_target' | 'below_target' | 'improving' | 'steady' | 'declining'
  const trendStatus: TrendStatus = summary.predictedGrade != null
    ? summary.avgGrade > summary.predictedGrade ? 'above_target'
    : summary.avgGrade < summary.predictedGrade ? 'below_target'
    : 'on_target'
    : (() => {
        const recentGrades = grades.slice(0, 5)
        const diff = recentGrades.length >= 2
          ? recentGrades[0] - recentGrades[recentGrades.length - 1]  // newest-first
          : 0
        return diff > 1 ? 'improving' : diff < -1 ? 'declining' : 'steady'
      })()

  const trendLabel =
    trendStatus === 'above_target' ? 'Above target' :
    trendStatus === 'on_target'    ? 'On target'    :
    trendStatus === 'below_target' ? 'Below target' :
    trendStatus === 'improving'    ? 'Improving'    :
    trendStatus === 'declining'    ? 'Declining'    : 'Steady'

  const trendColor =
    trendStatus === 'above_target' ? 'text-green-600' :
    trendStatus === 'on_target'    ? 'text-blue-600'  :
    trendStatus === 'below_target' ? 'text-amber-600' :
    trendStatus === 'improving'    ? 'text-green-600' :
    trendStatus === 'declining'    ? 'text-red-500'   : 'text-gray-500'

  const progressToPredict = summary.predictedGrade != null
    ? summary.avgGrade - summary.predictedGrade
    : null

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
            <TrendArrow avgGrade={summary.avgGrade} predictedGrade={summary.predictedGrade ?? null} grades={grades} />
            <span className={`text-[10px] font-medium ${trendColor}`}>{trendLabel}</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {summary.submissions.length} marked piece{summary.submissions.length !== 1 ? 's' : ''}
            {summary.weakTopics.length > 0 && (
              <span className="ml-2 text-amber-600 font-medium">· {summary.weakTopics.length} topic{summary.weakTopics.length !== 1 ? 's' : ''} to revise</span>
            )}
          </p>
        </div>

        {grades.length >= 2 && (
          <div className="hidden sm:block">
            <Sparkline grades={grades} />
          </div>
        )}

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-gray-400 mb-0.5">Current avg</p>
            <GradePill grade={summary.avgGrade} />
          </div>
          {summary.predictedGrade != null && (
            <div className="text-right">
              <p className="text-[10px] text-gray-400 mb-0.5">Target</p>
              <span className={`text-[12px] font-semibold ${progressToPredict != null && progressToPredict >= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                {gradeLabel(summary.predictedGrade)}
              </span>
            </div>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          {/* Progress toward predicted */}
          {summary.predictedGrade != null && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-blue-800">Progress toward target grade</p>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-gray-500">Current: <strong>{gradeLabel(summary.avgGrade)}</strong></span>
                  <span className="text-gray-400">→</span>
                  <span className="text-blue-700">Target: <strong>{gradeLabel(summary.predictedGrade)}</strong></span>
                </div>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(10, (summary.avgGrade / 9) * 100))}%` }}
                />
              </div>
              {progressToPredict != null && progressToPredict >= 0 ? (
                <p className="text-[10px] text-green-700 mt-1.5 font-medium flex items-center gap-1">
                  <Icon name="check_circle" size="sm" />At or above target — keep it up!
                </p>
              ) : progressToPredict != null && (
                <p className="text-[10px] text-amber-700 mt-1.5 font-medium flex items-center gap-1">
                  <Icon name="trending_up" size="sm" />{Math.abs(progressToPredict)} grade{Math.abs(progressToPredict) !== 1 ? 's' : ''} below target — focus on the areas highlighted below.
                </p>
              )}
            </div>
          )}

          {/* Topic heatmap — all topics */}
          {summary.allTopics.length > 0 && (
            <TopicHeatmap topics={summary.allTopics} />
          )}

          {/* Weak topics */}
          {summary.weakTopics.length > 0 && (
            <WeakTopicList topics={summary.weakTopics} avgGrade={summary.avgGrade} />
          )}

          {/* Format breakdown */}
          <FormatBreakdownPanel breakdown={summary.formatBreakdown} />

          {/* Homework list */}
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">All marked work</p>
            <div className="space-y-0.5">
              {summary.submissions.map(hw => (
                <HomeworkRow key={hw.homeworkId} hw={hw} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Adaptive profile panel ────────────────────────────────────────────────────

function AdaptiveProfilePanel({ profile }: { profile: NonNullable<SubjectGradeSummary['adaptiveProfile']> }) {
  const hasData = profile.profileSummary || profile.preferredTypes.length > 0 ||
                  profile.strengthAreas.length > 0 || profile.developmentAreas.length > 0

  if (!hasData) return null

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="auto_fix_high" size="sm" className="text-emerald-600" />
        <p className="text-[13px] font-semibold text-emerald-800">Your Learning Profile</p>
      </div>

      {profile.profileSummary && (
        <p className="text-[12px] text-emerald-800 mb-3 leading-relaxed">{profile.profileSummary}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {profile.preferredTypes.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1.5">You learn best with</p>
            <div className="flex flex-wrap gap-1">
              {profile.preferredTypes.map((t: string) => (
                <span key={t} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[11px] font-medium capitalize">
                  {t.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
        {profile.strengthAreas.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1.5">Strengths</p>
            <div className="flex flex-wrap gap-1">
              {profile.strengthAreas.map((s: string) => (
                <span key={s} className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-[11px] font-medium capitalize">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {profile.developmentAreas.length > 0 && (
          <div className="sm:col-span-2">
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1.5">Areas to develop</p>
            <div className="flex flex-wrap gap-1">
              {profile.developmentAreas.map((d: string) => (
                <span key={d} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[11px] font-medium capitalize">
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-emerald-200 flex gap-3 flex-wrap">
        <Link href="/student/revision" className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-medium">
          <Icon name="auto_stories" size="sm" />Revision Planner
        </Link>
        <Link href="/student/homework" className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 font-medium">
          <Icon name="assignment" size="sm" />My Homework
        </Link>
      </div>
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
        <h1 className="text-page-title mb-2">My Grades</h1>
        <p className="text-gray-500">No marked work yet. Your grades will appear here once your teacher has returned your homework.</p>
      </div>
    )
  }

  const allGrades = summaries.flatMap(s => s.submissions.map(hw => hw.gcseGrade))
  const overallAvg = allGrades.length > 0 ? Math.round(allGrades.reduce((a, b) => a + b, 0) / allGrades.length) : null
  const totalPieces = summaries.reduce((a, s) => a + s.submissions.length, 0)
  const subjectsWithPrediction = summaries.filter(s => s.predictedGrade != null)
  const totalWeakTopics = summaries.reduce((a, s) => a + s.weakTopics.length, 0)

  // Shared adaptive profile (same for all subjects)
  const adaptiveProfile = summaries[0]?.adaptiveProfile

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-page-title mb-1">My Grades</h1>
      <p className="text-[13px] text-gray-400 mb-6">
        {totalPieces} piece{totalPieces !== 1 ? 's' : ''} marked across {summaries.length} subject{summaries.length !== 1 ? 's' : ''}
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
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
        <div className={`border rounded-xl p-4 text-center ${totalWeakTopics > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          {totalWeakTopics > 0 ? (
            <>
              <p className="text-2xl font-bold text-amber-700">{totalWeakTopics}</p>
              <p className="text-xs text-amber-600 mt-0.5">Topics to revise</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-green-700">✓</p>
              <p className="text-xs text-green-600 mt-0.5">On track</p>
            </>
          )}
        </div>
      </div>

      {/* Adaptive learning profile */}
      {adaptiveProfile && <AdaptiveProfilePanel profile={adaptiveProfile} />}

      {/* Predicted vs current summary */}
      {subjectsWithPrediction.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
          <p className="text-[12px] font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
            <Icon name="analytics" size="sm" />Target grades vs current average
          </p>
          <div className="space-y-2">
            {subjectsWithPrediction.map(s => {
              const diff = s.avgGrade - (s.predictedGrade ?? s.avgGrade)
              const icon = diff >= 0 ? 'trending_up' : 'trending_down'
              const color = diff >= 0 ? 'text-green-700' : 'text-amber-700'
              return (
                <div key={s.subject} className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-700 font-medium">{s.subject}</span>
                  <div className="flex items-center gap-2">
                    <GradePill grade={s.avgGrade} />
                    <span className="text-[10px] text-gray-400">of target</span>
                    <span className={`text-[12px] font-semibold ${color}`}>{gradeLabel(s.predictedGrade!)}</span>
                    <Icon name={icon} size="sm" className={color} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Global revision prompt if weak topics exist */}
      {totalWeakTopics > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
          <Icon name="auto_stories" size="sm" className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold text-amber-800 mb-0.5">Revision recommended</p>
            <p className="text-[11px] text-amber-700">
              You have {totalWeakTopics} topic{totalWeakTopics !== 1 ? 's' : ''} scoring below your subject average.
              Open each subject below to see which topics to focus on, then add them to your{' '}
              <Link href="/student/revision" className="underline font-medium">revision planner</Link>.
            </p>
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
