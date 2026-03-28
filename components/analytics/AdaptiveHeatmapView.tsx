'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import { getClassTopicHeatmap } from '@/app/actions/analytics'
import type { ClassTopicHeatmap } from '@/app/actions/analytics'
import StudentAvatar from '@/components/StudentAvatar'

type Props = {
  classId: string
  onSelectStudent: (studentId: string, studentName: string) => void
}

function scoreStatus(score: number | null): 'green' | 'amber' | 'red' | null {
  if (score == null) return null
  return score >= 70 ? 'green' : score >= 50 ? 'amber' : 'red'
}

function cellClasses(status: 'green' | 'amber' | 'red' | null): string {
  if (status === 'green') return 'bg-green-100 text-green-800'
  if (status === 'amber') return 'bg-amber-100 text-amber-800'
  if (status === 'red')   return 'bg-red-100 text-red-800'
  return 'bg-gray-50 text-gray-300'
}

function headerBar(status: 'green' | 'amber' | 'red'): string {
  if (status === 'green') return 'bg-green-500'
  if (status === 'amber') return 'bg-amber-400'
  return 'bg-red-500'
}

export default function AdaptiveHeatmapView({ classId, onSelectStudent }: Props) {
  const [data, setData]       = useState<ClassTopicHeatmap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    getClassTopicHeatmap(classId)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [classId])

  if (loading) return (
    <div className="flex items-center gap-2 py-10 text-gray-400">
      <Icon name="refresh" size="sm" className="animate-spin" />
      <span className="text-sm">Loading topic data…</span>
    </div>
  )
  if (error)  return <p className="text-sm text-red-600">{error}</p>
  if (!data)  return null

  if (data.topics.length === 0) return (
    <div className="text-center py-14 text-gray-400">
      <p className="text-sm">No marked homework found in the last term for this class.</p>
      <p className="text-xs mt-1">Publish and mark homework assignments to see performance data here.</p>
    </div>
  )

  // Stats summary
  const red   = data.topics.filter(t => t.status === 'red').length
  const amber = data.topics.filter(t => t.status === 'amber').length
  const green = data.topics.filter(t => t.status === 'green').length

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-[11px] font-semibold border border-green-200">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          {green} topic{green !== 1 ? 's' : ''} on track
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold border border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {amber} slightly below
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-[11px] font-semibold border border-red-200">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          {red} significantly below
        </span>
        <span className="ml-auto text-[11px] text-gray-400">Click a student row for individual breakdown</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-5 rounded bg-green-100 border border-green-200 flex items-center justify-center text-[9px] font-bold text-green-700">72</div>
          ≥70%
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-5 rounded bg-amber-100 border border-amber-200 flex items-center justify-center text-[9px] font-bold text-amber-700">58</div>
          50–69%
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-5 rounded bg-red-100 border border-red-200 flex items-center justify-center text-[9px] font-bold text-red-700">38</div>
          &lt;50%
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-5 rounded bg-gray-50 border border-gray-200 flex items-center justify-center text-[9px] text-gray-300">–</div>
          Not submitted
        </div>
      </div>

      {/* Heatmap table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 border-b border-gray-200 min-w-[160px]">
                Student
              </th>
              {data.topics.map(t => (
                <th key={t.topic} className="px-2 py-2.5 border-b border-gray-200 min-w-[72px] max-w-[90px]">
                  <div className="text-[10px] font-medium text-gray-600 text-center leading-tight line-clamp-2" title={t.topic}>
                    {t.topic.length > 18 ? t.topic.slice(0, 18) + '…' : t.topic}
                  </div>
                  <div className={`mt-1.5 h-1 rounded-full mx-auto w-10 ${headerBar(t.status)}`} />
                  <div className="text-[10px] text-gray-400 text-center mt-0.5">{t.avgScore}%</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.students.map((student, si) => (
              <tr
                key={student.id}
                onClick={() => onSelectStudent(student.id, `${student.firstName} ${student.lastName}`)}
                className={`cursor-pointer hover:bg-blue-50 transition-colors group ${si % 2 === 0 ? '' : 'bg-gray-50/50'}`}
              >
                <td className="sticky left-0 z-10 bg-inherit group-hover:bg-blue-50 transition-colors px-4 py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <StudentAvatar
                      firstName={student.firstName}
                      lastName={student.lastName}
                      avatarUrl={student.avatarUrl}
                      sendStatus={student.hasSend ? 'SEN_SUPPORT' : null}
                      size="xs"
                    />
                    <span className="text-[12px] text-gray-800 whitespace-nowrap">
                      {student.firstName} {student.lastName}
                    </span>
                  </div>
                </td>
                {data.topics.map(t => {
                  const score  = student.topicScores[t.topic]
                  const status = scoreStatus(score)
                  return (
                    <td key={t.topic} className="px-2 py-2 text-center border-b border-gray-100">
                      <div
                        className={`mx-auto w-9 h-6 rounded text-[10px] font-semibold flex items-center justify-center ${cellClasses(status)}`}
                        title={score != null ? `${score}%` : 'Not submitted'}
                      >
                        {score != null ? score : '–'}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
