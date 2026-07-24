'use client'

import { useState, useTransition } from 'react'
import OmnisLogo from '@/components/ui/OmnisLogo'
import Icon from '@/components/ui/Icon'
import { acceptDpa } from '@/app/actions/accept-dpa'
import PolicyConsentPanel, { type ConsentItem } from '@/components/consent/PolicyConsentPanel'

// ── Full policy text rendered inside each modal ───────────────────────────────

function DataControllerPolicy() {
  return (
    <>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <Icon name="warning" size="sm" className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-amber-800 text-[13px]">
          Omnis processes Special Category personal data under UK GDPR Article 9(2)(g) —
          substantial public interest. Read the full controller/processor arrangement below.
        </p>
      </div>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Data Controller</h3>
        <p>Your school is the Data Controller for all pupil data held within Omnis. The school
        determines the purposes and means of processing pupil personal data, including Special
        Category data such as SEND records, health information, and safeguarding records.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Data Processor</h3>
        <p>Omnis Education Ltd acts as a Data Processor under a Data Processing Agreement (DPA)
        with your school. We process data only on the school&apos;s documented instructions and
        do not use pupil data for any commercial purpose.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">AI Sub-processor</h3>
        <p>Anthropic (Claude AI) acts as a sub-processor for AI-assisted features (ILP goals,
        homework feedback, SEND insights). All AI processing uses pseudonymised identifiers
        where possible. Anthropic processes data under a Data Processing Agreement and does not
        train models on your school&apos;s data.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Retention</h3>
        <p>Pupil data is retained in line with your school&apos;s retention schedule: typically
        7 years post-leaving for most records, and 25 years for child protection records.
        Subject Access Requests or erasure requests should be directed to your school&apos;s
        Data Protection Officer.</p>
      </section>
    </>
  )
}

function StaffObligationsPolicy() {
  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Icon name="info" size="sm" className="text-blue-600 shrink-0 mt-0.5" />
        <p className="text-blue-800 text-[13px]">
          As a member of staff accessing pupil data, you have the following obligations under
          UK GDPR and your school&apos;s Data Protection Policy.
        </p>
      </div>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Data Minimisation</h3>
        <p>Access only the pupil data that is necessary for your professional role. Do not browse
        records of students you do not teach or have a pastoral responsibility for.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Confidentiality</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Do not share pupil data outside authorised staff or external agencies without a lawful basis.</li>
          <li>Do not use screenshots, exports, or copies of pupil data except where explicitly authorised.</li>
          <li>Special Category data (SEND, safeguarding, health) must never be communicated via unsecured channels such as personal email.</li>
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Breach Reporting</h3>
        <p>Report any suspected personal data breach — including accidental disclosure, loss of
        device, or unauthorised access — immediately to your school&apos;s Data Protection
        Officer. The school is required to report qualifying breaches to the ICO within 72 hours.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Device &amp; Session Security</h3>
        <p>Lock your device whenever it is unattended. Log out of Omnis when you have finished.
        Do not access Omnis on public or unsecured Wi-Fi without a VPN. Your session will
        automatically expire after 4 hours and will warn you after 25 minutes of inactivity.</p>
      </section>
    </>
  )
}

function AuditAndAiPolicy() {
  return (
    <>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Access Logging</h3>
        <p>All access to Special Category data — including SEND records, safeguarding records,
        ILP/EHCP documents, and health information — is logged and attributed to your user
        account. Logs are retained for 7 years in line with DfE guidance and are available
        to your school&apos;s Data Protection Officer on request.</p>
        <p className="mt-2">By continuing, you consent to this monitoring as a condition of
        accessing Special Category data under UK GDPR Article 9.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">AI-Generated Content</h3>
        <p>Certain features use AI assistance (Claude by Anthropic). AI outputs relating to
        pupils — ILP goals, homework feedback, SEND insights, coaching recommendations — are
        always subject to professional review before being acted upon.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>AI outputs are not a substitute for qualified professional judgement.</li>
          <li>Never rely solely on AI-generated content for safeguarding or clinical decisions.</li>
          <li>AI recommendations are advisory only and may contain errors.</li>
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Audit Trail Integrity</h3>
        <p>Audit log entries are immutable — they cannot be edited or deleted. This ensures
        a trustworthy record of data access and modifications for regulatory compliance.</p>
      </section>
    </>
  )
}

const CONSENT_ITEMS: ConsentItem[] = [
  {
    id:           'data-controller',
    label:        'I accept the Platform Terms of Use and understand that my school is the Data Controller for all pupil data, with Omnis Education Ltd acting as Data Processor under a formal Data Processing Agreement.',
    policyTitle:  'Data Controller, Processor & Sub-processor Arrangement',
    policyContent: <DataControllerPolicy />,
  },
  {
    id:           'staff-obligations',
    label:        "I understand my obligations as a staff member: I will access only data necessary for my role, maintain confidentiality, report any suspected breach to my school's DPO, and keep my device and session secure.",
    policyTitle:  'Staff Data Protection Obligations',
    policyContent: <StaffObligationsPolicy />,
  },
  {
    id:           'audit-and-ai',
    label:        'I consent to access logging of Special Category data (SEND, safeguarding, health records) for GDPR compliance, and acknowledge that AI-generated content is advisory and requires professional review.',
    policyTitle:  'Audit Logging & AI Processing Notice',
    policyContent: <AuditAndAiPolicy />,
  },
]

export default function AcceptDpaPage() {
  const [, startTransition] = useTransition()
  const [checked,   setChecked]   = useState<Record<string, boolean>>({})
  const [attempted, setAttempted] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const allRequired = CONSENT_ITEMS.every(i => checked[i.id])
  const acceptedCount = Object.values(checked).filter(Boolean).length

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
        await acceptDpa(acceptedIds)
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
          <h1 className="text-xl font-semibold text-gray-900">Data Processing Acknowledgement</h1>
          <p className="text-sm text-gray-500 mt-1">
            Required before accessing pupil data — UK GDPR Article 9 (Special Category)
          </p>
          {/* Progress bar */}
          <div className="mt-4 flex items-center gap-2">
            {CONSENT_ITEMS.map(item => (
              <div
                key={item.id}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  checked[item.id] ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            ))}
            <span className="text-[11px] text-gray-400 shrink-0">
              {acceptedCount}/{CONSENT_ITEMS.length} accepted
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
            items={CONSENT_ITEMS}
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
                You cannot access pupil data until all required policies have been accepted.
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
              : <><Icon name="check_circle" size="sm" />Confirm and Continue</>
            }
          </button>
          <p className="text-[11px] text-center text-gray-400">
            Your acknowledgement is recorded with a timestamp for GDPR compliance.
          </p>
        </div>
      </div>
    </div>
  )
}
