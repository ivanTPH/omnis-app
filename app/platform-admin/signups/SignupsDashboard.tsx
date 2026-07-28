'use client'
import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { markSignupReviewed, sendSignupEmail } from '@/app/actions/signups'
import type { SignupRow, SignupStats } from '@/app/actions/signups'

const TEST_EMAILS = new Set([
  'ivanyardley@me.com',
  'test.beta.check@omnis-test.edu',
  'test.beta.e2e@gmail.com',
  'sarah.johnson.test2026@gmail.com',
  'm.thompson.test77@greenfield.ac.uk',
  's.johnson.test99@riverside.ac.uk',
])

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
      ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
    }`}>
      <Icon name={ok ? 'check_circle' : 'radio_button_unchecked'} size="sm" />
      {label}
    </span>
  )
}

type ComposeTarget = {
  id:        string
  name:      string
  email:     string
  subject:   string
  body:      string
}

function defaultTemplate(r: SignupRow): { subject: string; body: string } {
  if (!r.hasAccount) {
    return {
      subject: `Your Omnis demo access — ${r.schoolName}`,
      body: `Hi ${r.name.split(' ')[0]},\n\nThank you for applying for Omnis demo access. I wanted to follow up personally — your account is ready and waiting.\n\nSign in here: https://omnis.education/login\n\nIf you have any questions or would like a quick walkthrough, just reply to this email and I'll arrange something.\n\nBest wishes,\nIvan\nFounder, Omnis Education`,
    }
  }
  if (r.trialExpired) {
    return {
      subject: `Your Omnis trial — next steps`,
      body: `Hi ${r.name.split(' ')[0]},\n\nI noticed your Omnis trial has come to an end. I'd love to hear how you found it — and whether there's anything we can do to make it work for ${r.schoolName}.\n\nIf you'd like to continue, I can arrange an extended trial or talk through pricing. Just reply here.\n\nBest wishes,\nIvan\nFounder, Omnis Education`,
    }
  }
  if (r.activated) {
    return {
      subject: `Checking in on your Omnis trial — ${r.schoolName}`,
      body: `Hi ${r.name.split(' ')[0]},\n\nI hope you've had a chance to explore Omnis. I wanted to check in — is there anything you'd like help with, or a feature you haven't been able to find?\n\nI'm happy to jump on a quick call to walk through anything. Just reply to this email.\n\nBest wishes,\nIvan\nFounder, Omnis Education`,
    }
  }
  return {
    subject: `Your Omnis demo — ${r.schoolName}`,
    body: `Hi ${r.name.split(' ')[0]},\n\nJust a quick note to say your Omnis demo account is ready — sign in at https://omnis.education/login with the email you used to register.\n\nDo let me know if there's anything you'd like me to walk you through.\n\nBest wishes,\nIvan\nFounder, Omnis Education`,
  }
}

