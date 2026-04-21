'use client'

import { useState, useEffect, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import Tooltip from '@/components/ui/Tooltip'
import { getStudentTopicBreakdown } from '@/app/actions/analytics'
import { generateResource } from '@/app/actions/ai-generator'
import { saveLearningFormatNotes, generateAdaptiveNarrative } from '@/app/actions/adaptive-learning'
import type { StudentTopicBreakdown } from '@/app/actions/analytics'
import StudentAvatar from '@/components/StudentAvatar'

type Props = {
  studentId: string
  classId:   string
}

type GenState = { id: string; title: string } | 'generating' | 'error' | null

export default function AdaptiveStudentView({ studentId, classId }: Props) {
  const [data,           setData]           = useState<StudentTopicBreakdown | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [genMap,         setGenMap]         = useState<Record<string, GenState>>({})
  const [notes,          setNotes]          = useState('')
  const [notesSaved,     setNotesSaved]     = useState(false)
  const [notesLoading,   setNotesLoading]   = useState(false)
  const [narrative,      setNarrative]      = useState<string | null>(null)
  const [narrativeError, setNarrativeError] = useState(false)
  const [generatingNarrative, startNarrative] = useTransition()

  useEffect(() => {
    getStudentTopicBreakdown(studentId, classId)
      .then(d => {
        setData(d)
        setNotes(d.learningFormatNotes ?? '')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [studentId, classId])

  function handleGenerateNarrative() {
    setNarrativeError(false)
    startNarrative(async () => {
      try {
        const text = await generateAdaptiveNarrative(studentId, classId)
        setNarrative(text)
      } catch {
        setNarrativeError(true)
      }
    })
  }

  async function handleGenerate(topic: string) {
    if (!data) return
    setGenMap(prev => ({ ...prev, [topic]: 'generating' }))
    try {
      const result = await generateResource({
        schoolId:        '',
        subject:         data.subject,
        yearGroup:       `Year ${data.yearGroup}`,
        topic,
        resourceType:    'worksheet',
        sendAdaptations: [],
        additionalNotes: `Targeted revision for ${data.firstName} ${data.lastName}. Focus on addressing gaps in this topic.${notes ? ` Learning preferences: ${notes}` : ''}`,
      })
      setGenMap(prev => ({ ...prev, [topic]: { id: result.id, title: result.title } }))
    } catch {
      setGenMap(prev => ({ ...prev, [topic]: 'error' }))
    }
  }

  async function handleSaveNotes() {
    if (!data) return
    setNotesLoading(true)
    try {
      await saveLearningFormatNotes(studentId, notes)
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2500)
    } finally {
      setNotesLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center gap-2 py-10 text-gray-400">
      <Icon name="refresh" size="sm" className="animate-spin" />
      <span className="text-sm">Loading student data…</span>
    </div>
  )
  if (error)  return <p className="text-sm text-red-600">{error}</p>
  if (!data)  return null

  const redTopics   = data.topics.filter(t => t.myStatus === 'red')
  const greenTopics = data.topics.filter(t => t.myStatus === 'green')

  function GenButton({ topic }: { topic: string }) {
    const gen = genMap[topic]
    if (gen == null) return (
      <button
        onClick={() => handleGenerate(topic)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-semibold transition-colors border border-red-200"
      >
        <Icon name="auto_fix_high" size="sm" />
        Generate Revision
      </button>
    )
    if (gen === 'generating') return (
      <span className="inline-flex items-center gap-1.5 text-gray-400 text-[11px]">
        <Icon name="refresh" size="sm" className="animate-spin" />
        Generating…
      </span>
    )
    if (gen === 'error') return (
      <button onClick={() => handleGenerate(topic)} className="text-[11px] text-red-500 hover:text-red-700">
        Failed — retry
      </button>
    )
    return (
      <a
        href="/ai-generator"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-[11px] font-semibold border border-green-200 hover:bg-green-100 transition-colors"
      >
        <Icon name="check" size="sm" />
        {(gen as { title: string }).title.length > 22
          ? (gen as { title: string }).title.slice(0, 22) + '…'
          : (gen as { title: string }).title}
        <Icon name="arrow_forward" size="sm" />
      </a>
    )
  }

  return (
    <div className="space-y-5">
      {/* Student header card */}
      <div className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl">
        <StudentAvatar
          firstName={data.firstName}
          lastName={data.lastName}
          avatarUrl={null}
          sendStatus={data.hasSend ? (data.sendCategory as any) : null}
          size="md"
          userId={data.studentId}
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-bold text-gray-900">{data.firstName} {data.lastName}</h2>
          <p className="text-[12px] text-gray-500 mt-0.5">{data.subject} · Year {data.yearGroup}</p>
          {data.hasSend && (
            <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              data.sendCategory === 'EHCP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {data.sendCategory === 'EHCP' ? 'EHCP' : 'SEN Support'}
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          {data.predictedGradeBaseline ? (
            <>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Predicted baseline</div>
              <div className="text-[22px] font-bold text-gray-900">{data.predictedGradeBaseline}</div>
            </>
          ) : (
            <div className="text-[11px] text-gray-400">No grade data</div>
          )}
        </div>
      </div>

      {/* ── AI narrative card ── */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <Icon name="psychology" size="sm" className="text-indigo-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <Tooltip content="AI-generated teaching summary based on this student's homework performance, SEND status, and ILP targets">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1 cursor-default">AI Adaptive Summary</p>
              </Tooltip>
              {generatingNarrative ? (
                <div className="flex items-center gap-1.5 text-[12px] text-indigo-500">
                  <Icon name="refresh" size="sm" className="animate-spin" />
                  Generating summary…
                </div>
              ) : narrative ? (
                <p className="text-[13px] text-indigo-900 leading-relaxed">{narrative}</p>
              ) : narrativeError ? (
                <p className="text-[12px] text-red-600 italic">Failed to generate — try again.</p>
              ) : (
                <p className="text-[12px] text-indigo-400 italic">Click &ldquo;Generate&rdquo; for an AI-powered teaching summary for this student.</p>
              )}
            </div>
          </div>
          <button
            onClick={handleGenerateNarrative}
            disabled={generatingNarrative}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors disabled:opacity-60"
          >
            <Icon name={narrative ? 'refresh' : 'auto_awesome'} size="sm" />
            {narrative ? 'Regenerate' : 'Generate'}
          </button>
        </div>
      </div>

      {/* ── Learning format notes ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2.5">
          <Icon name="sticky_note_2" size="sm" className="text-indigo-500" />
          <Tooltip content="Notes about how this student learns best — used when generating adaptive revision tasks">
            <h3 className="text-[13px] font-semibold text-gray-900 cursor-default">Learning Format Notes</h3>
          </Tooltip>
          <span className="text-[10px] text-gray-400 ml-1">— feeds into revision generation</span>
        </div>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
          placeholder={'e.g. "Works well with visual aids. Prefers quiz format. Needs oral explanation for new concepts."'}
          rows={3}
          className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 text-gray-700 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px] text-gray-400">These notes are used when generating targeted revision for this student.</p>
          <button
            onClick={handleSaveNotes}
            disabled={notesLoading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              notesSaved
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            } disabled:opacity-60`}
          >
            {notesLoading
              ? <><Icon name="refresh" size="sm" className="animate-spin" />Saving…</>
              : notesSaved
                ? <><Icon name="check" size="sm" />Saved</>
                : 'Save notes'
            }
          </button>
        </div>
      </div>

      {/* ── Grade trend over time ── */}
      {data.gradeTrend.length >= 2 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="trending_up" size="sm" className="text-blue-500" />
            <h3 className="text-[13px] font-semibold text-gray-900">Grade Trend Over Time</h3>
            <span className="text-[10px] text-gray-400 ml-1">— impact of adaptive homework</span>
          </div>
          <div className="flex items-end gap-2 h-16 overflow-x-auto pb-1">
            {data.gradeTrend.map((pt, i) => {
              const pct = (pt.grade / 9) * 100
              const color = pt.grade >= 7 ? 'bg-green-500' : pt.grade >= 5 ? 'bg-amber-400' : pt.grade >= 4 ? 'bg-amber-500' : 'bg-red-500'
              const prev = i > 0 ? data.gradeTrend[i - 1].grade : null
              const arrow = prev == null ? null : pt.grade > prev ? '↑' : pt.grade < prev ? '↓' : null
              return (
                <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 32 }}
                  title={`${pt.title}\n${new Date(pt.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: Grade ${pt.grade}`}
                >
                  <span className="text-[9px] text-gray-400">
                    {arrow && <span className={arrow === '↑' ? 'text-green-500' : 'text-red-500'}>{arrow}</span>}
                    {pt.grade}
                  </span>
                  <div className="w-5 rounded-sm" style={{ height: `${Math.max(4, pct * 0.44)}px` }}>
                    <div className={`w-full h-full rounded-sm ${color}`} />
                  </div>
                  <span className="text-[8px] text-gray-300 rotate-0">
                    {new Date(pt.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              )
            })}
          </div>
          {/* Trend summary */}
          {(() => {
            const first = data.gradeTrend[0].grade
            const last  = data.gradeTrend[data.gradeTrend.length - 1].grade
            const diff  = last - first
            return diff !== 0 ? (
              <p className="text-[11px] mt-2 text-gray-500">
                {diff > 0
                  ? <span className="text-green-600 font-medium">↑ Improved {diff} grade{diff > 1 ? 's' : ''}</span>
                  : <span className="text-red-500 font-medium">↓ Declined {Math.abs(diff)} grade{Math.abs(diff) > 1 ? 's' : ''}</span>}
                {' '}since first submission (Grade {first} → Grade {last})
              </p>
            ) : (
              <p className="text-[11px] mt-2 text-gray-500">
                <span className="text-gray-600 font-medium">→ Stable</span> — Grade {last} across {data.gradeTrend.length} submissions
              </p>
            )
          })()}
        </div>
      )}

      {/* ── Recommended revision (red topics) ── */}
      {redTopics.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3 border-b border-red-100">
            <Icon name="error" size="sm" className="text-red-500 flex-shrink-0" />
            <div>
              <h3 className="text-[13px] font-semibold text-red-900">
                Recommended Revision — {redTopics.length} topic{redTopics.length !== 1 ? 's' : ''} below Grade 4
              </h3>
              <p className="text-[11px] text-red-600 mt-0.5">Generate targeted practice to address these gaps</p>
            </div>
          </div>
          <div className="divide-y divide-red-100">
            {redTopics.map(t => (
              <div key={t.topic} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-red-900 truncate">{t.topic}</p>
                  <p className="text-[11px] text-red-600 mt-0.5">
                    {t.myScore != null ? `Score: ${t.myScore}%` : 'Not submitted'}
                    {' · '}Class avg: {t.classAvgScore}%
                  </p>
                </div>
                <div className="shrink-0">
                  <GenButton topic={t.topic} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Strong topics ── */}
      {greenTopics.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="star" size="sm" className="text-green-600" />
            <h3 className="text-[13px] font-semibold text-green-900">
              Strong Areas — {greenTopics.length} topic{greenTopics.length !== 1 ? 's' : ''} at Grade 6+
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {greenTopics.map(t => (
              <span key={t.topic} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-[11px] font-medium border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {t.topic.length > 30 ? t.topic.slice(0, 30) + '…' : t.topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Full topic breakdown ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-gray-900">Full Topic Breakdown</h3>
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> ≥60%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 40–59%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;40%</span>
          </div>
        </div>

        {data.topics.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">
            No marked homework found for this student in the last term.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.topics.map(t => (
              <div key={t.topic} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  t.myStatus === 'green'  ? 'bg-green-500' :
                  t.myStatus === 'amber'  ? 'bg-amber-400' :
                  t.myStatus === 'red'    ? 'bg-red-500'   : 'bg-gray-200'
                }`} />

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-gray-800 truncate font-medium">{t.topic}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {t.myScore != null
                      ? `My score: ${t.myScore}%`
                      : <span className="italic">Not submitted</span>}
                    {' · '}Class avg: {t.classAvgScore}%
                  </p>
                </div>

                <div className="w-20 flex-shrink-0">
                  {t.myScore != null && (
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          t.myStatus === 'green' ? 'bg-green-500' :
                          t.myStatus === 'amber' ? 'bg-amber-400' : 'bg-red-500'
                        }`}
                        style={{ width: `${t.myScore}%` }}
                      />
                    </div>
                  )}
                </div>

                {t.myStatus === 'red' && (
                  <div className="flex-shrink-0 w-44 text-right">
                    <GenButton topic={t.topic} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
