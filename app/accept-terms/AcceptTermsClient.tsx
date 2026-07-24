'use client'

import { useState, useTransition } from 'react'
import OmnisLogo from '@/components/ui/OmnisLogo'
import Icon from '@/components/ui/Icon'
import { acceptTerms } from '@/app/actions/accept-terms'
import PolicyConsentPanel, { type ConsentItem } from '@/components/consent/PolicyConsentPanel'

// ── Policy content for modals ─────────────────────────────────────────────────

function PlatformTermsPolicy() {
  return (
    <>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Your Access</h3>
        <p>You are accessing a school information system as a parent or carer of a registered
        pupil. Access is granted by your child&apos;s school and may be revoked at any time.
        You must not share your login credentials or allow anyone else to access the platform
        using your account.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Information You Can See</h3>
        <p>You may view homework, grades, attendance, behaviour records, and communications
        relating to your child only. This information is provided for educational purposes.
        You must not screenshot, copy, or share this information publicly or with third parties.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Communications</h3>
        <p>Messages sent through Omnis are logged and may be reviewed by school staff. This is a
        school communication tool. Do not use it to send inappropriate, abusive, or threatening
        content — this may result in access being revoked and may be reported to the
        appropriate authorities.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Session Security</h3>
        <p>Your session expires automatically after 4 hours. You will be warned after 25 minutes
        of inactivity. Always log out when finished, particularly on a shared or public device.</p>
      </section>
    </>
  )
}

function ParentPrivacyPolicy() {
  return (
    <>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Data Controller</h3>
        <p>Your child&apos;s school is the Data Controller for all pupil data held within Omnis.
        Omnis Education Ltd acts as Data Processor. Your personal data — name, email, and any
        messages you send — is held by the school under UK GDPR.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">What We Collect</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your name and contact email address (provided by the school)</li>
          <li>Your login activity and session timestamps</li>
          <li>Messages you send via the platform</li>
          <li>Consent records (this acknowledgement)</li>
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Your Rights</h3>
        <p>You have the right to request access to, correction of, or deletion of your personal
        data. Contact your child&apos;s school&apos;s Data Protection Officer. The school is
        required to respond within one calendar month.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Retention</h3>
        <p>Parent contact data is retained for 7 years after your child leaves the school, or
        in line with your school&apos;s published retention schedule.</p>
      </section>
    </>
  )
}

function StudentAupPolicy() {
  return (
    <>
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex gap-3">
        <Icon name="school" size="sm" className="text-indigo-600 shrink-0 mt-0.5" />
        <p className="text-indigo-800 text-[13px]">
          This Acceptable Use Policy applies to all use of Omnis during your time at this school.
        </p>
      </div>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Responsible Use</h3>
        <p>You must use Omnis only for school-related learning purposes. Do not attempt to access
        other students&apos; accounts, work, or grades. Any attempt to misuse the system or gain
        unauthorised access may result in disciplinary action.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Academic Integrity</h3>
        <p>Work you submit must be your own. Submitting work that is not yours, or AI-generated
        content presented as your own work without acknowledgement, may be treated as academic
        misconduct under your school&apos;s integrity policy.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Communication</h3>
        <p>Any messages you send through Omnis are monitored by school staff. Do not use the
        platform to send messages that are inappropriate or offensive. Misuse of messaging may
        result in your access being restricted.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Session Security</h3>
        <p>Always log out when you finish using Omnis, especially on a school or shared computer.
        Do not share your password with anyone. Your session will expire automatically after
        4 hours.</p>
      </section>
    </>
  )
}

function OutcomeBenchmarkingPolicy() {
  return (
    <>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">What this covers</h3>
        <p>Omnis may use your child&apos;s anonymised prior attainment (e.g. KS2 SATs scores or
        CATs results, if held by the school) alongside their homework grades on the platform to
        compute an individual uplift metric — the difference between predicted and actual
        attainment. This helps schools and the platform operator understand how well pupils
        are progressing relative to their starting points.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">How your child&apos;s data is used</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Scores are aggregated across a school year group before any analysis is performed.</li>
          <li>Individual pupil results are never disclosed outside the school.</li>
          <li>Results from cohorts of fewer than 10 consented students are suppressed entirely.</li>
          <li>Aggregated, anonymised signals from multiple schools may be used to produce
              network-level benchmarks published in Omnis research materials.</li>
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Lawful basis</h3>
        <p>Processing is based on your freely given consent under UK GDPR Article 6(1)(a).
        You may withdraw consent at any time by contacting your school&apos;s Data Protection
        Officer. Withdrawal does not affect the lawfulness of processing before withdrawal.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">This is optional</h3>
        <p>Declining this item will not affect your child&apos;s access to any feature of Omnis,
        or your own access as a parent. It is entirely separate from the required platform
        terms above.</p>
      </section>
    </>
  )
}