export default function SignupsDashboard({ data }: { data: { rows: SignupRow[]; stats: SignupStats } }) {
  const [showTest,   setShowTest]   = useState(false)
  const [rows,       setRows]       = useState(data.rows)
  const [compose,    setCompose]    = useState<ComposeTarget | null>(null)
  const [sending,    setSending]    = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [sentIds,    setSentIds]    = useState<Set<string>>(new Set())
  const [, startTransition]        = useTransition()

  const visible = showTest ? rows : rows.filter(r => !TEST_EMAILS.has(r.email))
  const real    = rows.filter(r => !TEST_EMAILS.has(r.email))
  const stats   = data.stats

  function handleReviewed(id: string) {
    startTransition(async () => {
      await markSignupReviewed(id)
      setRows(prev => prev.map(r => r.id === id ? { ...r, reviewed: true } : r))
    })
  }

  function openCompose(r: SignupRow) {
    const { subject, body } = defaultTemplate(r)
    setCompose({ id: r.id, name: r.name, email: r.email, subject, body })
    setSendResult(null)
  }

  async function handleSend() {
    if (!compose) return
    setSending(true)
    const result = await sendSignupEmail({
      email:   compose.email,
      name:    compose.name,
      subject: compose.subject,
      body:    compose.body,
    })
    setSendResult(result)
    setSending(false)
    if (result.ok) {
      setSentIds(prev => new Set([...prev, compose.id]))
      setTimeout(() => setCompose(null), 1500)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Beta Signups</h1>
          <p className="text-sm text-gray-500 mt-0.5">Everyone who has requested access via the marketing site</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showTest}
            onChange={e => setShowTest(e.target.checked)}
            className="rounded"
          />
          Show test accounts
        </label>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Real applicants',  value: real.length,                         icon: 'people',        color: 'text-blue-600'   },
          { label: 'Account created',  value: real.filter(r => r.hasAccount).length, icon: 'person_add',   color: 'text-indigo-600' },
          { label: 'Activated',        value: real.filter(r => r.activated).length,  icon: 'verified_user', color: 'text-green-600'  },
          { label: 'DPA accepted',     value: real.filter(r => r.dpaAccepted).length, icon: 'gavel',        color: 'text-purple-600' },
          { label: 'Total (incl test)', value: stats.total,                          icon: 'list',          color: 'text-gray-500'   },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <Icon name={k.icon} size="md" className={k.color} />
            <p className="text-2xl font-bold text-gray-900 mt-2">{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Applicant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">School</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Size</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Applied</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Trial</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No real applicants yet &mdash; check &ldquo;Show test accounts&rdquo; to see test data
                  </td>
                </tr>
              )}
              {visible.map(r => (
                <tr key={r.id} className={`hover:bg-gray-50 ${TEST_EMAILS.has(r.email) ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.name}</div>
                    <div className="text-xs text-gray-400">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.schoolName}</td>
                  <td className="px-4 py-3 text-gray-600">{r.jobTitle}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{r.schoolSize}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt(r.appliedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <StatusPill ok={r.hasAccount}  label="Account" />
                      <StatusPill ok={r.activated}   label="Activated" />
                      <StatusPill ok={r.dpaAccepted} label="DPA" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {!r.hasAccount ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : r.trialEndsAt === null ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        <Icon name="all_inclusive" size="sm" /> Permanent
                      </span>
                    ) : r.trialExpired ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        <Icon name="lock" size="sm" /> Expired
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        <Icon name="timer" size="sm" /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5 items-start">
                      <button
                        onClick={() => openCompose(r)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap"
                      >
                        <Icon name={sentIds.has(r.id) ? 'mark_email_read' : 'mail'} size="sm" />
                        {sentIds.has(r.id) ? 'Sent' : 'Send email'}
                      </button>
                      {!r.reviewed ? (
                        <button
                          onClick={() => handleReviewed(r.id)}
                          className="text-xs text-indigo-600 hover:underline whitespace-nowrap"
                        >
                          Mark reviewed
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Icon name="check" size="sm" /> Reviewed
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compose email modal */}
      {compose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Email {compose.name.split(' ')[0]}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{compose.email}</p>
              </div>
              <button onClick={() => setCompose(null)} className="text-gray-400 hover:text-gray-600">
                <Icon name="close" size="md" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
                <input
                  type="text"
                  value={compose.subject}
                  onChange={e => setCompose(c => c ? { ...c, subject: e.target.value } : c)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Message</label>
                <textarea
                  rows={10}
                  value={compose.body}
                  onChange={e => setCompose(c => c ? { ...c, body: e.target.value } : c)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y font-mono"
                />
              </div>
              <p className="text-xs text-gray-400">
                Sends from <span className="font-medium">notifications@omnis.education</span> · replies go to <span className="font-medium">ivanyardley@me.com</span>
              </p>
              {sendResult && !sendResult.ok && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                  Failed: {sendResult.error}
                </div>
              )}
              {sendResult?.ok && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs px-3 py-2 rounded-lg flex items-center gap-1.5">
                  <Icon name="check_circle" size="sm" /> Email sent successfully
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setCompose(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !compose.subject.trim() || !compose.body.trim() || sendResult?.ok}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition"
              >
                {sending
                  ? <><Icon name="refresh" size="sm" className="animate-spin" /> Sending…</>
                  : <><Icon name="send" size="sm" /> Send email</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
