'use client'
import { useState, useEffect, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Star, CheckCircle2, Loader2, AlertCircle, Clock } from 'lucide-react'
import { submitRevisionTask, selfAssessRevisionTask } from '@/app/actions/revision-program'

type RevTask = {
  id:               string
  taskType:         string
  instructions:     string
  structuredContent: any
  focusTopics:      string[]
  sendAdaptations:  string[]
  estimatedMins:    number
  status:           string
  selfConfidence:   number | null
  program: {
    title:    string
    subject:  string
    mode:     string
    deadline: Date | string | null
  }
}

const ENCOURAGEMENT: Record<number, string> = {
  1: "Keep going — revision takes time! Try reviewing your notes and attempt again.",
  2: "Keep going — revision takes time! Try reviewing your notes and attempt again.",
  3: "Good progress! A few more practice attempts will build your confidence.",
  4: "Excellent work! You're making great progress.",
  5: "Excellent work! You're making great progress.",
}

function FocusPanel({ topics }: { topics: string[] }) {
  const [open, setOpen] = useState(true)
  if (topics.length === 0) return null
  return (
    <div className="border border-amber-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 text-left">
        <span className="text-xs font-semibold text-amber-800">Your revision focus areas</span>
        <span className="text-amber-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 py-3 space-y-1.5 bg-white">
          {topics.map(t => (
            <div key={t} className="flex items-start gap-2 text-xs text-gray-700">
              <span className="text-amber-500 mt-0.5">→</span>
              <span>{t} — let&apos;s work on this together!</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FreeTextTask({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={8}
      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      placeholder="Write your answer here…"
    />
  )
}

function QuizTask({ content, value, onChange }: { content: any; value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const questions = content?.questions ?? []
  return (
    <div className="space-y-4">
      {questions.map((q: any, i: number) => (
        <div key={q.id ?? i} className="border border-gray-200 rounded-xl px-4 py-4">
          <p className="text-sm font-medium text-gray-800 mb-2">{i + 1}. {q.question}</p>
          {q.options ? (
            <div className="space-y-2">
              {q.options.map((opt: any) => (
                <label key={opt.id} className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name={`q${q.id ?? i}`} value={opt.id} checked={value[q.id ?? i] === opt.id} onChange={() => onChange({ ...value, [q.id ?? i]: opt.id })} className="mt-0.5" />
                  <span className="text-sm text-gray-700">{opt.text}</span>
                </label>
              ))}
            </div>
          ) : (
            <textarea
              rows={3}
              value={value[q.id ?? i] ?? ''}
              onChange={e => onChange({ ...value, [q.id ?? i]: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder={q.guidance ?? 'Write your answer…'}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export default function RevisionTaskView({ task }: { task: RevTask }) {
  const router  = useRouter()
  const [response, setResponse] = useState<any>({})
  const [confidence, setConfidence]   = useState<number>(task.selfConfidence ?? 0)
  const [phase, setPhase]             = useState<'task' | 'assess' | 'done'>('task')
  const [isPending, startTransition]  = useTransition()
  const [error, setError]             = useState<string | null>(null)
  const [saved, setSaved]             = useState(false)
  const startTimeRef                  = useRef<number>(Date.now())

  const isStudyGuide = task.program.mode === 'study_guide'
  const alreadyDone  = ['submitted','marked','returned'].includes(task.status)

  // Load draft from localStorage and set start time on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const draft = localStorage.getItem(`revision_draft_${task.id}`)
        if (draft) setResponse(JSON.parse(draft))
      } catch { /* ignore */ }

      const stored = localStorage.getItem(`revision_start_${task.id}`)
      if (stored) {
        startTimeRef.current = Number(stored)
      } else {
        const now = Date.now()
        localStorage.setItem(`revision_start_${task.id}`, String(now))
        startTimeRef.current = now
      }
    }
  }, [task.id])

  // Auto-save every 60s
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`revision_draft_${task.id}`, JSON.stringify(response))
      }
    }, 60000)
    return () => clearInterval(id)
  }, [task.id, response])

  function getMinutes() {
    return Math.round((Date.now() - startTimeRef.current) / 60000)
  }

  function handleSubmit() {
    setError(null)
    const mins = getMinutes()
    startTransition(async () => {
      try {
        await submitRevisionTask(task.id, response, mins)
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`revision_draft_${task.id}`)
          localStorage.removeItem(`revision_start_${task.id}`)
        }
        setPhase('assess')
      } catch {
        setError('Submission failed. Your answers are saved — please try again.')
        if (typeof window !== 'undefined') {
          localStorage.setItem(`revision_draft_${task.id}`, JSON.stringify(response))
        }
      }
    })
  }

  function handleSelfAssess() {
    if (confidence === 0) return
    startTransition(async () => {
      try {
        await selfAssessRevisionTask(task.id, confidence)
        setSaved(true)
        setTimeout(() => router.push('/student/revision'), 1500)
      } catch {
        setError('Could not save your confidence rating. Please try again.')
      }
    })
  }

  // Already done state
  if (alreadyDone && phase === 'task') {
    return (
      <div className="max-w-xl mx-auto px-6 py-12 text-center space-y-4">
        <CheckCircle2 size={40} className="text-green-500 mx-auto" />
        <p className="text-base font-semibold text-gray-900">Task submitted!</p>
        <p className="text-sm text-gray-500">{isStudyGuide ? 'Well done for completing this revision task.' : 'Your teacher will review and return it with feedback.'}</p>
        <Link href="/student/revision" className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
          Back to Revision
        </Link>
      </div>
    )
  }

  // Self-assessment phase
  if (phase === 'assess') {
    return (
      <div className="max-w-xl mx-auto px-6 py-12 space-y-6">
        <div className="text-center space-y-2">
          <CheckCircle2 size={36} className="text-green-500 mx-auto" />
          <p className="text-base font-semibold text-gray-900">
            {isStudyGuide ? 'Task marked as complete!' : 'Submitted for marking!'}
          </p>
          <p className="text-sm text-gray-500">{isStudyGuide ? 'How confident do you feel about these topics now?' : 'While your teacher reviews it, how confident do you feel?'}</p>
        </div>
        <div className="flex justify-center gap-3">
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => setConfidence(n)} className="transition-transform hover:scale-110">
              <Star size={32} className={n <= confidence ? 'text-amber-400 fill-amber-400' : 'text-gray-300'} />
            </button>
          ))}
        </div>
        {confidence > 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-center">
            <p className="text-sm text-blue-800">{ENCOURAGEMENT[confidence]}</p>
          </div>
        )}
        {error && <p className="text-xs text-rose-600 text-center">{error}</p>}
        {saved ? (
          <p className="text-center text-sm text-green-600 font-medium">Saved! Returning…</p>
        ) : (
          <button
            onClick={handleSelfAssess}
            disabled={confidence === 0 || isPending}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            {isPending ? <Loader2 size={15} className="animate-spin" /> : null}
            Save &amp; finish
          </button>
        )}
      </div>
    )
  }

  // Main task phase
  const hasStructured = task.structuredContent && typeof task.structuredContent === 'object'
  const isYearRevision = task.taskType === 'year_revision'
  const needsQuiz      = ['quiz','multiple_choice','retrieval_practice','short_answer'].includes(task.taskType) && hasStructured

  if (isYearRevision) {
    return (
      <YearRevisionView
        task={task}
        response={response}
        setResponse={setResponse}
        isPending={isPending}
        error={error}
        isStudyGuide={isStudyGuide}
        onSubmit={handleSubmit}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
      {/* instructions */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Task Instructions</p>
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {task.instructions}
        </div>
      </div>

      <FocusPanel topics={task.focusTopics} />

      {/* response area */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Your Response</p>
        {needsQuiz ? (
          <QuizTask
            content={task.structuredContent}
            value={response}
            onChange={setResponse}
          />
        ) : (
          <FreeTextTask
            value={typeof response === 'string' ? response : (response?.text ?? '')}
            onChange={v => setResponse({ text: v })}
          />
        )}
      </div>

      {/* SEND note */}
      {task.sendAdaptations.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <p className="text-xs text-amber-700 font-medium">This task has been adapted for you: {task.sendAdaptations.join(', ')}</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* submit */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Clock size={11} /> ~{task.estimatedMins} mins · auto-saved every minute
        </p>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
          {isStudyGuide ? 'Mark as Complete ✓' : 'Submit for Marking →'}
        </button>
      </div>
      <p className="text-xs text-gray-400 text-right">
        {isStudyGuide ? 'No deadline — take your time.' : 'Once submitted your teacher will review and return with feedback.'}
      </p>
    </div>
  )
}

// ── YearRevisionView ─────────────────────────────────────────────────────────

function YearRevisionView({ task, response, setResponse, isPending, error, isStudyGuide, onSubmit }: {
  task: RevTask; response: any; setResponse: (v: any) => void
  isPending: boolean; error: string | null; isStudyGuide: boolean; onSubmit: () => void
}) {
  const sc          = task.structuredContent as any
  const guide       = sc?.genericGuide?.topics   as any[] ?? []
  const focusTopics = sc?.focusAreas?.topics      as any[] ?? []

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Instructions */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-sm text-gray-800 leading-relaxed">
        {task.instructions}
      </div>

      {/* ── Section A: Revision Guide ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">A</span>
          <h2 className="text-base font-semibold text-gray-900">Revision Guide</h2>
          <span className="text-xs text-gray-400">All topics covered this year</span>
        </div>
        <div className="space-y-4">
          {guide.map((topic: any, i: number) => (
            <TopicCard key={i} topic={topic} />
          ))}
          {guide.length === 0 && (
            <p className="text-sm text-gray-400 italic">Revision guide will appear here.</p>
          )}
        </div>
      </section>

      {/* ── Section B: Focus Areas ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center shrink-0">B</span>
          <h2 className="text-base font-semibold text-gray-900">Focus Areas</h2>
          <span className="text-xs text-amber-600 font-medium">Personalised for you</span>
        </div>
        {focusTopics.length === 0 ? (
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-4 text-sm text-green-700">
            Great work! No specific focus areas identified — your scores are on track across all topics.
          </div>
        ) : (
          <div className="space-y-4">
            {focusTopics.map((topic: any, i: number) => (
              <FocusTopicCard key={i} topic={topic} />
            ))}
          </div>
        )}
      </section>

      {/* ── Response ── */}
      <section>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Your Notes / Response</p>
        <FreeTextTask
          value={typeof response === 'string' ? response : (response?.text ?? '')}
          onChange={v => setResponse({ text: v })}
        />
        <p className="text-xs text-gray-400 mt-1">Use this space to make notes, answer exam questions, or summarise key points.</p>
      </section>

      {task.sendAdaptations.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <p className="text-xs text-amber-700 font-medium">This guide has been adapted for you: {task.sendAdaptations.join(', ')}</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Clock size={11} /> ~{task.estimatedMins} mins · auto-saved every minute
        </p>
        <button
          onClick={onSubmit}
          disabled={isPending}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
          {isStudyGuide ? 'Mark as Complete ✓' : 'Submit for Marking →'}
        </button>
      </div>
    </div>
  )
}

function TopicCard({ topic }: { topic: any }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 text-left transition-colors"
      >
        <span className="text-sm font-semibold text-gray-800">{topic.name}</span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 bg-white border-t border-gray-100">
          {topic.keyFacts?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-1.5">Key Facts</p>
              <ul className="space-y-1">
                {topic.keyFacts.map((f: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {topic.vocabulary?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Key Vocabulary</p>
              <div className="space-y-1">
                {topic.vocabulary.map((v: any, i: number) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="font-semibold text-gray-800 shrink-0">{v.term}</span>
                    <span className="text-gray-500">— {v.definition}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {topic.examQuestions?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Exam-Style Questions</p>
              <div className="space-y-2">
                {topic.examQuestions.map((q: any, i: number) => (
                  <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-gray-800">{q.question} <span className="text-gray-400 font-normal">({q.marks} marks)</span></p>
                    <details className="mt-1">
                      <summary className="text-[10px] text-blue-600 cursor-pointer hover:text-blue-800">Show mark scheme</summary>
                      <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">{q.markScheme}</p>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FocusTopicCard({ topic }: { topic: any }) {
  return (
    <div className="border border-amber-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-amber-50">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-amber-900">{topic.name}</span>
        </div>
        <p className="text-xs text-amber-700">{topic.reason}</p>
      </div>
      {topic.practiceQuestions?.length > 0 && (
        <div className="px-4 py-3 space-y-2 bg-white border-t border-amber-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Practice Questions</p>
          {topic.practiceQuestions.map((q: any, i: number) => (
            <div key={i} className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <p className="text-xs font-medium text-gray-800">{q.question} <span className="text-gray-400 font-normal">({q.marks} marks)</span></p>
              <details className="mt-1">
                <summary className="text-[10px] text-amber-600 cursor-pointer hover:text-amber-800">Show mark scheme</summary>
                <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">{q.markScheme}</p>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
