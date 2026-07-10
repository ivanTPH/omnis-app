'use client'

import { useState, useTransition } from 'react'
import OmnisLogo from '@/components/ui/OmnisLogo'
import Icon from '@/components/ui/Icon'
import { acceptTerms } from '@/app/actions/accept-terms'

// ── Parent: Platform Terms of Use & Data Notice ──────────────────────────────
function ParentTerms() {
  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Icon name="info" size="sm" className="text-blue-600 shrink-0 mt-0.5" />
        <p className="text-blue-800 text-[13px]">
          Before viewing your child&apos;s information, please read and accept these terms.
          Your school is the Data Controller for all pupil data.
        </p>
      </div>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">1. Your Access</h2>
        <p>You are accessing a school information system as a parent or carer of a registered pupil.
        Access is granted by your child&apos;s school and may be revoked at any time. You must not
        share your login credentials or allow anyone else to access the platform using your account.</p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">2. Information You Can See</h2>
        <p>You may view homework, grades, attendance, behaviour records, and communications relating
        to your child only. This information is provided for educational purposes. You must not
        screenshot, copy, or share this information publicly or with third parties.</p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">3. Your Personal Data</h2>
        <p>Your name, email address, and any messages you send are held by your child&apos;s school
        as Data Controller under UK GDPR. Omnis Education Ltd acts as Data Processor. You have the
        right to request access to, correction of, or deletion of your personal data — contact your
        school&apos;s Data Protection Officer.</p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">4. Communications</h2>
        <p>Messages sent through Omnis are logged and may be reviewed by school staff. This is a
        school communication tool. Do not use it to send inappropriate, abusive, or threatening
        content — this may result in access being revoked and may be reported to the appropriate
        authorities.</p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">5. Session Security</h2>
        <p>Your session expires automatically after 4 hours. You will be warned after 25 minutes of
        inactivity. Always log out when finished, particularly on a shared or public device.
        You are responsible for maintaining the confidentiality of your account.</p>
      </section>
    </>
  )
}

// ── Student: Acceptable Use Policy ───────────────────────────────────────────
function StudentAup() {
  return (
    <>
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex gap-3">
        <Icon name="school" size="sm" className="text-indigo-600 shrink-0 mt-0.5" />
        <p className="text-indigo-800 text-[13px]">
          Before accessing your school resources, please read and accept the Acceptable Use Policy.
          This applies to all use of Omnis during your time at this school.
        </p>
      </div>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">1. Responsible Use</h2>
        <p>You must use Omnis only for school-related learning purposes. Do not attempt to access
        other students&apos; accounts, work, or grades. Any attempt to misuse the system or gain
        unauthorised access may result in disciplinary action.</p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">2. Academic Integrity</h2>
        <p>Work you submit must be your own. Submitting work that is not yours, or AI-generated
        content presented as your own work without acknowledgement, may be treated as academic
        misconduct under your school&apos;s integrity policy.</p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">3. Your Privacy</h2>
        <p>Your homework, grades, and learning profile are visible to your teachers and relevant
        school staff. They are not visible to other students. Special educational needs (SEN)
        information is only visible to authorised staff. Your school is the Data Controller for
        your personal data.</p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">4. Communication</h2>
        <p>Any messages you send through Omnis are monitored by school staff. Do not use the
        platform to send messages that are inappropriate, offensive, or that you would not be
        comfortable a teacher seeing. Misuse of messaging may result in your access being restricted.</p>
      </section>

      <section>
        <h2 className="font-semibold text-gray-900 mb-2">5. Session Security</h2>
        <p>Always log out when you finish using Omnis, especially on a school or shared computer.
        Do not share your password with anyone, including friends. Your session will expire
        automatically after 4 hours of activity.</p>
      </section>
    </>
  )
}

// ── Main client component ─────────────────────────────────────────────────────
export default function AcceptTermsClient({ role }: { role: string }) {
  const [, startTransition] = useTransition()
  const [accepted, setAccepted] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const isParent  = role === 'PARENT'

  const title      = isParent ? 'Platform Terms of Use & Data Notice'
                              : 'Acceptable Use Policy'
  const subtitle   = isParent ? "Required before viewing your child's information"
                              : 'Required before accessing school resources'
  const checkLabel = isParent
    ? 'I have read and understood the above. I accept the Platform Terms of Use and acknowledge how my personal data is used.'
    : 'I have read and understood the Acceptable Use Policy and agree to use Omnis responsibly.'

  function handleAccept() {
    if (!accepted) return
    setSaving(true)
    startTransition(async () => {
      try {
        await acceptTerms()
        window.location.href = '/'
      } catch (e) {
        setError((e as Error).message ?? 'Failed to save — please try again.')
        setSaving(false)
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start sm:items-center justify-center p-4 sm:py-8">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col"
           style={{ maxHeight: 'calc(100dvh - 2rem)' }}>

        {/* Header — never scrolls away */}
        <div className="px-5 sm:px-8 pt-6 pb-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <OmnisLogo variant="sidebar" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>

        {/* Body — scrollable */}
        <div className="px-5 sm:px-8 py-5 space-y-5 text-sm text-gray-700 overflow-y-auto flex-1">
          {isParent ? <ParentTerms /> : <StudentAup />}
        </div>

        {/* Footer — always visible */}
        <div className="px-5 sm:px-8 py-5 border-t border-gray-100 space-y-4 shrink-0">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
            />
            <span className="text-sm text-gray-700">{checkLabel}</span>
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
              : <><Icon name="check_circle" size="sm" />Accept and Continue</>
            }
          </button>
        </div>

      </div>
    </div>
  )
}
