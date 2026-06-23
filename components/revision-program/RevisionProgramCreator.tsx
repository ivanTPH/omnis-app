'use client'
import React, { useState, useEffect, useTransition, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import Tooltip from '@/components/ui/Tooltip'
import SendBadge from '@/components/ui/SendBadge'
import { gradeLabel } from '@/lib/grading'
import { getClassPerformanceAnalysis, createRevisionProgram, getRevisionProgramDetail, updateRevisionTaskQuestions, getRevisionProgramWeekCount } from '@/app/actions/revision-program'
import { getCurriculumCoverage } from '@/app/actions/year-group-plans'
import type { ClassPerformanceAnalysis } from '@/lib/revision/analysis-engine'
import type { CurriculumCoverage } from '@/app/actions/year-group-plans'

// ── types ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5
type Mode = 'study_guide' | 'formal_assignment'

type WizardState = {
  classId:      string
  className:    string
  subject:      string
  yearGroup:    number
  periodPreset: 'this_term' | 'last_term' | 'custom'
  periodStart:  string
  periodEnd:    string
  mode:         Mode
  deadline:     string
  durationWeeks: number
}

type TopicEntry = {
  id:              string
  name:            string
  hasLesson:       boolean
  sourceMaterial?: string
  showSource?:     boolean
}

// ── helpers ───────────────────────────────────────────────────────────────────

function termDates(preset: 'this_term' | 'last_term') {
  const now = new Date()
  const year = now.getFullYear()
  if (preset === 'this_term') {
    return { start: new Date(year, 0, 8), end: new Date(year, 3, 4) }
  }
  return { start: new Date(year - 1, 8, 1), end: new Date(year - 1, 11, 20) }
}

function scoreColour(pct: number) {
  if (pct >= 75) return { bg: 'bg-green-100', text: 'text-green-700', icon: 'check_circle' }
  if (pct >= 50) return { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'warning' }
  return { bg: 'bg-rose-100', text: 'text-rose-700', icon: 'cancel' }
}

// ── Step 1 ────────────────────────────────────────────────────────────────────

function Step1({
  classes,
  state,
  onChange,
  onNext,
  loading,
}: {
  classes: { id: string; name: string; subject: string; yearGroup: number }[]
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
  loading: boolean
}) {

  const [weekCount, setWeekCount] = useState<number | null>(null)

  const selectedClass = classes.find(c => c.id === state.classId)

  const periodDates = state.periodPreset !== 'custom'
    ? termDates(state.periodPreset)
    : { start: new Date(state.periodStart), end: new Date(state.periodEnd) }

  const canProceed = !!state.classId && !!periodDates.start && !!periodDates.end

  async function handleClassChange(id: string) {
    const cls = classes.find(c => c.id === id)
    if (cls) {
      onChange({ classId: id, className: cls.name, subject: cls.subject, yearGroup: cls.yearGroup })
      setWeekCount(null)
      const count = await getRevisionProgramWeekCount(id)
      setWeekCount(count)
    }
  }

  function handleNext() {
    if (!canProceed) return
    if (state.periodPreset !== 'custom') {
      const d = termDates(state.periodPreset as 'this_term' | 'last_term')
      onChange({ periodStart: d.start.toISOString(), periodEnd: d.end.toISOString() })
    }
    onNext()
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Class</label>
        <select
          value={state.classId}
          onChange={e => handleClassChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a class…</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name} — {c.subject}</option>
          ))}
        </select>
        {state.classId && weekCount != null && (
          <p className={`mt-1.5 text-xs font-medium ${weekCount >= 3 ? 'text-red-600' : weekCount === 2 ? 'text-amber-600' : 'text-gray-500'}`}>
            {weekCount} of 3 programs used this week{weekCount >= 3 ? ' — limit reached' : ''}
          </p>
        )}
      </div>

      {selectedClass && (
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Subject</label>
            <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600">{selectedClass.subject}</div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Year Group</label>
            <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600">Year {selectedClass.yearGroup}</div>
          </div>
        </div>
      )}

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Period to Revise</label>
        <div className="flex gap-2 mb-3">
          {(['this_term', 'last_term', 'custom'] as const).map(p => (
            <button
              key={p}
              onClick={() => onChange({ periodPreset: p })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                state.periodPreset === p
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {p === 'this_term' ? 'This Term' : p === 'last_term' ? 'Last Term' : 'Custom'}
            </button>
          ))}
        </div>
        {state.periodPreset === 'custom' && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">From</label>
              <input type="date" value={state.periodStart.slice(0, 10)} onChange={e => onChange({ periodStart: new Date(e.target.value).toISOString() })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-gray-400 uppercase tracking-wide block mb-1">To</label>
              <input type="date" value={state.periodEnd.slice(0, 10)} onChange={e => onChange({ periodEnd: new Date(e.target.value).toISOString() })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Mode</label>
        <div className="space-y-2">
          {([
            { value: 'study_guide', label: 'Study Guide', desc: 'No deadline. Students work at own pace. Self-assessment only.' },
            { value: 'formal_assignment', label: 'Formal Assignment', desc: 'Set a deadline. Students submit answers. Teacher marks same as homework.' },
          ] as const).map(opt => (
            <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${state.mode === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input type="radio" name="mode" value={opt.value} checked={state.mode === opt.value} onChange={() => onChange({ mode: opt.value })} className="mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {state.mode === 'formal_assignment' && (
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Deadline</label>
          <input type="date" value={state.deadline.slice(0, 10)} onChange={e => onChange({ deadline: new Date(e.target.value).toISOString() })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}

      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Duration</label>
        <div className="flex gap-2">
          {[1, 2, 6].map(w => (
            <button key={w} onClick={() => onChange({ durationWeeks: w })} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${state.durationWeeks === w ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
              {w === 1 ? '1 Week' : w === 2 ? '2 Weeks' : 'Half Term'}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleNext}
        disabled={!canProceed || loading}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
      >
        {loading ? <Icon name="refresh" size="sm" className="animate-spin" /> : null}
        {loading ? 'Analysing…' : 'Analyse Class →'}
      </button>
    </div>
  )
}

// ── Step 2 ────────────────────────────────────────────────────────────────────

const TASK_TYPE_DESCRIPTIONS: Record<string, string> = {
  retrieval_practice: 'Short-answer questions pulling key facts from memory — proven to strengthen long-term retention.',
  spaced_repetition:  'Questions revisiting material at increasing intervals to combat forgetting curves.',
  extended_writing:   'Longer essay or analytical response to develop higher-order thinking and exam technique.',
  exam_style:         'Past-paper style questions at the correct command-word level for the qualification.',
  vocabulary:         'Terminology and definition exercises to build subject-specific language.',
  mixed:              'A blend of question types calibrated to the student\'s individual profile.',
}

function Step2({
  analysis,
  coverage,
  onBack,
  onGenerate,
  generating,
}: {
  analysis:   ClassPerformanceAnalysis
  coverage:   CurriculumCoverage | null
  onBack:     () => void
  onGenerate: () => void
  generating: boolean
}) {
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      {/* Topic heatmap */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Topic Performance</h3>
        {analysis.topicPerformance.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No homework data found for this period — program will be based on lesson topics only.</p>
        ) : (
          <div className="space-y-2">
            {analysis.topicPerformance.map(tp => {
              const pct = Math.round((tp.classAvgScore / 9) * 100)
              const c = scoreColour(pct)
              return (
                <div key={tp.topic} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${c.bg}`}>
                  <Icon name={c.icon} size="sm" className={c.text} />
                  <span className="flex-1 text-xs font-medium text-gray-800 truncate">{tp.topic}</span>
                  <div className="w-24 h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <span className={`text-[11px] font-bold w-10 text-right ${c.text}`}>{pct}%</span>
                  <span className={`text-[10px] font-semibold shrink-0 ${c.text}`}>{pct >= 75 ? 'Strong' : pct >= 50 ? 'Needs revision' : 'Significant gap'}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Student breakdown */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Student Breakdown ({analysis.studentAnalysis.length} students)</h3>
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-500">Student</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-500">
                  <Tooltip content="Average GCSE grade across all homework in the selected period">Avg</Tooltip>
                </th>
                <th className="text-left px-3 py-2 font-semibold text-gray-500">
                  <Tooltip content="Topics where the student scored below the class average">Weak Topics</Tooltip>
                </th>
                <th className="text-left px-3 py-2 font-semibold text-gray-500">
                  <Tooltip content="AI-recommended task format based on the student's learning profile">Task Type</Tooltip>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analysis.studentAnalysis.map(s => {
                const isExpanded = expandedStudentId === s.studentId
                const taskDesc   = TASK_TYPE_DESCRIPTIONS[s.recommendedTaskType] ?? 'AI-recommended question format.'
                return (
                  <React.Fragment key={s.studentId}>
                    <tr
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                      onClick={() => setExpandedStudentId(isExpanded ? null : s.studentId)}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-800">{s.studentName}</span>
                          {s.sendStatus && s.sendStatus !== 'NONE' && (
                            <SendBadge status={s.sendStatus as 'EHCP' | 'SEN_SUPPORT'} />
                          )}
                          <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size="sm" className="text-gray-400 ml-auto shrink-0" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {s.avgScore === 0 ? (
                          <Tooltip content="No graded homework found for this student in the selected period. Revision will be based on lesson topics.">
                            <span className="text-gray-400 italic">—</span>
                          </Tooltip>
                        ) : (
                          <span className={`font-semibold ${s.avgScore >= 6.75 ? 'text-green-600' : s.avgScore >= 4.5 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {gradeLabel(Math.round(s.avgScore))}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{s.weakTopics.slice(0, 2).join(', ') || '—'}</td>
                      <td className="px-3 py-2">
                        <Tooltip content={taskDesc} side="left">
                          <span className="inline-flex items-center gap-0.5 text-blue-600 capitalize cursor-help">
                            {s.recommendedTaskType.replace(/_/g, ' ')}
                            <Icon name="info" size="sm" className="text-blue-400" />
                          </span>
                        </Tooltip>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${s.studentId}-detail`} className="bg-blue-50/30">
                        <td colSpan={4} className="px-4 py-3">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            {/* Weak topics */}
                            <div>
                              <p className="font-semibold text-rose-700 mb-1 uppercase tracking-wide text-[10px]">Weak topics</p>
                              {s.weakTopics.length === 0
                                ? <span className="text-gray-400 italic">None identified</span>
                                : <div className="flex flex-wrap gap-1">{s.weakTopics.map(t => (
                                    <span key={t} className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-medium">{t}</span>
                                  ))}</div>
                              }
                            </div>
                            {/* Strong topics */}
                            <div>
                              <p className="font-semibold text-green-700 mb-1 uppercase tracking-wide text-[10px]">Strong topics</p>
                              {s.strongTopics.length === 0
                                ? <span className="text-gray-400 italic">None identified</span>
                                : <div className="flex flex-wrap gap-1">{s.strongTopics.map(t => (
                                    <span key={t} className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">{t}</span>
                                  ))}</div>
                              }
                            </div>
                            {/* Completion rate */}
                            <div>
                              <p className="font-semibold text-gray-500 mb-1 uppercase tracking-wide text-[10px]">Homework completion</p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${s.completionRate >= 0.75 ? 'bg-green-500' : s.completionRate >= 0.5 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.round(s.completionRate * 100)}%` }} />
                                </div>
                                <span className="text-gray-600 font-semibold">{Math.round(s.completionRate * 100)}%</span>
                              </div>
                            </div>
                            {/* Task type explanation */}
                            <div>
                              <p className="font-semibold text-blue-700 mb-1 uppercase tracking-wide text-[10px]">Recommended approach</p>
                              <p className="text-gray-600">{taskDesc}</p>
                            </div>
                            {/* ILP targets */}
                            {s.ilpTargetsDue.length > 0 && (
                              <div className="col-span-2">
                                <p className="font-semibold text-purple-700 mb-1 uppercase tracking-wide text-[10px]">ILP targets to address</p>
                                <div className="flex flex-wrap gap-1">{s.ilpTargetsDue.map((t, i) => (
                                  <span key={i} className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-medium">{t}</span>
                                ))}</div>
                              </div>
                            )}
                            {/* SEND adaptations */}
                            {s.sendAdaptations.length > 0 && (
                              <div className="col-span-2">
                                <p className="font-semibold text-purple-700 mb-1 uppercase tracking-wide text-[10px]">SEND adaptations to be applied</p>
                                <p className="text-gray-600">{s.sendAdaptations.join(' · ')}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {analysis.studentAnalysis.some(s => s.avgScore === 0) && (
          <p className="text-[10px] text-gray-400 mt-1.5 pl-1">
            — indicates no graded homework was found in the selected period. Revision tasks will be generated from lesson topics instead.
          </p>
        )}
      </div>

      {/* Curriculum coverage */}
      {coverage && coverage.hasSchemeOfWork && coverage.units.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Scheme of Work Coverage</h3>
          <div className="space-y-1.5">
            {coverage.units.map(unit => (
              <div key={unit.title} className={`flex items-start gap-2.5 px-3 py-2 rounded-lg ${unit.taught ? 'bg-green-50' : 'bg-amber-50'}`}>
                <Icon
                  name={unit.taught ? 'check_circle' : 'warning'}
                  size="sm"
                  className={`shrink-0 mt-0.5 ${unit.taught ? 'text-green-500' : 'text-amber-500'}`}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${unit.taught ? 'text-green-800' : 'text-amber-800'}`}>{unit.title}</p>
                  {unit.topics.length > 0 && (
                    <p className="text-[10px] text-gray-500 mt-0.5 truncate">{unit.topics.slice(0, 3).join(' · ')}{unit.topics.length > 3 ? ` +${unit.topics.length - 3} more` : ''}</p>
                  )}
                </div>
                <span className={`text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded ${unit.taught ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {unit.taught ? 'Taught' : 'Gap'}
                </span>
              </div>
            ))}
          </div>
          {coverage.units.some(u => !u.taught) && (
            <p className="text-[10px] text-amber-700 mt-2 pl-1">
              Gap units can be added as revision topics in the next step — paste source material for best results.
            </p>
          )}
        </div>
      )}

      {coverage && !coverage.hasSchemeOfWork && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
          <Icon name="info" size="sm" className="text-gray-400 shrink-0" />
          <p className="text-xs text-gray-500">
            No approved scheme of work found for this subject and year group.{' '}
            <Link href="/plans/year-group" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">Add one →</Link>
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-sm text-blue-800 font-medium">
          {analysis.topicsNeedingRevision.length} topic{analysis.topicsNeedingRevision.length !== 1 ? 's' : ''} need revision
          · {analysis.studentAnalysis.filter(s => s.avgScore < 5.4).length} students below 60% avg
        </p>
        <p className="text-xs text-blue-600 mt-0.5">Estimated generation time: ~{Math.ceil(analysis.studentAnalysis.length / 5) * 15} seconds</p>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          <Icon name="chevron_left" size="sm" /> Back
        </button>
        <button onClick={onGenerate} disabled={generating} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          {generating ? <Icon name="refresh" size="sm" className="animate-spin" /> : null}
          Review Topics →
        </button>
      </div>
    </div>
  )
}

// ── TopicReview (Step 3) ─────────────────────────────────────────────────────

function TopicReview({
  analysis,
  coverage,
  onBack,
  onGenerate,
  generating,
}: {
  analysis:   ClassPerformanceAnalysis
  coverage:   CurriculumCoverage | null
  onBack:     () => void
  onGenerate: (topics: TopicEntry[]) => void
  generating: boolean
}) {
  const lessonTopics = new Set(analysis.topicsCovered.map(t => t.topic))

  const gapTopics: string[] = coverage?.units
    .filter(u => !u.taught)
    .flatMap(u => u.topics.length > 0 ? u.topics : [u.title]) ?? []

  const [topics, setTopics] = useState<TopicEntry[]>(() => {
    const base = analysis.topicsNeedingRevision.length > 0
      ? analysis.topicsNeedingRevision
      : analysis.topicsCovered.map(t => t.topic)
    return [...new Set(base)].map((name, i) => ({
      id: `t${i}`,
      name,
      hasLesson: lessonTopics.has(name),
    }))
  })

  const [newName, setNewName] = useState('')

  function addTopic() {
    const trimmed = newName.trim()
    if (!trimmed) return
    const hasLesson = lessonTopics.has(trimmed)
    setTopics(prev => [...prev, {
      id: `custom-${Date.now()}`,
      name: trimmed,
      hasLesson,
      showSource: !hasLesson,
    }])
    setNewName('')
  }

  function removeTopic(id: string) {
    setTopics(prev => prev.filter(t => t.id !== id))
  }

  function updateTopic(id: string, patch: Partial<TopicEntry>) {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  const noSourceTopics = topics.filter(t => !t.hasLesson && !t.sourceMaterial?.trim())

  return (
    <div className="space-y-5 max-w-lg">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <p className="text-sm font-semibold text-blue-800">Review revision topics</p>
        <p className="text-xs text-blue-600 mt-1">
          Topics below were identified from lesson performance data. Edit, remove or rename any topic.
          Topics with a book icon have lessons behind them — added topics without lessons need source material.
        </p>
      </div>

      <div className="space-y-2">
        {topics.map(topic => (
          <div
            key={topic.id}
            className={`border rounded-xl overflow-hidden transition-colors ${
              topic.hasLesson ? 'border-gray-200' : 'border-amber-200'
            }`}
          >
            <div className={`flex items-center gap-2 px-3 py-2.5 ${topic.hasLesson ? 'bg-white' : 'bg-amber-50'}`}>
              <Icon
                name={topic.hasLesson ? 'menu_book' : 'add_circle'}
                size="sm"
                className={`shrink-0 ${topic.hasLesson ? 'text-blue-500' : 'text-amber-500'}`}
              />
              <input
                type="text"
                value={topic.name}
                onChange={e => updateTopic(topic.id, { name: e.target.value })}
                className="flex-1 text-sm text-gray-800 bg-transparent border-0 focus:outline-none font-medium"
              />
              {!topic.hasLesson && (
                <button
                  onClick={() => updateTopic(topic.id, { showSource: !topic.showSource })}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 transition-colors ${
                    topic.sourceMaterial?.trim()
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  {topic.sourceMaterial?.trim() ? 'Source ✓' : 'Add source'}
                </button>
              )}
              <button
                onClick={() => removeTopic(topic.id)}
                className="text-gray-300 hover:text-rose-500 shrink-0 transition-colors"
                title="Remove topic"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>

            {topic.showSource && !topic.hasLesson && (
              <div className="px-3 pb-3 pt-2 border-t border-amber-100 bg-amber-50 space-y-1.5">
                <p className="text-[10px] text-amber-700 font-semibold">
                  No lesson found for this topic — paste source material so questions are grounded in content:
                </p>
                <textarea
                  rows={3}
                  value={topic.sourceMaterial ?? ''}
                  onChange={e => updateTopic(topic.id, { sourceMaterial: e.target.value })}
                  placeholder="Paste lesson notes, textbook extracts, key facts or mark-scheme points…"
                  className="w-full text-xs border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white resize-none"
                />
              </div>
            )}
          </div>
        ))}

        {topics.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No topics yet — add one below.</p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTopic() } }}
          placeholder="Add a topic not covered above…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={addTopic}
          disabled={!newName.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          Add
        </button>
      </div>

      {/* SoW gap topics callout */}
      {gapTopics.length > 0 && (() => {
        const alreadyAdded = new Set(topics.map(t => t.name.toLowerCase()))
        const missing = gapTopics.filter(g => !alreadyAdded.has(g.toLowerCase()))
        if (missing.length === 0) return null
        return (
          <div className="border border-amber-200 bg-amber-50 rounded-xl px-3 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <Icon name="school" size="sm" className="text-amber-600 shrink-0" />
              <p className="text-xs font-semibold text-amber-800">
                {missing.length} SoW topic{missing.length !== 1 ? 's' : ''} not yet in this list (curriculum gaps)
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {missing.map(name => (
                <button
                  key={name}
                  onClick={() => setTopics(prev => [...prev, {
                    id: `gap-${Date.now()}-${name}`,
                    name,
                    hasLesson: false,
                    showSource: true,
                  }])}
                  className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 transition-colors"
                >
                  + {name}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-amber-700">Click to add to revision list. Paste source material for topics not yet taught.</p>
          </div>
        )
      })()}

      {noSourceTopics.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
          <Icon name="info" size="sm" className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            <span className="font-semibold">{noSourceTopics.map(t => `"${t.name}"`).join(', ')}</span>
            {noSourceTopics.length === 1 ? ' has' : ' have'} no lesson or source material —
            questions will draw on general curriculum knowledge. Add source material for best results.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Icon name="chevron_left" size="sm" /> Back
        </button>
        <button
          onClick={() => onGenerate(topics)}
          disabled={topics.length === 0 || generating}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          {generating ? <Icon name="refresh" size="sm" className="animate-spin" /> : null}
          Generate Personalised Programs →
        </button>
      </div>
    </div>
  )
}

// ── Step 4 ────────────────────────────────────────────────────────────────────

function Step3({ studentCount }: { studentCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="flex items-center gap-3">
        <Icon name="refresh" size="lg" className="animate-spin text-blue-600" />
        <p className="text-lg font-semibold text-gray-800">Generating personalised revision tasks…</p>
      </div>
      <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full animate-pulse w-3/4" />
      </div>
      <p className="text-sm text-gray-500">Creating {studentCount} personalised tasks. Please wait.</p>
      <p className="text-xs text-gray-400">This takes 1–2 minutes for larger classes.</p>
    </div>
  )
}

// ── Step 4 — Review ───────────────────────────────────────────────────────────

function Step4({
  programId,
  analysis,
  onApprove,
  onRegenerate,
}: {
  programId:    string
  analysis:     ClassPerformanceAnalysis
  onApprove:    () => void
  onRegenerate: () => void
}) {
  const [tasks, setTasks]             = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [editedQs, setEditedQs]       = useState<Record<string, any[]>>({})
  const [dirtyIds, setDirtyIds]       = useState<Set<string>>(new Set())
  const [saveErr, setSaveErr]         = useState<string | null>(null)
  const [saving, startSaving]         = useTransition()
  const [focusedQ, setFocusedQ]       = useState<string | null>(null)
  const [showSendOnly, setShowSendOnly] = useState(false)

  const nameMap = Object.fromEntries(
    analysis.studentAnalysis.map(s => [s.studentId, { name: s.studentName, sendStatus: s.sendStatus }])
  )

  useEffect(() => {
    getRevisionProgramDetail(programId).then(detail => {
      const loaded = detail?.tasks ?? []
      setTasks(loaded)
      // Initialise local edit state from loaded questions
      const initial: Record<string, any[]> = {}
      for (const t of loaded) {
        initial[t.id] = [...((t.structuredContent as any)?.questions ?? [])]
      }
      setEditedQs(initial)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [programId])

  function updateQuestion(taskId: string, qi: number, patch: Partial<any>) {
    setEditedQs(prev => {
      const qs = [...(prev[taskId] ?? [])]
      qs[qi] = { ...qs[qi], ...patch }
      return { ...prev, [taskId]: qs }
    })
    setDirtyIds(prev => new Set(prev).add(taskId))
  }

  function deleteQuestion(taskId: string, qi: number) {
    setEditedQs(prev => {
      const qs = [...(prev[taskId] ?? [])]
      qs.splice(qi, 1)
      return { ...prev, [taskId]: qs }
    })
    setDirtyIds(prev => new Set(prev).add(taskId))
  }

  function addQuestion(taskId: string) {
    const newQ = { id: `new_${Date.now()}`, question: '', marks: 1, bloomsLevel: 'retrieval' }
    setEditedQs(prev => ({ ...prev, [taskId]: [...(prev[taskId] ?? []), newQ] }))
    setDirtyIds(prev => new Set(prev).add(taskId))
  }

  function handleSaveEdits() {
    if (dirtyIds.size === 0) return
    setSaveErr(null)
    startSaving(async () => {
      try {
        await Promise.all(
          [...dirtyIds].map(taskId => updateRevisionTaskQuestions(taskId, editedQs[taskId] ?? []))
        )
        setDirtyIds(new Set())
      } catch {
        setSaveErr('Failed to save edits — please try again.')
      }
    })
  }

  const hasDirty = dirtyIds.size > 0
  const canApprove = !hasDirty

  const sendCount = useMemo(() => tasks.filter(t => (t.sendAdaptations ?? []).length > 0).length, [tasks])

  const displayTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      const aS = (a.sendAdaptations ?? []).length > 0
      const bS = (b.sendAdaptations ?? []).length > 0
      if (aS === bS) return 0
      return aS ? -1 : 1
    })
    return showSendOnly ? sorted.filter(t => (t.sendAdaptations ?? []).length > 0) : sorted
  }, [tasks, showSendOnly])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-gray-500">
        <Icon name="refresh" size="sm" className="animate-spin text-blue-600" />
        <span className="text-sm">Loading review…</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* summary banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
        <Icon name="check_circle" size="md" className="text-green-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-green-800">{tasks.length} personalised revision tasks generated</p>
          <p className="text-xs text-green-600 mt-0.5">Expand each student to edit questions, then approve to publish.</p>
        </div>
      </div>

      {saveErr && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          <Icon name="error" size="sm" className="shrink-0" /> {saveErr}
        </div>
      )}

      {/* per-student task previews */}
      <div className="flex items-center gap-2 mb-1">
        <button
          type="button"
          onClick={() => setShowSendOnly(false)}
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${!showSendOnly ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
        >
          All ({tasks.length})
        </button>
        {sendCount > 0 && (
          <button
            type="button"
            onClick={() => setShowSendOnly(true)}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${showSendOnly ? 'bg-purple-700 text-white border-purple-700' : 'bg-white text-purple-700 border-purple-300 hover:border-purple-500'}`}
          >
            SEND adapted ({sendCount})
          </button>
        )}
      </div>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {displayTasks.map(task => {
          const info       = nameMap[task.studentId]
          const name       = info?.name ?? `Student ${task.studentId.slice(0, 6)}`
          const questions  = editedQs[task.id] ?? []
          const sendAdapt: string[] = task.sendAdaptations ?? []
          const isSend     = sendAdapt.length > 0
          const isOpen     = expandedId === task.id
          const isDirty    = dirtyIds.has(task.id)

          return (
            <div key={task.id} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* collapsed header */}
              <button
                type="button"
                onClick={() => setExpandedId(isOpen ? null : task.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 text-left transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{name}</p>
                    {isSend && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white">
                        <span className="material-icons" style={{ fontSize: 11 }}>accessibility_new</span> SEND adapted
                      </span>
                    )}
                    {isDirty && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Edited — unsaved</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {questions.length} question{questions.length !== 1 ? 's' : ''} ·{' '}
                    {task.taskType?.replace(/_/g, ' ') ?? 'retrieval practice'} ·{' '}
                    {(task.weakTopics ?? []).slice(0, 2).join(', ') || 'general revision'}
                  </p>
                </div>
                <Icon name={isOpen ? 'expand_less' : 'expand_more'} size="sm" className="text-gray-400 shrink-0" />
              </button>

              {/* expanded editable questions */}
              {isOpen && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
                  {questions.map((q: any, qi: number) => {
                    const qKey    = `${task.id}-${qi}`
                    const isFocus = focusedQ === qKey
                    return (
                    <div key={q.id ?? qi} className={`bg-white rounded-lg border p-3 space-y-2 transition-colors ${isFocus ? 'border-blue-400' : 'border-gray-200'}`}>
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 font-bold text-gray-400 text-xs w-5 pt-2">{qi + 1}.</span>
                        <textarea
                          rows={2}
                          value={q.question}
                          onChange={e => updateQuestion(task.id, qi, { question: e.target.value })}
                          onFocus={() => setFocusedQ(qKey)}
                          onBlur={() => setFocusedQ(null)}
                          onInput={e => {
                            const t = e.currentTarget
                            t.style.height = 'auto'
                            t.style.height = t.scrollHeight + 'px'
                          }}
                          placeholder="Question text…"
                          style={{ overflowY: 'hidden' }}
                          className={`flex-1 text-xs text-gray-800 border rounded-md px-2 py-1.5 focus:outline-none resize-none transition-colors ${
                            isFocus ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300' : 'border-gray-200'
                          }`}
                        />
                        <Icon
                          name="edit"
                          size="sm"
                          className={`shrink-0 mt-1.5 transition-colors ${isFocus ? 'text-blue-500' : 'text-gray-300'}`}
                        />
                        <button
                          type="button"
                          title="Delete this question"
                          onClick={() => deleteQuestion(task.id, qi)}
                          className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-rose-50 text-gray-300 hover:text-rose-500 transition-colors"
                        >
                          <Icon name="delete" size="sm" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 pl-7">
                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={q.marks ?? 1}
                            onChange={e => updateQuestion(task.id, qi, { marks: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-10 text-xs text-center border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                          <span>marks</span>
                        </div>
                        <span className="text-[10px] text-gray-400 capitalize">{q.bloomsLevel}</span>
                        {q.lessonTitle && (
                          <span className="text-[10px] text-gray-400 italic truncate max-w-[140px]" title={q.lessonTitle}>{q.lessonTitle}</span>
                        )}
                      </div>
                      {/* Optional teacher note */}
                      <div className="pl-7">
                        <input
                          type="text"
                          value={q.teacherNote ?? ''}
                          onChange={e => updateQuestion(task.id, qi, { teacherNote: e.target.value })}
                          placeholder="Add a note for this question (optional)…"
                          className="w-full text-[11px] text-gray-500 border-0 border-b border-dashed border-gray-200 focus:outline-none focus:border-blue-300 bg-transparent"
                        />
                      </div>
                    </div>
                  )
                  })}

                  {/* Add question */}
                  <button
                    type="button"
                    onClick={() => addQuestion(task.id)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    <Icon name="add" size="sm" /> Add question
                  </button>

                  {isSend && (
                    <div className="mt-1 pt-2 border-t border-gray-200">
                      <p className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide mb-0.5">SEND adaptations applied</p>
                      <p className="text-xs text-gray-600">{sendAdapt.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRegenerate}
          className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Icon name="refresh" size="sm" /> Regenerate
        </button>
        {hasDirty && (
          <button
            type="button"
            onClick={handleSaveEdits}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-amber-400 bg-amber-50 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-40 transition-colors"
          >
            {saving ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="save" size="sm" />}
            Save Edits
          </button>
        )}
        <Tooltip content={hasDirty ? 'Save your edits before approving' : ''} side="top">
          <button
            type="button"
            onClick={canApprove ? onApprove : undefined}
            disabled={!canApprove}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <Icon name="check_circle" size="sm" /> Approve &amp; Publish
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function RevisionProgramCreator({
  classes,
}: {
  classes: { id: string; name: string; subject: string; yearGroup: number }[]
}) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>(1)
  const [analysis, setAnalysis] = useState<ClassPerformanceAnalysis | null>(null)
  const [curriculumCoverage, setCurriculumCoverage] = useState<CurriculumCoverage | null>(null)
  const [generatedProgramId, setGeneratedProgramId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [state, setState] = useState<WizardState>({
    classId: '', className: '', subject: '', yearGroup: 0,
    periodPreset: 'this_term',
    periodStart: new Date(new Date().getFullYear(), 0, 8).toISOString(),
    periodEnd:   new Date(new Date().getFullYear(), 3, 4).toISOString(),
    mode: 'study_guide',
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    durationWeeks: 1,
  })

  // Pre-fill class + topic from URL params, or default to first class
  const prefillTopic = searchParams.get('topic') ?? ''
  useEffect(() => {
    const classId = searchParams.get('classId')
    if (classId) {
      // URL param takes priority (e.g. launched from a lesson)
      const cls = classes.find(c => c.id === classId)
      if (cls) setState(prev => ({ ...prev, classId: cls.id, className: cls.name, subject: cls.subject, yearGroup: cls.yearGroup }))
    } else if (classes.length > 0) {
      // Default to the teacher's first class so the wizard opens ready to go
      const cls = classes[0]
      setState(prev => ({ ...prev, classId: cls.id, className: cls.name, subject: cls.subject, yearGroup: cls.yearGroup }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function patch(p: Partial<WizardState>) { setState(prev => ({ ...prev, ...p })) }

  async function handleAnalyse() {
    setError(null)
    setIsLoading(true)
    const start = state.periodPreset !== 'custom'
      ? termDates(state.periodPreset as 'this_term' | 'last_term').start
      : new Date(state.periodStart)
    const end = state.periodPreset !== 'custom'
      ? termDates(state.periodPreset as 'this_term' | 'last_term').end
      : new Date(state.periodEnd)
    try {
      const [result, coverage] = await Promise.all([
        getClassPerformanceAnalysis(state.classId, start, end),
        getCurriculumCoverage(state.classId, state.subject, state.yearGroup).catch(() => null),
      ])
      setAnalysis(result)
      setCurriculumCoverage(coverage)
      setStep(2)
    } catch {
      setError('Failed to analyse class performance. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleGoToTopics() {
    if (!analysis) return
    setError(null)
    setStep(3)
  }

  async function handleGenerate(topics: TopicEntry[]) {
    if (!analysis) return
    setError(null)
    setIsLoading(true)
    setStep(4)

    const start = new Date(state.periodStart)
    const end   = new Date(state.periodEnd)

    try {
      const result = await createRevisionProgram({
        classId:      state.classId,
        title:        `${state.subject} Revision — ${new Date(state.periodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        subject:      state.subject,
        periodStart:  start,
        periodEnd:    end,
        mode:         state.mode,
        deadline:     state.mode === 'formal_assignment' ? new Date(state.deadline) : undefined,
        durationWeeks: state.durationWeeks,
        approvedTopics: topics,
      })
      setGeneratedProgramId(result.programId)
      setStep(5)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to generate revision program.')
      setStep(3)
    } finally {
      setIsLoading(false)
    }
  }

  const stepLabels = ['Scope', 'Analysis', 'Topics', 'Generating', 'Review']

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* stepper */}
      <div className="flex items-center gap-2 mb-8">
        {stepLabels.map((label, i) => {
          const n = (i + 1) as Step
          const active = step === n
          const done   = step > n
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-xs font-medium ${active ? 'text-blue-700' : done ? 'text-green-600' : 'text-gray-400'}`}>{label}</span>
              {i < stepLabels.length - 1 && <div className="w-6 h-px bg-gray-300" />}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          <Icon name="error" size="sm" className="shrink-0" />
          {error}
        </div>
      )}

      {step === 1 && prefillTopic && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-[13px] text-blue-800">
          <Icon name="bookmark" size="sm" className="shrink-0 text-blue-500" />
          <span>Topic focus: <span className="font-semibold">{prefillTopic}</span></span>
        </div>
      )}
      {step === 1 && (
        <Step1 classes={classes} state={state} onChange={patch} onNext={handleAnalyse} loading={isLoading} />
      )}
      {step === 2 && analysis && (
        <Step2 analysis={analysis} coverage={curriculumCoverage} onBack={() => setStep(1)} onGenerate={handleGoToTopics} generating={isLoading} />
      )}
      {step === 3 && analysis && (
        <TopicReview analysis={analysis} coverage={curriculumCoverage} onBack={() => setStep(2)} onGenerate={handleGenerate} generating={isLoading} />
      )}
      {step === 4 && (
        <Step3 studentCount={analysis?.studentAnalysis.length ?? 0} />
      )}
      {step === 5 && analysis && generatedProgramId && (
        <Step4
          programId={generatedProgramId}
          analysis={analysis}
          onApprove={() => router.push(`/revision-program/${generatedProgramId}`)}
          onRegenerate={() => setStep(3)}
        />
      )}
    </div>
  )
}