function StudentPrivacyPolicy() {
  return (
    <>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">What Your School Sees</h3>
        <p>Your homework, grades, and learning profile are visible to your teachers and relevant
        school staff. They are not visible to other students. Special educational needs (SEN)
        information is only visible to authorised staff with a professional reason to access it.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Data Controller</h3>
        <p>Your school is the Data Controller for your personal data. Omnis Education Ltd acts
        as Data Processor. Your data is held under UK GDPR and the UK Data Protection Act 2018.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">AI Features</h3>
        <p>Some features use AI assistance (Claude by Anthropic) to provide personalised
        feedback and learning suggestions. AI outputs are always reviewed by your teachers
        before being acted upon.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Your Rights</h3>
        <p>You have the right to see what personal data your school holds about you. Ask your
        school&apos;s Data Protection Officer or a trusted adult to help you make a Subject
        Access Request if you would like a copy.</p>
      </section>
    </>
  )
}

// ── Consent items per role ────────────────────────────────────────────────────

const PARENT_ITEMS: ConsentItem[] = [
  {
    id:           'platform-terms',
    label:        "I accept the Platform Terms of Use and understand that access is granted by my child's school and may be revoked at any time.",
    policyTitle:  'Platform Terms of Use',
    policyContent: <PlatformTermsPolicy />,
  },
  {
    id:           'privacy-notice',
    label:        "I have read the Privacy Notice and understand how my personal data and my child's information is processed by the school and Omnis.",
    policyTitle:  'Privacy Notice',
    policyContent: <ParentPrivacyPolicy />,
  },
  {
    id:           'outcome-benchmarking',
    label:        "I agree to my child's anonymised attainment data being used for outcome benchmarking across the Omnis network. (Optional — you can continue without ticking this.)",
    policyTitle:  'Outcome Benchmarking — Optional Consent',
    policyContent: <OutcomeBenchmarkingPolicy />,
    required:     false,
  },
]

const STUDENT_ITEMS: ConsentItem[] = [
  {
    id:           'aup',
    label:        'I agree to the Acceptable Use Policy. I will use Omnis responsibly for school purposes only and submit only my own work.',
    policyTitle:  'Acceptable Use Policy',
    policyContent: <StudentAupPolicy />,
  },
  {
    id:           'privacy-notice',
    label:        'I have read the Privacy Notice and understand how my learning data is used by my school.',
    policyTitle:  'Student Privacy Notice',
    policyContent: <StudentPrivacyPolicy />,
  },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function AcceptTermsClient({ role }: { role: string }) {
  const [, startTransition] = useTransition()
  const isParent = role === 'PARENT'
  const items    = isParent ? PARENT_ITEMS : STUDENT_ITEMS

  const [checked,   setChecked]   = useState<Record<string, boolean>>({})
  const [attempted, setAttempted] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const allRequired  = items.every(i => i.required === false || !!checked[i.id])
  const acceptedCount = Object.values(checked).filter(Boolean).length

  const title    = isParent ? 'Platform Terms & Privacy Notice'    : 'Acceptable Use Policy'
  const subtitle = isParent ? "Required before viewing your child's information" : 'Required before accessing school resources'

  function handleChange(id: string, val: boolean) {
    setChecked(prev => ({ ...prev, [id]: val }))
  }

  function handleSubmit() {
    setAttempted(true)
    if (!allRequired) return
    setSaving(true)
    startTransition(async () => {
      try {
        const acceptedIds = Object.entries(checked).filter(([, v]) => v).map(([k]) => k)
        await acceptTerms(acceptedIds)
        window.location.href = '/'
      } catch (e) {
        setError((e as Error).message ?? 'Failed to save — please try again.')
        setSaving(false)
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start sm:items-center justify-center p-4 sm:py-8">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: 'calc(100dvh - 2rem)' }}
      >
        {/* Header */}
        <div className="px-5 sm:px-8 pt-6 pb-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <OmnisLogo variant="sidebar" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          {/* Progress bar */}
          <div className="mt-4 flex items-center gap-2">
            {items.map(item => (
              <div
                key={item.id}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  checked[item.id] ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            ))}
            <span className="text-[11px] text-gray-400 shrink-0">
              {acceptedCount}/{items.length} accepted
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-8 py-5 overflow-y-auto flex-1">
          <p className="text-[13px] text-gray-500 mb-4">
            Please read and accept each policy. Click{' '}
            <span className="text-indigo-600 font-medium">View full policy →</span>{' '}
            to read the complete text before ticking the box.
          </p>
          <PolicyConsentPanel
            items={items}
            checked={checked}
            onChange={handleChange}
            attempted={attempted}
          />
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-8 py-5 border-t border-gray-100 shrink-0 space-y-3">
          {attempted && !allRequired && (
            <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <Icon name="error" size="sm" className="shrink-0" />
              <p className="text-[12px] font-medium">
                You cannot continue until all required policies have been accepted.
              </p>
            </div>
          )}
          {error && (
            <p className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-3 min-h-[44px] rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving
              ? <><Icon name="refresh" size="sm" className="animate-spin" />Saving…</>
              : <><Icon name="check_circle" size="sm" />Accept and Continue</>
            }
          </button>
          <p className="text-[11px] text-center text-gray-400">
            Your acceptance is recorded with a timestamp.
          </p>
        </div>
      </div>
    </div>
  )
}
