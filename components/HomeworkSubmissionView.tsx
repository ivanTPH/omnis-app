'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitHomework } from '@/app/actions/student'
import Icon from '@/components/ui/Icon'
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
}

export default function HomeworkSubmissionView({ hw }: { hw: HwData }) {
  const router  = useRouter()
  const [content, setContent]   = useState(hw.submission?.content ?? '')
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted]    = useState(false)

  const sub        = hw.submission
  const status     = sub?.status
  const isReturned = status === 'RETURNED'
  const isAwaitingFeedback = !!sub && !isReturned

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length

  function handleSubmit() {
    startTransition(async () => {
      await submitHomework(hw.id, content)
      setSubmitted(true)
      router.refresh()
    })
  }

  // Can resubmit if: returned AND maxAttempts allows it
  const canResubmit = isReturned && hw.maxAttempts > 1
  const textareaDisabled = (isAwaitingFeedback && !submitted) || isPending

  return (
    <div className="max-w-3xl mx-auto px-8 py-8 space-y-6">

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
            {sub!.finalScore != null && (
              <span className="text-[14px] font-semibold text-green-700">{sub!.finalScore} pts</span>
            )}
            {sub!.grade && (
              <span className="text-[22px] font-bold text-green-700 bg-green-100 px-4 py-1 rounded-xl">
                {sub!.grade}
              </span>
            )}
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

      {/* Model answer */}
      {isReturned && hw.modelAnswer && (
        <section>
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Icon name="star" size="sm" /> Model Answer
          </h2>
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-5 text-[14px] text-purple-900 leading-relaxed whitespace-pre-wrap">
            {hw.modelAnswer}
          </div>
        </section>
      )}

      {/* Answer section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            {isReturned ? 'Your Answer' : isAwaitingFeedback ? 'Your Submission' : 'Your Answer'}
          </h2>
          {!isAwaitingFeedback && !hw.homeworkVariantType && (
            <span className="text-[11px] text-gray-400">
              {wordCount} word{wordCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {hw.homeworkVariantType && hw.structuredContent ? (
          <HomeworkTypeRenderer
            type={hw.homeworkVariantType}
            structuredContent={hw.structuredContent}
            value={content}
            onChange={setContent}
            disabled={textareaDisabled}
            showScaffold={(hw.sendStatus ?? 'NONE') !== 'NONE'}
          />
        ) : (
          <textarea
            className="w-full min-h-[220px] border border-gray-200 rounded-xl p-4 text-[14px] text-gray-800 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed transition"
            placeholder="Write your answer here..."
            value={content}
            onChange={e => setContent(e.target.value)}
            disabled={textareaDisabled}
          />
        )}
      </section>

      {/* Submit / resubmit */}
      {(!sub || canResubmit) && !submitted && (
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
            className="px-5 py-2.5 bg-blue-600 text-white text-[14px] font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isPending ? 'Submitting…' : canResubmit ? 'Resubmit' : 'Submit'}
          </button>
        </div>
      )}

    </div>
  )
}
