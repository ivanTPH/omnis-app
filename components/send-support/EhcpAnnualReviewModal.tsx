'use client'

import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import type { EhcpAnnualReviewRow } from '@/app/actions/ehcp'
import { conductAnnualReview } from '@/app/actions/ehcp'

const PROGRESS_OPTIONS = [
  { value: 'GOOD_PROGRESS',    label: 'Good Progress',        colour: 'border-green-300 bg-green-50 text-green-800' },
  { value: 'SOME_PROGRESS',    label: 'Some Progress',        colour: 'border-blue-300 bg-blue-50 text-blue-800' },
  { value: 'INSUFFICIENT',     label: 'Insufficient Progress', colour: 'border-amber-300 bg-amber-50 text-amber-800' },
  { value: 'NO_PROGRESS',      label: 'No Progress Made',     colour: 'border-red-300 bg-red-50 text-red-800' },
]

function today() {
  return new Date().toISOString().split('T')[0]
}

function oneYearFromNow() {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().split('T')[0]
}

type Props = {
  ehcpId: string
  studentName: string
  onClose: () => void
  onCompleted: (review: EhcpAnnualReviewRow) => void
}

export default function EhcpAnnualReviewModal({ ehcpId, studentName, onClose, onCompleted }: Props) {
  const [reviewDate,       setReviewDate]       = useState(today())
  const [summary,          setSummary]          = useState('')
  const [progressRating,   setProgressRating]   = useState('')
  const [parentComments,   setParentComments]   = useState('')
  const [amendmentsNeeded, setAmendmentsNeeded] = useState(false)
  const [newReviewDate,    setNewReviewDate]    = useState(oneYearFromNow())
  const [laNotified,       setLaNotified]       = useState(false)
  const [error,            setError]            = useState<string | null>(null)
  const [pending,          start]               = useTransition()

  const canSubmit = summary.trim().length >= 20 && progressRating !== '' && newReviewDate !== ''

  function handleSubmit() {
    if (!canSubmit) return
    setError(null)
    start(async () => {
      try {
        const review = await conductAnnualReview(ehcpId, {
          reviewDate:       new Date(reviewDate),
          summary:          summary.trim(),
          progressRating,
          parentComments:   parentComments.trim(),
          amendmentsNeeded,
          newReviewDate:    new Date(newReviewDate),
          laNotified,
        })
        onCompleted(review)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save review')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-label="EHCP annual review" className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Icon name="rate_review" size="md" className="text-purple-600" />
            <div>
              <h2 className="text-[14px] font-bold text-gray-900">Conduct Annual Review</h2>
              <p className="text-[11px] text-gray-500">{studentName}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-700">
            <Icon name="close" size="sm" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Review date */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Review meeting date
            </label>
            <input
              type="date"
              value={reviewDate}
              onChange={e => setReviewDate(e.target.value)}
              max={today()}
              className="border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>

          {/* Progress rating */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Overall progress rating <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PROGRESS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProgressRating(opt.value)}
                  className={`text-left px-3 py-2.5 rounded-xl border-2 text-[12px] font-semibold transition-all ${
                    progressRating === opt.value
                      ? opt.colour + ' ring-2 ring-offset-1 ring-purple-400'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Review summary */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Review summary <span className="text-red-500">*</span>
              <span className="font-normal text-gray-400 ml-1">(min. 20 characters)</span>
            </label>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={5}
              placeholder="Summarise progress against each EHCP outcome. Reference specific evidence where available. Note any provision changes recommended…"
              className="w-full px-3 py-2.5 text-[13px] border border-gray-200 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <p className="text-[10px] text-gray-400 mt-1">{summary.length} characters</p>
          </div>

          {/* Parent / carer comments */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Parent / carer comments
            </label>
            <textarea
              value={parentComments}
              onChange={e => setParentComments(e.target.value)}
              rows={3}
              placeholder="Views expressed by parent or carer at the review meeting…"
              className="w-full px-3 py-2.5 text-[13px] border border-gray-200 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>

          {/* New review date */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Next review date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={newReviewDate}
              onChange={e => setNewReviewDate(e.target.value)}
              min={today()}
              className="border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <p className="text-[11px] text-gray-400 mt-1">This will update the EHCP plan&apos;s review date.</p>
          </div>

          {/* Checkboxes */}
          <div className="space-y-2.5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={amendmentsNeeded}
                onChange={e => setAmendmentsNeeded(e.target.checked)}
                className="mt-0.5 accent-purple-600 w-4 h-4 shrink-0"
              />
              <span className="text-[13px] text-gray-700">
                Amendments to the EHCP are recommended following this review
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={laNotified}
                onChange={e => setLaNotified(e.target.checked)}
                className="mt-0.5 accent-purple-600 w-4 h-4 shrink-0"
              />
              <span className="text-[13px] text-gray-700">
                Local Authority has been notified of this annual review
              </span>
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
              <Icon name="error" size="sm" className="text-rose-600 shrink-0 mt-0.5" />
              <p className="text-[12px] text-rose-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[12px] text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || pending}
            className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-50"
          >
            <Icon name="verified_user" size="sm" />
            {pending ? 'Saving…' : 'Complete Annual Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
