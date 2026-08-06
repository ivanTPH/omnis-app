'use client'
import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { submitHomework } from '@/app/actions/student'
import Icon from '@/components/ui/Icon'
import { gradeLabel, percentToGcseGrade } from '@/lib/grading'
import HomeworkTypeRenderer from '@/components/homework/HomeworkTypeRenderer'

type Submission = {
  id: string
  content: string
  status: string
  grade: string | null
  feedback: string | null
  finalScore: number | null
  submittedAt: Date | string
  markedAt: Date | string | null
}

type HwData = {
  id: string
  instructions: string
  maxAttempts: number
  submission: Submission | null
  modelAnswer: string | null
  homeworkVariantType?: string | null
  structuredContent?: unknown
  sendStatus?: string
  classAvgScore?: number | null
  predictedGrade?: number | null
}

export default function HomeworkSubmissionView({ hw }: { hw: HwData }) {
  const router  = useRouter()
  const [content, setContent]   = useState(hw.submission?.content ?? '')
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted]    = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const sub        = hw.submission
  const status     = sub?.status
  const isReturned = status === 'RETURNED'
  const isAwaitingFeedback = !!sub && !isReturned

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length
  const draftKey  = `hw-draft-${hw.id}`
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore draft from localStorage on mount (only when no submission yet)
  useEffect(() => {
    if (sub) return
    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) setContent(saved)
    } catch { /* storage unavailable */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save draft to localStorage 500ms after the user stops typing
  function handleContentChange(val: string) {
    setContent(val)
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      try { localStorage.setItem(draftKey, val) } catch { /* ignore */ }
    }, 500)
  }

  function handleSubmit() {
    setSubmitError(null)
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    // Ensure latest draft is persisted before network request
    try { localStorage.setItem(draftKey, content) } catch { /* storage unavailable */ }
    startTransition(async () => {
      try {
        await submitHomework(hw.id, content)
        try { localStorage.removeItem(draftKey) } catch { /* ignore */ }
        setSubmitted(true)
        router.refresh()
      } catch {
        setSubmitError('Submission failed — please check your connection and try again. Your answer has been saved locally.')
      }
    })
  }

  // Can resubmit if: returned AND maxAttempts allows it
  const canResubmit = isReturned && hw.maxAttempts > 1
  const textareaDisabled = isReturned || (isAwaitingFeedback && !submitted) || isPending

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-6">

      {/* Status banner */}
      {isReturned && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <Icon name="check_circle" size="lg" className="text-green-600 shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-green-800">Marked &amp; Returned</p>
            <p className="text-[12px] text-green-600">
              {sub!.markedAt
                ? `Marked ${new Date(sub!.markedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                : 'Your work has been marked'}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {sub!.grade && (
              <span className="text-[22px] font-bold text-green-700 bg-green-100 px-4 py-1 rounded-xl">
                {gradeLabel(Number(sub!.grade))}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Grade context strip — shown when returned and grade data is available */}
      {isReturned && (sub!.grade || hw.classAvgScore != null || hw.predictedGrade != null) && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-center">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Your Grade</p>
            <p className="text-[18px] font-bold text-gray-900">
              {sub!.grade ? gradeLabel(Number(sub!.grade)) : '—'}
            </p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-center">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Class Average</p>
            <p className="text-[18px] font-bold text-gray-900">
              {hw.classAvgScore != null ? gradeLabel(percentToGcseGrade(hw.classAvgScore)) : '—'}
            </p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-center">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Predicted</p>
            <p className="text-[18px] font-bold text-gray-900">
              {hw.predictedGrade != null ? gradeLabel(hw.predictedGrade) : '—'}
            </p>
          </div>
        </div>
      )}

      {isAwaitingFeedback && !submitted && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Icon name="schedule" size="lg" className="text-amber-600 shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-amber-800">Submitted — Awaiting Feedback</p>
            <p className="text-[12px] text-amber-600">
              Submitted {new Date(sub!.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>
      )}

      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <Icon name="check_circle" size="lg" className="text-green-600 shrink-0" />
          <p className="text-[13px] font-semibold text-green-800">Submitted successfully!</p>
        </div>
      )}

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <Icon name="wifi_off" size="lg" className="text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-red-800">Submission failed</p>
            <p className="text-[12px] text-red-600">{submitError}</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="shrink-0 px-3 py-2.5 min-h-[44px] bg-red-600 text-white text-[12px] font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Instructions */}
      <section>
        <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Instructions</h2>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 text-[14px] text-gray-700 leading-relaxed whitespace-pre-wrap">
          {hw.instructions}
        </div>
      </section>

      {/* Teacher feedback */}
      {isReturned && sub!.feedback && (
        <section>
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Icon name="chat" size="sm" /> Teacher Feedback
          </h2>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-[14px] text-blue-900 leading-relaxed whitespace-pre-wrap">
            {sub!.feedback}
          </div>
        </section>
      )}

      {/* Answer section */}
      {(() => {
        const sc = hw.structuredContent as { questions?: unknown[] } | undefined
        const hasStructuredQuestions = (sc?.questions?.length ?? 0) > 0
        const STEPPER_TYPES = new Set([
          'short_answer', 'quiz', 'multiple_choice', 'retrieval_practice',
          'structured_task', 'problem_solving',
        ])
        const multiQStepper =
          !!hw.homeworkVariantType &&
          STEPPER_TYPES.has(hw.homeworkVariantType) &&
          (sc?.questions?.length ?? 0) > 1

        return (
          <>
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                  {isReturned ? 'Your Answers' : isAwaitingFeedback ? 'Your Submission' : 'Your Answer'}
                </h2>
                {!isAwaitingFeedback && !hw.homeworkVariantType && (
                  <span className="text-[11px] text-gray-400">
                    {wordCount} word{wordCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {hw.homeworkVariantType && hw.structuredContent ? (
                <>
                  <HomeworkTypeRenderer
                    type={hw.homeworkVariantType}
                    structuredContent={hw.structuredContent}
                    value={content}
                    onChange={handleContentChange}
                    disabled={textareaDisabled}
                    showModelAnswer={isReturned}
                    sendStatus={hw.sendStatus ?? 'NONE'}
                    onSubmitRequest={multiQStepper && (!sub || canResubmit) && !submitted ? handleSubmit : undefined}
                    submitting={isPending}
                  />
                  {/* Fallback: top-level model answer for older homework where q.modelAnswer is absent */}
                  {isReturned && hw.modelAnswer && (() => {
                    const qs = (sc?.questions as Array<{ modelAnswer?: string }> | undefined) ?? []
                    return !qs.some(q => q.modelAnswer)
                      ? <CollapsibleModelAnswer text={hw.modelAnswer!} className="mt-4" />
                      : null
                  })()}
                </>
              ) : (
                <>
                  <div className="w-full min-h-[220px] border border-gray-200 rounded-xl p-4 text-[14px] text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50">
                    {content || <span className="text-gray-400 italic">No answer provided</span>}
                  </div>
                  {/* Model answer for non-structured homework — collapsible below the answer */}
                  {isReturned && hw.modelAnswer && !hasStructuredQuestions && (
                    <CollapsibleModelAnswer text={hw.modelAnswer} className="mt-3" />
                  )}
                </>
              )}
            </section>

            {/* Submit / resubmit — hidden when stepper handles submit */}
            {(!sub || canResubmit) && !submitted && !multiQStepper && (
              <div className="flex items-center justify-between">
                {canResubmit && (
                  <p className="text-[12px] text-gray-400 flex items-center gap-1">
                    <Icon name="error" size="sm" />
                    You can update your answer and resubmit.
                  </p>
                )}
                {!canResubmit && <span />}
                <button
                  onClick={handleSubmit}
                  disabled={isPending || content.trim().length < 10}
                  className="px-5 py-2.5 min-h-[44px] bg-blue-600 text-white text-[14px] font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isPending ? 'Submitting…' : canResubmit ? 'Resubmit' : 'Submit'}
                </button>
              </div>
            )}

            {/* Bottom grade summary — shown after all answers when returned */}
            {isReturned && sub!.grade && (() => {
              const grade = Number(sub!.grade)
              const pred  = hw.predictedGrade ?? null
              const exceeded = pred !== null && grade > pred
              const met      = pred !== null && grade === pred
              return (
                <div className={`rounded-2xl p-5 flex items-center gap-4 border ${
                  exceeded ? 'bg-emerald-50 border-emerald-200' :
                  met      ? 'bg-blue-50 border-blue-200' :
                             'bg-gray-50 border-gray-200'
                }`}>
                  <span className="text-[36px] leading-none shrink-0">
                    {exceeded ? '🎉' : met ? '👍' : '📚'}
                  </span>
                  <div className="flex-1">
                    <p className={`text-[15px] font-bold ${exceeded ? 'text-emerald-800' : met ? 'text-blue-800' : 'text-gray-700'}`}>
                      {exceeded
                        ? `Well done! You exceeded your predicted grade.`
                        : met
                          ? `Great work! You met your predicted grade.`
                          : `Keep going — review the model answers to improve.`}
                    </p>
                    {pred !== null && (
                      <p className={`text-[13px] mt-0.5 ${exceeded ? 'text-emerald-600' : met ? 'text-blue-600' : 'text-gray-500'}`}>
                        Predicted {gradeLabel(pred)} · You achieved {gradeLabel(grade)}
                      </p>
                    )}
                  </div>
                  <span className={`text-[22px] font-bold px-4 py-1 rounded-xl shrink-0 ${
                    exceeded ? 'bg-emerald-100 text-emerald-700' :
                    met      ? 'bg-blue-100 text-blue-700' :
                               'bg-gray-200 text-gray-700'
                  }`}>
                    {gradeLabel(grade)}
                  </span>
                </div>
              )
            })()}
          </>
        )
      })()}

    </div>
  )
}

function CollapsibleModelAnswer({ text, className = '' }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`border border-purple-200 rounded-xl overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left bg-purple-50 hover:bg-purple-100 transition"
      >
        <Icon name="star" size="sm" className="text-purple-500 shrink-0" />
        <span className="text-[13px] font-semibold text-purple-700 flex-1">Model Answer</span>
        <Icon name={open ? 'expand_less' : 'expand_more'} size="sm" className="text-purple-400" />
      </button>
      {open && (
        <div className="px-4 py-3 bg-white text-[14px] text-purple-900 leading-relaxed whitespace-pre-wrap border-t border-purple-100">
          {text}
        </div>
      )}
    </div>
  )
}
