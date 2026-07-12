'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import OmnisLogo from '@/components/ui/OmnisLogo'
import Icon from '@/components/ui/Icon'
import PolicyConsentPanel, { type ConsentItem } from '@/components/consent/PolicyConsentPanel'

type InviteInfo = { email: string; firstName: string; lastName: string; role: string }

// ── DPA consent items — same 3 as /accept-dpa ────────────────────────────────
// (Defined inline here so the invite page has no runtime dependency on /accept-dpa)

function DataControllerSummary() {
  return (
    <>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Data Controller &amp; Processor</h3>
        <p>Your school is the Data Controller for all pupil data. Omnis Education Ltd acts as
        Data Processor under a formal Data Processing Agreement. Anthropic (Claude AI) is an
        AI sub-processor — it does not train models on your school&apos;s data.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Retention</h3>
        <p>Pupil data is retained per your school&apos;s schedule (typically 7 years post-leaving;
        25 years for child protection records). Subject Access Requests go to your DPO.</p>
      </section>
    </>
  )
}

function StaffObligationsSummary() {
  return (
    <>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Data Minimisation</h3>
        <p>Access only the pupil data necessary for your role. Do not share pupil data outside
        authorised channels. Report any suspected breach to your school&apos;s DPO immediately.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Device Security</h3>
        <p>Lock your device when unattended. Log out when finished. Do not access Omnis on
        unsecured public Wi-Fi. Sessions expire after 4 hours; you&apos;ll be warned at 25 min.</p>
      </section>
    </>
  )
}

function AuditAiSummary() {
  return (
    <>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">Access Logging</h3>
        <p>All access to Special Category data (SEND, safeguarding, health) is logged under
        UK GDPR Article 9 and retained 7 years. Logs are available to your school&apos;s DPO.</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900 mb-2">AI-Generated Content</h3>
        <p>AI outputs (ILP goals, feedback, SEND insights) are advisory only. They require
        professional review before being acted upon and are never a substitute for qualified
        judgement, especially in safeguarding contexts.</p>
      </section>
    </>
  )
}

const DPA_ITEMS: ConsentItem[] = [
  {
    id:           'data-controller',
    label:        'I accept the Platform Terms of Use and understand that my school is the Data Controller, with Omnis Education Ltd acting as Data Processor under a formal Data Processing Agreement.',
    policyTitle:  'Data Controller & Processor Arrangement',
    policyContent: <DataControllerSummary />,
  },
  {
    id:           'staff-obligations',
    label:        "I understand my obligations: I will only access data necessary for my role, maintain confidentiality, report breaches to my school's DPO, and keep my session secure.",
    policyTitle:  'Staff Data Protection Obligations',
    policyContent: <StaffObligationsSummary />,
  },
  {
    id:           'audit-and-ai',
    label:        'I consent to access logging of Special Category data for GDPR compliance and acknowledge that AI-generated content is advisory and requires professional review.',
    policyTitle:  'Audit Logging & AI Processing Notice',
    policyContent: <AuditAiSummary />,
  },
]

// ── Main form ─────────────────────────────────────────────────────────────────

