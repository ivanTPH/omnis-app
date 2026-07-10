'use client'

import { useState, useTransition } from 'react'
import OmnisLogo from '@/components/ui/OmnisLogo'
import Icon from '@/components/ui/Icon'
import { acceptDpa } from '@/app/actions/accept-dpa'

export default function AcceptDpaPage() {
  const [, startTransition] = useTransition()
  const [accepted, setAccepted] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  function handleAccept() {
    if (!accepted) return
    setSaving(true)
    startTransition(async () => {
      try {
        await acceptDpa()
        window.location.href = '/'
      } catch (e) {
        setError((e as Error).message ?? 'Failed to save acknowledgement')
        setSaving(false)
      }
    })
  }

  return (
    /* Outer: full-screen, scrollable on tiny devices, centers on large screens */
    <div className="min-h-screen bg-gray-50 flex items-start sm:items-center justify-center p-4 sm:py-8">
      {/*
        Card: flex column + max-h keeps it within viewport so footer is always visible.
        On very small screens the card is capped at (viewport - 2rem padding).
      */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col"
           style={{ maxHeight: 'calc(100dvh - 2rem)' }}>

        {/* Header — never scrolls away */}
        <div className="px-5 sm:px-8 pt-6 pb-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <OmnisLogo variant="sidebar" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Data Processing Acknowledgement</h1>
          <p className="text-sm text-gray-500 mt-1">
            Required before accessing pupil data — UK GDPR Article 9 (Special Category)
          </p>
        </div>

        {/* Body — scrollable, takes remaining space */}
        <div className="px-5 sm:px-8 py-5 space-y-5 text-sm text-gray-700 overflow-y-auto flex-1">

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <Icon name="warning" size="sm" className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-amber-800 text-[13px]">
              Omnis processes Special Category personal data (SEND records, health information,
              and other sensitive pupil data) under UK GDPR Article 9(2)(g) — substantial public
              interest. You must read and acknowledge the following before accessing any pupil data.
            </p>
          </div>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">1. Data Controller</h2>
            <p>Your school is the Data Controller for all pupil data held within Omnis. Omnis Education Ltd
            acts as a Data Processor under a Data Processing Agreement (DPA) with your school.
            Anthropic (Claude AI) acts as a sub-processor for AI-assisted features; all AI processing
            uses pseudonymised identifiers where possible.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">2. Your Obligations as a Staff Member</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access only pupil data that is necessary for your professional role (data minimisation).</li>
              <li>Do not share pupil data outside authorised staff members or external agencies with a lawful basis.</li>
              <li>Report any suspected data breach immediately to your school&apos;s Data Protection Officer.</li>
              <li>Do not use screenshots, exports, or copies of pupil data except where explicitly authorised.</li>
              <li>Ensure your device is locked when unattended and that you log out of Omnis when finished.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">3. Audit and Access Logging</h2>
            <p>All access to Special Category data (SEND records, safeguarding records, health information)
            is logged and may be audited. Logs are retained for 7 years in line with DfE guidance.
            You consent to this monitoring as a condition of accessing the system.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">4. AI Processing</h2>
            <p>Certain features use AI assistance (Claude by Anthropic). AI-generated content relating
            to pupils (ILP goals, homework feedback, SEND insights) is always subject to professional
            review before being acted upon. AI outputs are not a substitute for qualified professional
            judgement. Anthropic processes data under a Data Processing Agreement and does not train
            models on your school&apos;s data.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">5. Retention and Deletion</h2>
            <p>Pupil data is retained in line with your school&apos;s retention schedule (typically 7 years
            post-leaving for most records; 25 years for child protection records). You may submit a
            Subject Access Request or erasure request on behalf of a data subject to your school&apos;s DPO.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">6. Session Security</h2>
            <p>Your Omnis session will automatically expire after 4 hours, and will warn you after
            25 minutes of inactivity. You are responsible for ensuring your session is terminated
            when your device is unattended.</p>
          </section>

        </div>

        {/* Footer — always visible at bottom, never scrolls off screen */}
        <div className="px-5 sm:px-8 py-5 border-t border-gray-100 space-y-4 shrink-0">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
            />
            <span className="text-sm text-gray-700">
              I have read and understood the above. I acknowledge my obligations regarding pupil data
              under UK GDPR and will comply with my school&apos;s data protection policies.
            </span>
          </label>

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={handleAccept}
            disabled={!accepted || saving}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving
              ? <><Icon name="refresh" size="sm" className="animate-spin" />Saving…</>
              : <><Icon name="check_circle" size="sm" />Acknowledge and Continue</>
            }
          </button>
        </div>

      </div>
    </div>
  )
}
