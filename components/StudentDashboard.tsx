'use client'
import Link from 'next/link'
import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import type { StudentDetailData } from '@/app/actions/analytics'
import { formatRawScore } from '@/lib/gradeUtils'
import StudentSupportProfile from '@/components/StudentSupportProfile'

const SEND_LABEL: Record<string, string> = {
  SEN_SUPPORT: 'SEN Support',
  EHCP:        'EHCP',
}

type Subject = string | 'all'

export default function StudentDashboard({ data }: { data: StudentDetailData }) {
  const [subjectFilter, setSubjectFilter] = useState<Subject>('all')

  const subjects = [...new Set(data.homeworks.map(h => h.subject))].sort()

  const filtered = subjectFilter === 'all'
    ? data.homeworks
    : data.homeworks.filter(h => h.subject === subjectFilter)

  const scoreColor = (score: number | null) =>
    score == null       ? 'text-gray-400' :
    score >= 75         ? 'text-green-600' :
    score >= 55         ? 'text-amber-600' :
    'text-rose-600'

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:px-8">

      {/* Back link */}
      <Link
        href="/analytics/students"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5 transition-colors"
      >
        <Icon name="chevron_left" size="sm" />
        Back to Student Analytics
      </Link>

      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 lg:items-start">
      {/* ── Left column ── */}
      <div>

      {/* ── Student header ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 flex flex-wrap items-start gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <span className="text-blue-700 font-bold text-lg">
            {data.firstName[0]}{data.lastName[0]}
          </span>
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-gray-900">
              {data.firstName} {data.lastName}
            </h1>
            {data.hasSend && data.sendStatus && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                <Icon name="favorite" size="sm" />
                {SEND_LABEL[data.sendStatus] ?? data.sendStatus}
              </span>
            )}
          </div>
          {data.yearGroup && (
            <p className="text-sm text-gray-500 mb-2">Year {data.yearGroup}</p>
          )}
          {/* Classes */}
          <div className="flex flex-wrap gap-1.5">
            {data.classes.map(c => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
              >
                <Icon name="people" size="sm" className="shrink-0" />
                {c.name} · {c.subject}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiCard iconName="menu_book"    label="Homework Set"    value={String(data.totalAssigned)} color="blue" />
        <KpiCard iconName="check_circle" label="Completion"     value={`${data.completionRate}%`} color={data.completionRate >= 75 ? 'green' : 'amber'} />
        <KpiCard iconName="bar_chart"    label="Avg Score"      value={data.avgScore != null ? formatRawScore(data.avgScore) : '—'} color={data.avgScore != null && data.avgScore >= 75 ? 'green' : 'purple'} />
        <KpiCard iconName="people"       label="Classes"        value={String(data.classes.length)} color="blue" />
      </div>

      {/* ── Per-subject breakdown ── */}
      {data.subjectRows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">By Subject</h2>
          <div className="space-y-3">
            {data.subjectRows.map(row => {
              const rate = row.assigned > 0 ? Math.round((row.submitted / row.assigned) * 100) : 0
              return (
                <div key={row.subject} className="flex items-center gap-3">
                  <div className="w-24 text-xs font-medium text-gray-700 shrink-0 truncate">{row.subject}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${rate >= 80 ? 'bg-green-500' : rate >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 w-9 text-right shrink-0">{rate}%</div>
                  <div className={`text-xs font-semibold w-8 text-right shrink-0 ${scoreColor(row.avgScore)}`}>
                    {row.avgScore != null ? formatRawScore(row.avgScore) : '—'}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-[10px] text-gray-400 uppercase tracking-wide">
            <span className="flex-1 pl-28">Completion →</span>
            <span className="w-9 text-right">Rate</span>
            <span className="w-8 text-right">Score</span>
          </div>
        </div>
      )}

      {/* ── Support Profile — mobile only (below subject breakdown, above homework) ── */}
      <div className="lg:hidden mb-5">
        <StudentSupportProfile profile={data.supportProfile} />
      </div>

      {/* ── Homework timeline ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700 mr-2">Homework History</h2>
          <SubjectChip
            label="All subjects"
            active={subjectFilter === 'all'}
            onClick={() => setSubjectFilter('all')}
          />
          {subjects.map(s => (
            <SubjectChip
              key={s}
              label={s}
              active={subjectFilter === s}
              onClick={() => setSubjectFilter(s)}
            />
          ))}
        </div>

        {/* Column headers */}
        <div className="hidden sm:grid grid-cols-[2fr_1fr_80px_70px_70px] px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          <span>Assignment</span>
          <span>Class</span>
          <span>Due</span>
          <span className="text-center">Status</span>
          <span className="text-right">Score</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">No homework in this subject.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(hw => {
              const due = new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
              return (
                <div
                  key={hw.homeworkId}
                  className="grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_80px_70px_70px] items-center gap-x-3 px-5 py-3 text-sm hover:bg-gray-50 transition-colors"
                >
                  {/* Title + subject badge */}
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{hw.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 sm:hidden">{hw.class} · {due}</p>
                    <span className="sm:hidden inline-flex items-center mt-1">
                      {hw.submitted
                        ? <span className="text-[10px] text-green-600 font-medium">Submitted</span>
                        : <span className="text-[10px] text-rose-500 font-medium">Not submitted</span>}
                    </span>
                  </div>

                  {/* Class */}
                  <div className="hidden sm:block text-xs text-gray-500">{hw.class}</div>

                  {/* Due date */}
                  <div className="hidden sm:block text-xs text-gray-500">{due}</div>

                  {/* Status */}
                  <div className="hidden sm:flex justify-center">
                    {hw.submitted
                      ? <Icon name="check_circle" size="sm" className="text-green-500" />
                      : <Icon name="cancel"       size="sm" className="text-gray-300" />}
                  </div>

                  {/* Score */}
                  <div className={`text-right font-semibold ${scoreColor(hw.score)}`}>
                    {hw.submitted
                      ? hw.score != null ? formatRawScore(hw.score) : <span className="text-gray-400 font-normal text-xs">Pending</span>
                      : <span className="text-gray-300 font-normal text-xs">—</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      </div>{/* end left column */}

      {/* ── Right column — desktop sticky sidebar ── */}
      <div className="hidden lg:block lg:sticky lg:top-6">
        <StudentSupportProfile profile={data.supportProfile} />
      </div>

      </div>{/* end grid */}
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────

function KpiCard({ iconName, label, value, color }: {
  iconName: string
  label: string
  value: string
  color: 'blue' | 'green' | 'amber' | 'purple'
}) {
  const bg: Record<string, string> = {
    blue:   'bg-blue-50   text-blue-700',
    green:  'bg-green-50  text-green-700',
    amber:  'bg-amber-50  text-amber-700',
    purple: 'bg-purple-50 text-purple-700',
  }
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${bg[color]}`}>
        <Icon name={iconName} size="sm" />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-[12px] text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function SubjectChip({ label, active, onClick }: {
  label:   string
  active:  boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )
}