function AcceptInviteForm() {
  const params = useSearchParams()
  const token  = params.get('token') ?? ''

  const [invite,    setInvite]    = useState<InviteInfo | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [invalid,   setInvalid]   = useState(false)
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [checked,   setChecked]   = useState<Record<string, boolean>>({})
  const [attempted, setAttempted] = useState(false)
  const [status,    setStatus]    = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [errorMsg,  setErrorMsg]  = useState('')

  const allConsents = DPA_ITEMS.every(i => checked[i.id])
  const acceptedCount = Object.values(checked).filter(Boolean).length

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return }
    fetch(`/api/staff/accept-invite?token=${token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: InviteInfo) => { setInvite(d); setLoading(false) })
      .catch(() => { setInvalid(true); setLoading(false) })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAttempted(true)

    if (password !== confirm) { setErrorMsg('Passwords do not match.'); return }
    if (password.length < 8)  { setErrorMsg('Password must be at least 8 characters.'); return }
    if (!allConsents)          { setErrorMsg(''); return }   // panel shows per-item errors

    setErrorMsg('')
    setStatus('saving')
    const acceptedConsents = Object.entries(checked).filter(([, v]) => v).map(([k]) => k)
    const res = await fetch('/api/staff/accept-invite', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, password, acceptedConsents }),
    })
    if (res.ok) {
      setStatus('done')
    } else {
      const data = await res.json().catch(() => ({}))
      setErrorMsg(data.error ?? 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  if (loading) {
    return <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm">Verifying invitation…</div>
  }

  if (invalid) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="w-12 h-12 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Icon name="link_off" size="lg" className="text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Invitation expired</h2>
        <p className="text-sm text-gray-500 mb-4">
          This invitation link has expired or already been used. Please ask your school admin
          to send a new invitation.
        </p>
        <Link href="/login" className="text-blue-700 text-sm font-medium hover:underline">
          Go to sign in
        </Link>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="w-12 h-12 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Icon name="check_circle" size="lg" className="text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Account ready</h2>
        <p className="text-sm text-gray-500 mb-6">
          Welcome to Omnis, {invite?.firstName}. You can now sign in with your email address.
        </p>
        <Link
          href="/login"
          className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-2.5 rounded-lg transition text-sm inline-block"
        >
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Step indicator */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-0.5">Set up your account</h2>
        <p className="text-sm text-gray-500">
          Welcome, {invite?.firstName}. Choose a password and accept the required policies to
          activate your account ({invite?.email}).
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Password section */}
        <div className="px-6 pt-5 pb-4 space-y-4 border-b border-gray-100">
          <h3 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">
            1. Choose a password
          </h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
        </div>

        {/* Consent section */}
        <div className="px-6 pt-5 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">
              2. Accept required policies
            </h3>
            <span className="text-[11px] text-gray-400">
              {acceptedCount}/{DPA_ITEMS.length} accepted
            </span>
          </div>
          {/* Progress bar */}
          <div className="flex gap-1">
            {DPA_ITEMS.map(item => (
              <div
                key={item.id}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  checked[item.id] ? 'bg-green-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="text-[12px] text-gray-400">
            Click <span className="text-indigo-600 font-medium">View full policy →</span> to read
            each policy, then tick the box to accept.
          </p>
          <PolicyConsentPanel
            items={DPA_ITEMS}
            checked={checked}
            onChange={(id, val) => setChecked(prev => ({ ...prev, [id]: val }))}
            attempted={attempted}
          />
        </div>

        {/* Errors + submit */}
        <div className="px-6 pb-6 space-y-3">
          {attempted && !allConsents && (
            <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <Icon name="error" size="sm" className="shrink-0" />
              <p className="text-[12px] font-medium">
                You must accept all required policies to create your account.
              </p>
            </div>
          )}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-[13px]">
              {errorMsg}
            </div>
          )}
          <button
            type="submit"
            disabled={status === 'saving'}
            className="w-full min-h-[44px] bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2"
          >
            {status === 'saving'
              ? <><Icon name="refresh" size="sm" className="animate-spin" />Creating account…</>
              : <><Icon name="check_circle" size="sm" />Create account</>
            }
          </button>
          <p className="text-[11px] text-center text-gray-400">
            Your policy acceptance is recorded with a timestamp for compliance.
          </p>
        </div>
      </form>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 flex items-start sm:items-center justify-center p-4 py-8">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <OmnisLogo variant="login" background="dark" />
          <p className="text-blue-200 mt-2 text-sm">Learning &amp; SEND Intelligence Platform</p>
        </div>
        <Suspense fallback={<div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm">Loading…</div>}>
          <AcceptInviteForm />
        </Suspense>
      </div>
    </div>
  )
}
