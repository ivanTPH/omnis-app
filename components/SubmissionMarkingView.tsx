'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { markSubmission } from '@/app/actions/homework'
import { percentToGcseGrade, normalizeScoreForForm, gradeLabel as gcseGradeLabel } from '@/lib/grading'
import Icon from '@/components/ui/Icon'
import { StrategyAppliesTo } from '@prisma/client'
import StudentAvatar from '@/components/StudentAvatar'

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

  // FIX 1 + 3: normalise finalScore — auto-mark stores a percentage, manual stores raw grade score
  // FIX 2: pre-fill feedback from autoFeedback when teacher hasn't written their own yet
  const [score,    setScore]    = useState(() => normalizeScoreForForm(data.finalScore, maxScore))
  const [grade,    setGrade]    = useState(() => {
    if (data.grade) return data.grade
    // Derive grade from the normalised score (same scale as the score input)
    const normScore = normalizeScoreForForm(data.finalScore, maxScore)
    if (normScore === '') return ''
    const n = Number(normScore)
    return suggestGrade(n, hw.gradingBands) ||
      String(percentToGcseGrade(Math.round((n / maxScore) * 100)))
  })
  const [feedback, setFeedback] = useState(data.feedback ?? (data as any).autoFeedback ?? '')
  const [showModelAnswer, setShowModelAnswer] = useState(false)
  const [showBands,       setShowBands]       = useState(false)
  const [isPending, startTransition] = useTransition()
  const [saved,     setSaved]         = useState(false)
  const [error,     setError]         = useState<string | null>(null)

  const isAlreadyMarked    = data.status === 'RETURNED' || data.status === 'MARKED'
  const isReturned         = data.status === 'RETURNED'
  const isAutoMarkedPending = (data as any).autoMarked && !(data as any).teacherReviewed

  // Grade visual state: auto (amber) → confirmed (green) → final/returned (neutral)
  const gradeState: 'auto' | 'confirmed' | 'final' | 'empty' =
    isReturned ? 'final' :
    (data as any).teacherReviewed ? 'confirmed' :
    isAutoMarkedPending ? 'auto' :
    'empty'
  const gradeBoxClass =
    gradeState === 'auto'      ? 'bg-amber-50 border-amber-300 text-amber-700' :
    gradeState === 'confirmed' ? 'bg-green-50 border-green-300 text-green-700' :
    'bg-white border-gray-300 text-gray-900'
  const gradeLabel =
    gradeState === 'auto'      ? 'Auto-suggested — confirm' :
    gradeState === 'confirmed' ? 'Confirmed ✓' :
    'Auto-suggested from score'

  function handleScoreChange(v: string) {
    setScore(v)
    const n = Number(v)
    if (!isNaN(n) && v !== '') {
      const suggested = suggestGrade(n, hw.gradingBands)
      setGrade(suggested || String(percentToGcseGrade(Math.round((n / maxScore) * 100))))
    }
  }

  // FIX 3: try/catch, validate with user-visible error, router.refresh()
  function handleSave() {
    const n = Number(score)
    if (isNaN(n) || n < 0 || n > maxScore) {
      setError(`Score must be between 0 and ${maxScore}`)
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await markSubmission(data.id, {
          teacherScore: n,
          feedback,
          grade: grade || undefined,
        })
        setSaved(true)
        router.refresh()
        if (data.nav.next) {
          setTimeout(() => {
            router.push(`/homework/${homeworkId}/mark/${data.nav.next}`)
          }, 1200)
        }
      } catch {
        setError('Failed to save. Please try again.')
      }
    })
  }

  // One-click approval of AI suggested mark — autoScore is raw; handle legacy percentage values
  function handleApprove() {
    const autoScore    = (data as any).autoScore ?? 0
    const autoFeedback = (data as any).autoFeedback ?? ''
    const isLegacyPct  = autoScore > maxScore && maxScore <= 20
    const gradeNum     = isLegacyPct ? Math.round((autoScore / 100) * maxScore) : autoScore
    const pctForGrade  = isLegacyPct ? autoScore : Math.round((autoScore / maxScore) * 100)
    const gradeStr     = suggestGrade(gradeNum, hw.gradingBands) ||
      String(percentToGcseGrade(pctForGrade))
    setError(null)
    startTransition(async () => {
      try {
        await markSubmission(data.id, {
          teacherScore: gradeNum,
          feedback:     autoFeedback,
          grade:        gradeStr || undefined,
        })
        setSaved(true)
        router.refresh()
        if (data.nav.next) {
          setTimeout(() => {
            router.push(`/homework/${homeworkId}/mark/${data.nav.next}`)
          }, 1200)
        }
      } catch {
        setError('Failed to save. Please try again.')
      }
    })
  }

  const pct       = score !== '' && !isNaN(Number(score)) ? (Number(score) / maxScore) * 100 : 0
  const barColour = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'

  const hwStrats = data.plan?.strategies.filter(
    s => s.appliesTo === StrategyAppliesTo.HOMEWORK || s.appliesTo === StrategyAppliesTo.BOTH
  ) ?? []
  const classStrats = data.plan?.strategies.filter(
    s => s.appliesTo === StrategyAppliesTo.CLASSROOM || s.appliesTo === StrategyAppliesTo.BOTH
  ) ?? []

  // Display helper for previously-returned score (may be percentage or raw)
  const displayFinalScore = (() => {
    const raw = data.finalScore
    if (raw == null) return null
    if (raw > maxScore && maxScore <= 20) {
      return `${raw}% (Grade ${percentToGcseGrade(raw)})`
    }
    return `${raw} / ${maxScore}`
  })()

  return (
    <div className="flex h-full min-h-0">

      {/* ── Left: submission content ─────────────────────────────────────── */}
      <div className="flex-1 overflow-auto border-r border-gray-100">
        <div className="max-w-2xl mx-auto px-8 py-7 space-y-5">

          {/* Student + submission meta */}
          <div className="flex items-start gap-3">
            <StudentAvatar
              firstName={data.student.firstName}
              lastName={data.student.lastName}
              avatarUrl={data.student.avatarUrl}
              size="md"
              userId={data.student.id}
            />
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
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] text-gray-400">
                  {hw.class?.name}
                  {' · '}Submitted {new Date(data.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' at '}
                  {new Date(data.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  {isReturned && data.markedAt &&
                    new Date(data.markedAt) >= new Date(data.submittedAt) && (
                    <span className="text-green-600">
                      {' · '}Returned {new Date(data.markedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {data.status === 'MARKED' && (
                    <span className="text-amber-600">{' · '}Awaiting review</span>
                  )}
                </p>
                <Link
                  href="/messages"
                  className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline"
                  title="Message student"
                >
                  <Icon name="chat" size="sm" /> Message
                </Link>
              </div>
            </div>
          </div>

          {/* FIX 2: AI Suggested Mark — prominent section with Approve button */}
          {isAutoMarkedPending && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
                <Icon name="smart_toy" size="sm" className="text-amber-600 shrink-0" />
                <span className="text-sm font-semibold text-amber-800">AI Suggested Mark</span>
                <span className="ml-auto text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">Auto-marked</span>
              </div>
              <div className="px-4 py-3 space-y-2">
                {(data as any).autoScore != null && (() => {
                  const as_ = (data as any).autoScore
                  const isLegacyPct = as_ > maxScore && maxScore <= 20
                  const rawScore = isLegacyPct ? Math.round((as_ / 100) * maxScore) : as_
                  const pct = isLegacyPct ? as_ : Math.round((as_ / maxScore) * 100)
                  return (
                    <p className="text-sm text-amber-900">
                      AI score: <strong>{gcseGradeLabel(percentToGcseGrade(pct))}</strong>
                    </p>
                  )
                })()}
                {(data as any).autoFeedback && (
                  <p className="text-xs text-amber-800 leading-relaxed">
                    {(data as any).autoFeedback}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={handleApprove}
                    disabled={isPending}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors"
                  >
                    {isPending
                      ? <Icon name="refresh" size="sm" className="animate-spin" />
                      : <Icon name="check_circle" size="sm" />
                    }
                    Approve &amp; Return
                  </button>
                  <p className="flex items-center text-[11px] text-amber-700">
                    or edit score &amp; feedback in the panel →
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SEND support notice */}
          {data.plan && (hwStrats.length > 0 || classStrats.length > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="warning" size="sm" className="text-amber-600 shrink-0" />
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
              <Icon name="menu_book" size="sm" className="text-gray-400" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Instructions</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5 text-[13px] text-gray-600 leading-relaxed whitespace-pre-wrap">
              {hw.instructions}
            </div>
          </div>

          {/* Student submission */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Student&apos;s Submission</p>
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap min-h-[160px]">
              {data.content || <span className="text-gray-400 italic">No answer recorded</span>}
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
                  <Icon name="track_changes" size="sm" className="text-gray-500" />
                  <span className="text-[12px] font-semibold text-gray-700">Model Answer</span>
                </div>
                {showModelAnswer ? <Icon name="expand_less" size="sm" className="text-gray-400" /> : <Icon name="expand_more" size="sm" className="text-gray-400" />}
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
                {showBands ? <Icon name="expand_less" size="sm" className="text-gray-400" /> : <Icon name="expand_more" size="sm" className="text-gray-400" />}
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
                {isAutoMarkedPending && (
                  <span className="ml-1.5 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium normal-case tracking-normal">AI suggested</span>
                )}
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
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-2">Grade (GCSE 1–9)</label>
              <input
                type="text"
                value={grade}
                onChange={e => setGrade(e.target.value)}
                className={`w-24 border rounded-xl px-3 py-2.5 text-[16px] font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${gradeBoxClass}`}
                placeholder="—"
              />
              <p className={`text-[10px] mt-1 ${
                gradeState === 'auto'      ? 'text-amber-600' :
                gradeState === 'confirmed' ? 'text-green-600' :
                'text-gray-400'
              }`}>{gradeLabel}</p>
            </div>

            {/* Feedback */}
            <div className="mb-5">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-2">
                Feedback to Student
                {isAutoMarkedPending && (
                  <span className="ml-1.5 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium normal-case tracking-normal">AI pre-filled</span>
                )}
              </label>
              <textarea
                rows={8}
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-3 text-[13px] text-gray-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white"
                placeholder="Write constructive feedback for the student…"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-[12px] text-rose-600 font-medium mb-3">{error}</p>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={handleSave}
                disabled={isPending || score === ''}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-3 rounded-xl text-[13px] font-semibold transition-colors"
              >
                {isPending
                  ? <><Icon name="refresh" size="sm" className="animate-spin" /> Saving…</>
                  : saved
                    ? <><Icon name="check_circle" size="sm" /> {data.nav.next ? 'Saved — moving on…' : 'Returned to student'}</>
                    : isAutoMarkedPending
                    ? 'Confirm & Return to Student'
                    : isAlreadyMarked ? 'Update & Return' : 'Mark & Return'
                }
              </button>

              {saved && !isPending && (
                <p className="text-[11px] text-green-600 text-center font-medium">
                  <Icon name="check_circle" size="sm" className="inline mr-1" />
                  {data.nav.next ? 'Moving to next student…' : 'All done!'}
                </p>
              )}
            </div>
          </div>

          {/* Previously returned info */}
          {isReturned && (
            <div className="border-t border-gray-200 pt-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Previously Returned</p>
              <div className="space-y-1 text-[12px] text-gray-500">
                {data.finalScore != null && (
                  <p>Score: <span className="font-semibold text-gray-700">{displayFinalScore}</span></p>
                )}
                {data.grade && <p>Grade: <span className="font-bold text-green-700">{data.grade}</span></p>}
                {data.markedAt && new Date(data.markedAt) >= new Date(data.submittedAt) && (
                  <p>Returned: {new Date(data.markedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  )
}
