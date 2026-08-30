'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { getChildNoticeStatus, acknowledgeChildNotice } from '@/app/actions/child-notice'

/**
 * ICO Children's Code Standard 4 (Transparency) — a bite-sized, plain-language
 * data notice for STUDENT accounts. Shown once, whenever the student first
 * lands on any page (dashboard, or a homework link they were sent directly —
 * both count as the "first login" / "first AI-generated homework" trigger
 * points named in the DPIA action item). Dismissible, never blocking, never
 * shown again once acknowledged — the timestamp is stored on User.childNoticeAckAt.
 */
export default function ChildTransparencyNotice({ role }: { role: string }) {
  const [visible, setVisible] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (role !== 'STUDENT') return
    getChildNoticeStatus()
      .then(({ acknowledged }) => { if (!acknowledged) setVisible(true) })
      .catch(() => {})
  }, [role])

  if (role !== 'STUDENT' || !visible) return null

  function dismiss() {
    setVisible(false) // instant close — don't make the student wait on the network
    startTransition(() => { acknowledgeChildNotice().catch(() => {}) })
  }

  return (
    <div
      role="dialog"
      aria-label="How Omnis uses your data"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:pb-6 flex justify-center pointer-events-none"
    >
      <div className="pointer-events-auto w-full max-w-lg bg-white border border-indigo-200 rounded-2xl shadow-xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <Icon name="shield" size="sm" className="text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-gray-900">A quick word about your data</p>
            <p className="text-[13px] text-gray-600 mt-1 leading-relaxed">
              Your school uses Omnis to set homework, track your progress, and support your learning.
              Your teachers and relevant school staff can see your work and grades — not other students.
              Some feedback and homework is created with AI help, but a teacher always checks it.
              {' '}
              <Link href="/student/privacy" className="text-indigo-600 font-medium hover:underline">
                Full details →
              </Link>
            </p>
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={dismiss}
            disabled={pending}
            aria-label="Dismiss"
            className="px-4 py-2 min-h-[36px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[13px] font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Icon name="check" size="sm" />
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
