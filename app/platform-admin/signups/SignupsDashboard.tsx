'use client'
import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { markSignupReviewed } from '@/app/actions/signups'
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

export default function SignupsDashboard({ data }: { data: { rows: SignupRow[]; stats: SignupStats } }) {
  const [showTest, setShowTest] = useState(false)
  const [rows, setRows]         = useState(data.rows)
  const [, startTransition]     = useTransition()

  const visible = showTest ? rows : rows.filter(r => !TEST_EMAILS.has(r.email))
  const real    = rows.filter(r => !TEST_EMAILS.has(r.email))
  const stats   = data.stats

  function handleReviewed(id: string) {
    startTransition(async () => {
      await markSignupReviewed(id)
      setRows(prev => prev.map(r => r.id === id ? { ...r, reviewed: true } : r))
    })
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
                    {!r.reviewed && (
                      <button
                        onClick={() => handleReviewed(r.id)}
                        className="text-xs text-indigo-600 hover:underline whitespace-nowrap"
                      >
                        Mark reviewed
                      </button>
                    )}
                    {r.reviewed && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Icon name="check" size="sm" /> Reviewed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
