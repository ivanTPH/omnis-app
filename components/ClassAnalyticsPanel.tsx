'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import StudentAvatar from '@/components/StudentAvatar'
import { getClassRagData, type RagStudent } from '@/app/actions/rag'
import { percentToGcseGrade, gradeLabel, gradePillClass } from '@/lib/grading'

// ── RAG helpers ────────────────────────────────────────────────────────────────

const RAG_DOT: Record<string, string> = {
  green:   'bg-green-500',
  amber:   'bg-amber-400',
  red:     'bg-red-500',
  no_data: 'bg-gray-300',
}
const RAG_LABEL: Record<string, string> = {
  green:   'On track',
  amber:   'Borderline',
  red:     'Needs support',
  no_data: 'No data',
}
const RAG_CHIP: Record<string, string> = {
  green:   'bg-green-100 text-green-700',
  amber:   'bg-amber-100 text-amber-700',
  red:     'bg-red-100 text-red-600',
  no_data: 'bg-gray-100 text-gray-400',
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

export default function ClassAnalyticsPanel({
  classId,
  subject,
  yearGroup,
}: {
  classId:    string
  subject?:   string | null
  yearGroup?: number | null
}) {
  const [students, setStudents] = useState<RagStudent[] | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    setLoading(true)
    getClassRagData(classId)
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setLoading(false))
  }, [classId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Icon name="refresh" size="md" className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (!students || students.length === 0) {
    return (
      <div className="p-7">
        <div className="border border-dashed border-gray-200 rounded-2xl p-10 text-center">
          <Icon name="analytics" size="lg" className="mx-auto text-gray-300 mb-2" />
          <p className="text-[12px] text-gray-400">No students or homework data yet for this class.</p>
        </div>
      </div>
    )
  }

  // ── Derived stats ────────────────────────────────────────────────────────────
  const withData     = students.filter(s => s.workingAtScore != null)
  const classAvg     = avg(withData.map(s => s.workingAtScore!))
  const completionPct = students.length > 0
    ? Math.round((withData.length / students.length) * 100)
    : 0

  const ragCounts = students.reduce((acc, s) => {
    acc[s.ragStatus] = (acc[s.ragStatus] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const sendStudents    = students.filter(s => s.hasSend)
  const nonSendStudents = students.filter(s => !s.hasSend)
  const sendAvg    = avg(sendStudents.filter(s => s.workingAtScore != null).map(s => s.workingAtScore!))
  const nonSendAvg = avg(nonSendStudents.filter(s => s.workingAtScore != null).map(s => s.workingAtScore!))

  const analyticsHref = `/analytics?classId=${classId}${subject ? `&subject=${encodeURIComponent(subject)}` : ''}${yearGroup ? `&yearGroup=${yearGroup}` : ''}`

  return (
    <div className="p-6 space-y-5">

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {(() => {
          const avgGrade = classAvg != null ? percentToGcseGrade(classAvg) : null
          const isGreen  = avgGrade != null && avgGrade >= 6
          const isAmber  = avgGrade != null && avgGrade >= 4 && avgGrade < 6
          return (
            <div className={`rounded-xl border p-4 text-center ${
              avgGrade == null ? 'bg-white border-gray-200' :
              isGreen          ? 'bg-green-50 border-green-200' :
              isAmber          ? 'bg-amber-50 border-amber-200' :
                                 'bg-red-50 border-red-200'
            }`}>
              <p className={`text-2xl font-bold ${
                avgGrade == null ? 'text-gray-900' :
                isGreen          ? 'text-green-700' :
                isAmber          ? 'text-amber-700' :
                                   'text-red-700'
              }`}>{avgGrade != null ? `Grade ${avgGrade}` : '—'}</p>
              {classAvg != null && (
                <p className="text-[11px] text-gray-400 mt-0.5">{classAvg}% avg</p>
              )}
              <p className="text-[11px] text-gray-500 mt-0.5">Class avg grade</p>
            </div>
          )
        })()}
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{completionPct}%</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Completion rate</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{students.length}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Students</p>
        </div>
      </div>

      {/* ── RAG breakdown ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="text-[12px] font-semibold text-gray-700">RAG breakdown</h3>
          <Link
            href={analyticsHref}
            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium"
          >
            <Icon name="open_in_new" size="sm" />View full analytics
          </Link>
        </div>
        <div className="px-5 py-4 flex flex-wrap gap-3">
          {(['green', 'amber', 'red', 'no_data'] as const).map(rag => {
            const count = ragCounts[rag] ?? 0
            if (count === 0) return null
            return (
              <div key={rag} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium ${RAG_CHIP[rag]}`}>
                <span className={`w-2 h-2 rounded-full ${RAG_DOT[rag]}`} />
                {RAG_LABEL[rag]}: {count}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── SEND attainment comparison ─────────────────────────────────────── */}
      {sendStudents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-[12px] font-semibold text-gray-700">SEND attainment comparison</h3>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-blue-700 font-medium">SEN / EHCP students ({sendStudents.length})</span>
                  <span className="text-[12px] font-semibold text-gray-800">{sendAvg != null ? `${sendAvg}%` : '—'}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all"
                    style={{ width: sendAvg != null ? `${sendAvg}%` : '0%' }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-gray-600 font-medium">Rest of class ({nonSendStudents.length})</span>
                  <span className="text-[12px] font-semibold text-gray-800">{nonSendAvg != null ? `${nonSendAvg}%` : '—'}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-400 rounded-full transition-all"
                    style={{ width: nonSendAvg != null ? `${nonSendAvg}%` : '0%' }}
                  />
                </div>
              </div>
            </div>
            {sendAvg != null && nonSendAvg != null && (
              <p className="text-[11px] text-gray-500">
                {sendAvg >= nonSendAvg
                  ? `SEND students performing ${sendAvg - nonSendAvg}pp above class average.`
                  : `SEND students performing ${nonSendAvg - sendAvg}pp below class average.`
                }
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Per-student list ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-[12px] font-semibold text-gray-700">Individual students</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {students.map(s => {
            const trend =
              s.recentGrades.length >= 2
                ? s.recentGrades[0] > s.recentGrades[s.recentGrades.length - 1] ? '↑'
                : s.recentGrades[0] < s.recentGrades[s.recentGrades.length - 1] ? '↓'
                : '→'
                : null
            const trendColor =
              trend === '↑' ? 'text-green-600' :
              trend === '↓' ? 'text-red-500'   : 'text-gray-400'
            return (
              <Link
                key={s.id}
                href={`/student/${s.id}/send`}
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <StudentAvatar
                  firstName={s.firstName}
                  lastName={s.lastName}
                  avatarUrl={s.avatarUrl}
                  size="xs"
                  sendStatus={s.hasSend ? (s.sendCategory as 'SEN_SUPPORT' | 'EHCP') : 'NONE'}
                />
                <span className="flex-1 text-[12px] text-gray-800 font-medium">
                  {s.lastName}, {s.firstName}
                </span>
                {s.hasSend && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${s.sendCategory === 'EHCP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {s.sendCategory === 'EHCP' ? 'EHCP' : 'SEN'}
                  </span>
                )}
                {/* Trend arrow */}
                {trend && (
                  <span className={`text-[13px] font-bold shrink-0 ${trendColor}`} title="Recent trend">
                    {trend}
                  </span>
                )}
                {/* Working-at grade pill */}
                {s.workingAtGrade != null ? (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${gradePillClass(s.workingAtGrade)}`}
                    title={`Working at: Grade ${gradeLabel(s.workingAtGrade)}`}
                  >
                    {s.workingAtGrade}
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 bg-gray-100 text-gray-400">—</span>
                )}
                {/* Predicted grade */}
                {s.predictedGrade != null && (
                  <span className="text-[10px] text-gray-400 shrink-0" title={`Predicted: Grade ${s.predictedGrade}`}>
                    P{s.predictedGrade}
                  </span>
                )}
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${RAG_DOT[s.ragStatus]}`}
                  title={RAG_LABEL[s.ragStatus]}
                />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
