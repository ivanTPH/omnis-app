'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

const DISMISS_KEY = 'omnis-exam-board-banner-dismissed'

/**
 * Dismissible amber banner shown on the admin dashboard when one or more Year 10+
 * subjects have a class with no exam board set. AI homework generation and marking
 * fall back to board-agnostic conventions without this — see /admin/subjects.
 *
 * Dismissal is per-browser (localStorage) and keyed to the current subject list, so
 * it resurfaces automatically if a *new* subject goes missing its board later.
 */
export default function ExamBoardBanner({ subjects }: { subjects: string[] }) {
  const [dismissed, setDismissed] = useState(true) // default hidden until we've checked storage

  const dismissKeyValue = subjects.slice().sort().join('|')

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === dismissKeyValue)
    } catch {
      setDismissed(false)
    }
  }, [dismissKeyValue])

  if (subjects.length === 0 || dismissed) return null

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, dismissKeyValue) } catch { /* best-effort */ }
    setDismissed(true)
  }

  return (
    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
      <Icon name="school" size="md" className="text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-amber-900">
          {subjects.length === 1 ? 'Exam board not set' : `Exam board not set for ${subjects.length} subjects`}
        </p>
        <p className="text-[12px] text-amber-700 mt-0.5">
          {subjects.slice(0, 4).join(', ')}{subjects.length > 4 ? `, +${subjects.length - 4} more` : ''} — GCSE/A-level
          classes without an exam board get AI-generated homework and marking that use general UK
          conventions instead of board-specific ones.
        </p>
      </div>
      <Link
        href="/admin/subjects"
        className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-medium rounded-lg transition"
      >
        Set exam boards
      </Link>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 text-amber-400 hover:text-amber-700 transition"
        aria-label="Dismiss"
      >
        <Icon name="close" size="sm" />
      </button>
    </div>
  )
}
