'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markSubmission } from '@/app/actions/homework'
import {
  ChevronDown, ChevronUp, CheckCircle2, Loader2,
  AlertTriangle, BookOpen, Target,
} from 'lucide-react'
import { StrategyAppliesTo } from '@prisma/client'

type MarkingData = NonNullable<Awaited<ReturnType<typeof import('@/app/actions/homework').getSubmissionForMarking>>>

// ── helpers ──────────────────────────────────────────────────────────────────

function maxFromBands(bands: unknown): number {
  if (!bands || typeof bands !== 'object' || Array.isArray(bands)) return 9
  return Math.max(
    ...Object.keys(bands as Record<string, string>)
      .flatMap(k => k.split(/[-–]/).map(Number).filter(n => !isNaN(n))),
    1,
  )
}

function suggestGrade(score: number, bands: unknown): string {
  if (!bands || typeof bands !== 'object' || Array.isArray(bands)) return ''
  for (const range of Object.keys(bands as Record<string, string>)) {
    const parts = range.split(/[-–]/).map(Number)
    const [lo, hi] = parts.length === 1 ? [parts[0], parts[0]] : [parts[0], parts[1]]
    if (score >= lo && score <= hi) return range
  }
  return ''
}

// ── component ─────────────────────────────────────────────────────────────────

