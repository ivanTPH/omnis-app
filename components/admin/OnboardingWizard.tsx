'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { saveSchoolSettings, completeOnboarding } from '@/app/actions/admin'

type SchoolData = {
  id:          string
  name:        string
  phase:       string
  urn:         string
  emailDomain: string
}

const PHASES = [
  { value: 'secondary',   label: 'Secondary (11–18)' },
  { value: 'primary',     label: 'Primary (4–11)' },
  { value: 'all-through', label: 'All-through (4–18)' },
  { value: 'special',     label: 'Special school' },
  { value: 'pru',         label: 'PRU / AP' },
  { value: 'other',       label: 'Other' },
]

const STAFF_ROLES = [
  'TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO',
  'SLT', 'COVER_MANAGER', 'SCHOOL_ADMIN', 'TEACHING_ASSISTANT',
]

const ROLE_LABEL: Record<string, string> = {
  TEACHER: 'Teacher', HEAD_OF_DEPT: 'Head of Dept', HEAD_OF_YEAR: 'Head of Year',
  SENCO: 'SENCO', SLT: 'SLT', COVER_MANAGER: 'Cover Manager',
  SCHOOL_ADMIN: 'School Admin', TEACHING_ASSISTANT: 'Teaching Assistant',
}

type InviteRow = { firstName: string; lastName: string; email: string; role: string }

const STEPS = ['School profile', 'Invite staff', 'Connect MIS', 'Complete']

