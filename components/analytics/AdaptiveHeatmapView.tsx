'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import { getClassTopicHeatmap } from '@/app/actions/analytics'
import { generateResource } from '@/app/actions/ai-generator'
import type { ClassTopicHeatmap } from '@/app/actions/analytics'
import StudentAvatar from '@/components/StudentAvatar'
import { percentToGcseGrade, gradeLabel } from '@/lib/grading'

type Props = {
  classId:         string
  subject:         string
  yearGroup:       number
  onSelectStudent: (studentId: string, studentName: string) => void
}

// Grade 6+ (≥60%) = green, Grade 4–5 (40–59%) = amber, Grade 1–3 (<40%) = red
function scoreStatus(score: number | null): 'green' | 'amber' | 'red' | null {
  if (score == null) return null
  return score >= 60 ? 'green' : score >= 40 ? 'amber' : 'red'
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

type GenState = { id: string; title: string } | 'generating' | 'error' | null
type TopicGenMap = Record<string, Record<string, GenState>>

export default function AdaptiveHeatmapView({ classId, subject, yearGroup, onSelectStudent }: Props) {
  const [data,        setData]        = useState<ClassTopicHeatmap | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [activeTopic, setActiveTopic] = useState<string | null>(null)
  const [topicGenMap, setTopicGenMap] = useState<TopicGenMap>({})

  useEffect(() => {
    getClassTopicHeatmap(classId)
      .then(d => { setData(d); setActiveTopic(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [classId])

  async function handleTopicGenerate(topic: string, studentId: string, studentName: string) {
    setTopicGenMap(prev => ({
      ...prev,
      [topic]: { ...(prev[topic] ?? {}), [studentId]: 'generating' },
    }))
    try {
      const result = await generateResource({
        schoolId:        '',
        subject,
        yearGroup:       `Year ${yearGroup}`,
        topic,
        resourceType:    'worksheet',
        sendAdaptations: [],
        additionalNotes: `Targeted revision for ${studentName}. Focus on addressing gaps in this topic.`,
      })
      setTopicGenMap(prev => ({
        ...prev,
        [topic]: { ...(prev[topic] ?? {}), [studentId]: { id: result.id, title: result.title } },
      }))
    } catch {
      setTopicGenMap(prev => ({
        ...prev,
        [topic]: { ...(prev[topic] ?? {}), [studentId]: 'error' },
      }))
    }
  }

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

  const red   = data.topics.filter(t => t.status === 'red').length
  const amber = data.topics.filter(t => t.status === 'amber').length
  const green = data.topics.filter(t => t.status === 'green').length

  // Per-student data for active topic, sorted worst→best
  const activeTopicData = activeTopic
    ? [...data.students]
        .map(s => ({ student: s, score: s.topicScores[activeTopic] ?? null }))
        .sort((a, b) => {
          if (a.score == null && b.score == null) return 0
          if (a.score == null) return 1
          if (b.score == null) return -1
          return a.score - b.score
        })
    : []

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-[11px] font-semibold border border-green-200">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          {green} topic{green !== 1 ? 's' : ''} Grade 6+
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold border border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          {amber} Grade 4–5
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-[11px] font-semibold border border-red-200">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          {red} Grade 1–3
        </span>
        <span className="ml-auto text-[11px] text-gray-400">
          Click a <strong>topic column</strong> to see per-student breakdown · Click a <strong>student row</strong> for their full profile
        </span>
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
                  <button
                    onClick={() => setActiveTopic(activeTopic === t.topic ? null : t.topic)}
                    className={`w-full text-center rounded-lg px-1 py-1 transition-colors ${
                      activeTopic === t.topic
                        ? 'bg-blue-100 ring-2 ring-blue-400'
                        : 'hover:bg-gray-100'
                    }`}
                    title={`Click to see per-student breakdown for: ${t.topic}`}
                  >
                    <div className="text-[10px] font-medium text-gray-600 leading-tight line-clamp-2">
                      {t.topic.length > 18 ? t.topic.slice(0, 18) + '…' : t.topic}
                    </div>
                    <div className={`mt-1.5 h-1 rounded-full mx-auto w-10 ${headerBar(t.status)}`} />
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      Gr {percentToGcseGrade(t.avgScore)}
                    </div>
                  </button>
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
                      userId={student.id}
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
                    <td
                      key={t.topic}
                      className={`px-2 py-2 text-center border-b border-gray-100 ${activeTopic === t.topic ? 'bg-blue-50/40' : ''}`}
                    >
                      <div
                        className={`mx-auto w-9 h-6 rounded text-[10px] font-semibold flex items-center justify-center ${cellClasses(status)}`}
                        title={score != null ? `${score}% — Grade ${percentToGcseGrade(score)}` : 'Not submitted'}
                      >
                        {score != null ? percentToGcseGrade(score) : '–'}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Topic drill-down panel ── */}
      {activeTopic && (() => {
        const topicMeta = data.topics.find(t => t.topic === activeTopic)!
        const tGen      = topicGenMap[activeTopic] ?? {}
        return (
          <div className="bg-white border border-blue-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-blue-50 border-b border-blue-200">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${headerBar(topicMeta.status)}`} />
                <div>
                  <h3 className="text-[13px] font-bold text-gray-900">{activeTopic}</h3>
                  <p className="text-[11px] text-gray-500">
                    Class avg: Grade {percentToGcseGrade(topicMeta.avgScore)} ({topicMeta.avgScore}%) · {topicMeta.submissionCount} submissions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTopic(null)}
                className="p-1 rounded-lg hover:bg-blue-100 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close topic panel"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>

            <div className="divide-y divide-gray-50">
              {activeTopicData.map(({ student, score }) => {
                const status = scoreStatus(score)
                const gen    = tGen[student.id] ?? null
                const name   = `${student.firstName} ${student.lastName}`
                return (
                  <div key={student.id} className="flex items-center gap-3 px-5 py-3">
                    {/* Status dot */}
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      status === 'green' ? 'bg-green-500' :
                      status === 'amber' ? 'bg-amber-400' :
                      status === 'red'   ? 'bg-red-500'   : 'bg-gray-200'
                    }`} />

                    {/* Student name + avatar */}
                    <button
                      onClick={() => onSelectStudent(student.id, name)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left hover:underline"
                    >
                      <StudentAvatar
                        firstName={student.firstName}
                        lastName={student.lastName}
                        avatarUrl={student.avatarUrl}
                        sendStatus={student.hasSend ? 'SEN_SUPPORT' : null}
                        size="xs"
                        userId={student.id}
                      />
                      <span className="text-[12px] text-gray-800 truncate">{name}</span>
                    </button>

                    {/* Score */}
                    <div className="text-right shrink-0 w-24">
                      {score != null ? (
                        <>
                          <span className={`text-[12px] font-bold ${
                            status === 'green' ? 'text-green-700' :
                            status === 'amber' ? 'text-amber-700' : 'text-red-700'
                          }`}>
                            Grade {percentToGcseGrade(score)}
                          </span>
                          <span className="text-[10px] text-gray-400 ml-1">({score}%)</span>
                        </>
                      ) : (
                        <span className="text-[11px] text-gray-300 italic">not submitted</span>
                      )}
                    </div>

                    {/* Generate revision — only for red students */}
                    {status === 'red' && (
                      <div className="shrink-0 w-40 text-right">
                        {gen == null && (
                          <button
                            onClick={() => handleTopicGenerate(activeTopic, student.id, name)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-semibold transition-colors border border-red-200"
                          >
                            <Icon name="auto_fix_high" size="sm" />
                            Generate Revision
                          </button>
                        )}
                        {gen === 'generating' && (
                          <span className="inline-flex items-center gap-1.5 text-gray-400 text-[11px]">
                            <Icon name="refresh" size="sm" className="animate-spin" />
                            Generating…
                          </span>
                        )}
                        {gen === 'error' && (
                          <button
                            onClick={() => handleTopicGenerate(activeTopic, student.id, name)}
                            className="text-[11px] text-red-500 hover:text-red-700"
                          >
                            Failed — retry
                          </button>
                        )}
                        {gen != null && gen !== 'generating' && gen !== 'error' && (
                          <a
                            href="/ai-generator"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-[11px] font-semibold border border-green-200 hover:bg-green-100 transition-colors"
                          >
                            <Icon name="check" size="sm" />
                            {(gen as { id: string; title: string }).title.length > 18
                              ? (gen as { id: string; title: string }).title.slice(0, 18) + '…'
                              : (gen as { id: string; title: string }).title}
                            <Icon name="arrow_forward" size="sm" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
