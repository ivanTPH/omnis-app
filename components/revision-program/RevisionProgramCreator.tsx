'use client'
import { useState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import Tooltip from '@/components/ui/Tooltip'
import { gradeLabel } from '@/lib/grading'
import { getClassPerformanceAnalysis, createRevisionProgram, getRevisionProgramDetail } from '@/app/actions/revision-program'
import { getTeacherClasses } from '@/app/actions/homework'
import type { ClassPerformanceAnalysis } from '@/lib/revision/analysis-engine'

// ── types ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4
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
  if (pct >= 75) return { bg: 'bg-green-100', text: 'text-green-700', icon: '✅' }
  if (pct >= 50) return { bg: 'bg-amber-100', text: 'text-amber-700', icon: '⚠️' }
  return { bg: 'bg-rose-100', text: 'text-rose-700', icon: '❌' }
}

// ── Step 1 ────────────────────────────────────────────────────────────────────

function Step1({
  classes,
  state,
  onChange,
  onNext,
}: {
  classes: { id: string; name: string; subject: string; yearGroup: number }[]
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
}) {
  const [analysing, startAnalysing] = useTransition()

  const selectedClass = classes.find(c => c.id === state.classId)

  const periodDates = state.periodPreset !== 'custom'
    ? termDates(state.periodPreset)
    : { start: new Date(state.periodStart), end: new Date(state.periodEnd) }

  const canProceed = !!state.classId && !!periodDates.start && !!periodDates.end

  function handleClassChange(id: string) {
    const cls = classes.find(c => c.id === id)
    if (cls) onChange({ classId: id, className: cls.name, subject: cls.subject, yearGroup: cls.yearGroup })
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
        disabled={!canProceed || analysing}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
      >
        {analysing ? <Icon name="refresh" size="sm" className="animate-spin" /> : null}
        Analyse Class →
      </button>
    </div>
  )
}

// ── Step 2 ────────────────────────────────────────────────────────────────────

function Step2({
  analysis,
  onBack,
  onGenerate,
  generating,
}: {
  analysis: ClassPerformanceAnalysis
  onBack: () => void
  onGenerate: () => void
  generating: boolean
}) {
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
                  <span className="text-[11px]">{c.icon}</span>
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
              {analysis.studentAnalysis.map(s => (
                <tr key={s.studentId} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <span className="font-medium text-gray-800">{s.studentName}</span>
                    {s.sendStatus && s.sendStatus !== 'NONE' && (
                      <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded bg-purple-100 text-purple-700">{s.sendStatus}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`font-semibold ${s.avgScore >= 6.75 ? 'text-green-600' : s.avgScore >= 4.5 ? 'text-amber-600' : 'text-rose-600'}`}>
                      {gradeLabel(Math.round(s.avgScore))}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{s.weakTopics.slice(0, 2).join(', ') || '—'}</td>
                  <td className="px-3 py-2 text-blue-600 capitalize">{s.recommendedTaskType.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
          Generate Personalised Programs →
        </button>
      </div>
    </div>
  )
}

// ── Step 3 ────────────────────────────────────────────────────────────────────

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
  const [tasks, setTasks]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const nameMap = Object.fromEntries(
    analysis.studentAnalysis.map(s => [s.studentId, { name: s.studentName, sendStatus: s.sendStatus }])
  )

  useEffect(() => {
    getRevisionProgramDetail(programId).then(detail => {
      setTasks(detail?.tasks ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [programId])

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
          <p className="text-xs text-green-600 mt-0.5">Review each student&apos;s questions below, then approve to publish the program.</p>
        </div>
      </div>

      {/* per-student task previews */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {tasks.map(task => {
          const info      = nameMap[task.studentId]
          const name      = info?.name ?? `Student ${task.studentId.slice(0, 6)}`
          const content   = task.structuredContent as any
          const questions: any[] = content?.questions ?? []
          const sendAdapt: string[] = task.sendAdaptations ?? []
          const isSend    = sendAdapt.length > 0
          const isOpen    = expandedId === task.id

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
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                        SEND adapted
                      </span>
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

              {/* expanded questions */}
              {isOpen && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
                  {questions.map((q: any, qi: number) => (
                    <div key={q.id ?? qi} className="flex items-start gap-2 text-xs">
                      <span className="shrink-0 font-bold text-gray-400 w-5">{q.id ?? qi + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800">{q.question}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-400 flex-wrap">
                          <span>{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                          <span>·</span>
                          <span className="capitalize">{q.bloomsLevel}</span>
                          {q.lessonTitle && (
                            <>
                              <span>·</span>
                              <span className="italic truncate max-w-[160px]" title={q.lessonTitle}>{q.lessonTitle}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
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
        <button
          type="button"
          onClick={onApprove}
          className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Icon name="check_circle" size="sm" /> Approve &amp; View Program
        </button>
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
  const [generatedProgramId, setGeneratedProgramId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
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

  function handleAnalyse() {
    setError(null)
    const start = state.periodPreset !== 'custom'
      ? termDates(state.periodPreset as 'this_term' | 'last_term').start
      : new Date(state.periodStart)
    const end = state.periodPreset !== 'custom'
      ? termDates(state.periodPreset as 'this_term' | 'last_term').end
      : new Date(state.periodEnd)

    startTransition(async () => {
      try {
        const result = await getClassPerformanceAnalysis(state.classId, start, end)
        setAnalysis(result)
        setStep(2)
      } catch (e) {
        setError('Failed to analyse class performance. Please try again.')
      }
    })
  }

  function handleGenerate() {
    if (!analysis) return
    setError(null)
    setStep(3)

    const start = new Date(state.periodStart)
    const end   = new Date(state.periodEnd)

    startTransition(async () => {
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
        })
        setGeneratedProgramId(result.programId)
        setStep(4) // Show review before navigating
      } catch (e: any) {
        setError(e?.message ?? 'Failed to generate revision program.')
        setStep(2)
      }
    })
  }

  const stepLabels = ['Scope', 'Analysis', 'Generating', 'Review']

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
        <Step1 classes={classes} state={state} onChange={patch} onNext={handleAnalyse} />
      )}
      {step === 2 && analysis && (
        <Step2 analysis={analysis} onBack={() => setStep(1)} onGenerate={handleGenerate} generating={isPending} />
      )}
      {step === 3 && (
        <Step3 studentCount={analysis?.studentAnalysis.length ?? 0} />
      )}
      {step === 4 && analysis && generatedProgramId && (
        <Step4
          programId={generatedProgramId}
          analysis={analysis}
          onApprove={() => router.push(`/revision-program/${generatedProgramId}`)}
          onRegenerate={() => setStep(2)}
        />
      )}
    </div>
  )
}