export default function OnboardingWizard({ school }: { school: SchoolData }) {
  const router             = useRouter()
  const [step, setStep]    = useState(0)
  const [pending, startT]  = useTransition()
  const [error, setError]  = useState<string | null>(null)

  // Step 0 — school profile
  const [name,        setName]        = useState(school.name)
  const [phase,       setPhase]       = useState(school.phase)
  const [urn,         setUrn]         = useState(school.urn)
  const [emailDomain, setEmailDomain] = useState(school.emailDomain)

  // Step 1 — staff invites
  const [invites, setInvites] = useState<InviteRow[]>([
    { firstName: '', lastName: '', email: '', role: 'TEACHER' },
  ])

  function addInviteRow() {
    setInvites(prev => [...prev, { firstName: '', lastName: '', email: '', role: 'TEACHER' }])
  }

  function updateInvite(i: number, field: keyof InviteRow, value: string) {
    setInvites(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  function removeInvite(i: number) {
    setInvites(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSaveProfile() {
    setError(null)
    startT(async () => {
      try {
        await saveSchoolSettings({ name, phase, urn, emailDomain })
        setStep(1)
      } catch (e) {
        setError(String(e))
      }
    })
  }

  async function handleSendInvites() {
    setError(null)
    const valid = invites.filter(r => r.email.trim() && r.firstName.trim())
    if (valid.length === 0) { setStep(2); return }

    startT(async () => {
      try {
        // Fire invitations via the existing invite API
        await Promise.all(valid.map(r =>
          fetch('/api/staff/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName: r.firstName, lastName: r.lastName, email: r.email, role: r.role }),
          })
        ))
        setStep(2)
      } catch (e) {
        setError(String(e))
      }
    })
  }

  async function handleComplete() {
    setError(null)
    startT(async () => {
      try {
        await completeOnboarding()
        router.push('/admin/dashboard')
      } catch (e) {
        setError(String(e))
      }
    })
  }

  return (
    <div className="w-full max-w-2xl">

      {/* Step indicator */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${
              i < step  ? 'bg-green-500 text-white' :
              i === step ? 'bg-blue-600 text-white' :
              'bg-gray-200 text-gray-400'
            }`}>
              {i < step ? <Icon name="check" size="sm" /> : i + 1}
            </div>
            <span className={`text-[12px] hidden sm:block ${i === step ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">

        {/* ── Step 0: School profile ── */}
        {step === 0 && (
          <>
            <div>
              <h2 className="text-[18px] font-bold text-gray-900">Set up your school profile</h2>
              <p className="text-[13px] text-gray-500 mt-1">
                These details are used across the platform and in communications.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">School name</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Phase</label>
                  <select
                    value={phase} onChange={e => setPhase(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select…</option>
                    {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">URN (6 digits)</label>
                  <input
                    type="text" value={urn} onChange={e => setUrn(e.target.value)}
                    placeholder="e.g. 123456"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1">
                  Email domain <span className="text-gray-400 font-normal">(used to auto-generate student emails from MIS)</span>
                </label>
                <input
                  type="text" value={emailDomain} onChange={e => setEmailDomain(e.target.value)}
                  placeholder="e.g. oakfield.sch.uk"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {error && <p className="text-[12px] text-red-600">{error}</p>}

            <button
              onClick={handleSaveProfile}
              disabled={pending || !name.trim()}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-medium transition"
            >
              {pending ? 'Saving…' : 'Save & continue'}
            </button>
          </>
        )}

        {/* ── Step 1: Invite staff ── */}
        {step === 1 && (
          <>
            <div>
              <h2 className="text-[18px] font-bold text-gray-900">Invite your staff</h2>
              <p className="text-[13px] text-gray-500 mt-1">
                Each person will receive an email with a link to set up their account. You can skip this and invite staff later from the Staff page.
              </p>
            </div>

            <div className="space-y-3">
              {invites.map((row, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
                    <input
                      type="text" placeholder="First name" value={row.firstName}
                      onChange={e => updateInvite(i, 'firstName', e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text" placeholder="Last name" value={row.lastName}
                      onChange={e => updateInvite(i, 'lastName', e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="email" placeholder="Email address" value={row.email}
                      onChange={e => updateInvite(i, 'email', e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={row.role}
                      onChange={e => updateInvite(i, 'role', e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {STAFF_ROLES.map(r => (
                        <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
                      ))}
                    </select>
                  </div>
                  {invites.length > 1 && (
                    <button onClick={() => removeInvite(i)} className="p-2 text-gray-400 hover:text-red-500 transition">
                      <Icon name="close" size="sm" />
                    </button>
                  )}
                </div>
              ))}

              <button
                onClick={addInviteRow}
                className="flex items-center gap-1 text-[12px] text-blue-600 hover:underline"
              >
                <Icon name="add_circle" size="sm" /> Add another person
              </button>
            </div>

            {error && <p className="text-[12px] text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setStep(2) }}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-[13px] text-gray-600 hover:bg-gray-50 transition"
              >
                Skip for now
              </button>
              <button
                onClick={handleSendInvites}
                disabled={pending}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-medium transition"
              >
                {pending ? 'Sending…' : 'Send invitations'}
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Connect MIS ── */}
        {step === 2 && (
          <>
            <div>
              <h2 className="text-[18px] font-bold text-gray-900">Connect your MIS</h2>
              <p className="text-[13px] text-gray-500 mt-1">
                Omnis integrates with Wonde to sync students, staff, classes and timetables from your school MIS. You&apos;ll need your Wonde School ID.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="text-[13px] font-medium text-blue-900 flex items-center gap-2">
                <Icon name="info" size="sm" className="text-blue-600" />
                How to connect Wonde
              </p>
              <ol className="text-[12px] text-blue-800 space-y-1 pl-5 list-decimal">
                <li>Log in to your Wonde dashboard and approve the Omnis application.</li>
                <li>Copy your School ID from the Wonde school settings page.</li>
                <li>Go to <strong>Admin → MIS Sync</strong> and enter your Wonde School ID.</li>
                <li>Click &ldquo;Sync now&rdquo; to import your school data.</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-[13px] text-gray-600 hover:bg-gray-50 transition"
              >
                Skip — connect later
              </button>
              <a
                href="/admin/wonde"
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[13px] font-medium transition text-center"
              >
                Go to MIS Sync
              </a>
            </div>
          </>
        )}

        {/* ── Step 3: Complete ── */}
        {step === 3 && (
          <>
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="celebration" size="lg" className="text-green-600" />
              </div>
              <h2 className="text-[20px] font-bold text-gray-900">You&apos;re all set!</h2>
              <p className="text-[13px] text-gray-500 mt-2 max-w-sm mx-auto">
                Your school is configured and ready. Head to the dashboard to start using Omnis.
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-[12px] font-semibold text-gray-700">What to do next:</p>
              <ul className="text-[12px] text-gray-600 space-y-1.5">
                <li className="flex items-center gap-2"><Icon name="check_circle" size="sm" className="text-green-500" /> Set up classes and enrol students</li>
                <li className="flex items-center gap-2"><Icon name="check_circle" size="sm" className="text-green-500" /> Configure subjects and exam boards</li>
                <li className="flex items-center gap-2"><Icon name="check_circle" size="sm" className="text-green-500" /> Invite the rest of your staff</li>
                <li className="flex items-center gap-2"><Icon name="check_circle" size="sm" className="text-green-500" /> Run your first MIS sync from Admin → MIS Sync</li>
              </ul>
            </div>

            {error && <p className="text-[12px] text-red-600">{error}</p>}

            <button
              onClick={handleComplete}
              disabled={pending}
              className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-medium transition"
            >
              {pending ? 'Finishing…' : 'Go to dashboard'}
            </button>
          </>
        )}

      </div>
    </div>
  )
}