export default function SubmissionMarkingView({
  data,
  homeworkId,
}: {
  data: MarkingData
  homeworkId: string
}) {
  const router = useRouter()
  const hw     = data.homework

  const maxScore = maxFromBands(hw.gradingBands)

  const [score,    setScore]    = useState(data.finalScore != null ? String(data.finalScore) : '')
  const [grade,    setGrade]    = useState(data.grade    ?? '')
  const [feedback, setFeedback] = useState(data.feedback ?? '')
  const [showModelAnswer, setShowModelAnswer] = useState(false)
  const [showBands,       setShowBands]       = useState(false)
  const [isPending, startTransition] = useTransition()
  const [saved,    setSaved]         = useState(false)

  const isAlreadyMarked = data.status === 'RETURNED' || data.status === 'MARKED'

  function handleScoreChange(v: string) {
    setScore(v)
    const n = Number(v)
    if (!isNaN(n) && v !== '') setGrade(suggestGrade(n, hw.gradingBands))
  }

  function handleSave() {
    const n = Number(score)
    if (isNaN(n) || n < 0 || n > maxScore) return
    startTransition(async () => {
      await markSubmission(data.id, {
        teacherScore: n,
        feedback,
        grade: grade || undefined,
      })
      setSaved(true)
      router.refresh()
      // Auto-advance to next submission after a short pause
      if (data.nav.next) {
        setTimeout(() => {
          router.push(`/homework/${homeworkId}/mark/${data.nav.next}`)
        }, 1200)
      }
    })
  }

  const pct         = score !== '' && !isNaN(Number(score)) ? (Number(score) / maxScore) * 100 : 0
  const barColour   = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'

  const hwStrats = data.plan?.strategies.filter(
    s => s.appliesTo === StrategyAppliesTo.HOMEWORK || s.appliesTo === StrategyAppliesTo.BOTH
  ) ?? []
  const classStrats = data.plan?.strategies.filter(
    s => s.appliesTo === StrategyAppliesTo.CLASSROOM || s.appliesTo === StrategyAppliesTo.BOTH
  ) ?? []

  return (
    <div className="flex h-full min-h-0">

      {/* ── Left: submission content ─────────────────────────────────────── */}
      <div className="flex-1 overflow-auto border-r border-gray-100">
        <div className="max-w-2xl mx-auto px-8 py-7 space-y-5">

          {/* Student + submission meta */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-[12px] shrink-0">
              {data.student.firstName[0]}{data.student.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[15px] font-bold text-gray-900">
                  {data.student.firstName} {data.student.lastName}
                </p>
                {data.sendStatus && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    data.sendStatus.activeStatus === 'EHCP'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-rose-100 text-rose-600'
                  }`}>
                    {data.sendStatus.activeStatus === 'EHCP' ? 'EHCP' : 'SEN Support'}
                    {data.sendStatus.needArea ? ` · ${data.sendStatus.needArea}` : ''}
                  </span>
                )}
                {hw.isAdapted && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                    Adapted version
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {hw.class?.name}
                {' · '}Submitted {new Date(data.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {' at '}
                {new Date(data.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                {isAlreadyMarked && data.markedAt && (
                  <span className="text-green-600">
                    {' · '}Returned {new Date(data.markedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* SEND support notice */}
          {data.plan && (hwStrats.length > 0 || classStrats.length > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                <p className="text-[12px] font-semibold text-amber-900">
                  SEND Support Plan active — consider these strategies when marking
                </p>
              </div>
              {hwStrats.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1.5">Homework strategies</p>
                  <div className="space-y-1">
                    {hwStrats.map(s => (
                      <div key={s.id} className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <p className="text-[12px] text-amber-800">{s.strategyText}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {classStrats.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1.5">In-class strategies applied</p>
                  <div className="space-y-1">
                    {classStrats.map(s => (
                      <div key={s.id} className="flex items-start gap-2">
                        <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                        <p className="text-[12px] text-amber-700">{s.strategyText}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Homework instructions */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <BookOpen size={12} className="text-gray-400" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Instructions</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5 text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
              {hw.instructions}
            </div>
          </div>

          {/* Student submission */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Student's Submission</p>
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap min-h-[160px]">
              {data.content}
            </div>
          </div>

          {/* Model answer (collapsible) */}
          {hw.modelAnswer && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowModelAnswer(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
              >
                <div className="flex items-center gap-2">
                  <Target size={13} className="text-gray-500" />
                  <span className="text-[12px] font-semibold text-gray-700">Model Answer</span>
                </div>
                {showModelAnswer ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>
              {showModelAnswer && (
                <div className="px-5 py-4 text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap border-t border-gray-100">
                  {hw.modelAnswer}
                </div>
              )}
            </div>
          )}

          {/* Mark scheme (collapsible) */}
          {hw.gradingBands && typeof hw.gradingBands === 'object' && !Array.isArray(hw.gradingBands) && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowBands(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
              >
                <span className="text-[12px] font-semibold text-gray-700">Mark Scheme</span>
                {showBands ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>
              {showBands && (
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {Object.entries(hw.gradingBands as Record<string, string>).map(([band, desc]) => (
                    <div key={band} className="flex gap-4 px-5 py-3">
                      <span className="text-[11px] font-bold text-blue-700 w-10 shrink-0 pt-0.5">{band}</span>
                      <span className="text-[12px] text-gray-600 leading-snug">{desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Right: marking panel ─────────────────────────────────────────── */}
      <div className="w-80 shrink-0 overflow-auto border-l border-gray-200 bg-gray-50">
        <div className="px-6 py-6 space-y-5">

          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
              {isAlreadyMarked ? 'Update Mark' : 'Mark Submission'}
            </p>

            {/* Score */}
            <div className="mb-4">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-2">
                Score (out of {maxScore})
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={maxScore}
                  value={score}
                  onChange={e => handleScoreChange(e.target.value)}
                  className="w-20 border border-gray-300 rounded-xl px-3 py-2.5 text-[18px] font-bold text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  placeholder="—"
                />
                <span className="text-[13px] text-gray-400">/ {maxScore}</span>
              </div>
              {score !== '' && (
                <div className="mt-3">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColour}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{Math.round(pct)}%</p>
                </div>
              )}
            </div>

            {/* Grade */}
            <div className="mb-4">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-2">Grade</label>
              <input
                type="text"
                value={grade}
                onChange={e => setGrade(e.target.value)}
                className="w-24 border border-gray-300 rounded-xl px-3 py-2.5 text-[16px] font-bold text-gray-900 text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                placeholder="—"
              />
              <p className="text-[10px] text-gray-400 mt-1">Auto-suggested from score</p>
            </div>

            {/* Feedback */}
            <div className="mb-5">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-2">
                Feedback to Student
              </label>
              <textarea
                rows={8}
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-3 text-[13px] text-gray-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white"
                placeholder="Write constructive feedback for the student…"
              />
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={handleSave}
                disabled={isPending || score === ''}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-3 rounded-xl text-[13px] font-semibold transition-colors"
              >
                {isPending
                  ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                  : saved
                    ? <><CheckCircle2 size={14} /> {data.nav.next ? 'Saved — moving on…' : 'Returned to student'}</>
                    : isAlreadyMarked ? 'Update & Return' : 'Mark & Return'
                }
              </button>

              {saved && !isPending && (
                <p className="text-[11px] text-green-600 text-center font-medium">
                  <CheckCircle2 size={11} className="inline mr-1" />
                  {data.nav.next ? 'Moving to next student…' : 'All done!'}
                </p>
              )}
            </div>
          </div>

          {/* Previous mark info */}
          {isAlreadyMarked && (
            <div className="border-t border-gray-200 pt-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Previously Returned</p>
              <div className="space-y-1 text-[12px] text-gray-500">
                {data.finalScore != null && <p>Score: <span className="font-semibold text-gray-700">{data.finalScore} / {maxScore}</span></p>}
                {data.grade           && <p>Grade: <span className="font-bold text-green-700">{data.grade}</span></p>}
                {data.markedAt        && <p>Returned: {new Date(data.markedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  )
}
