'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  sendPupilInvitations, sendParentInvitations, setParentRegistration, setFamilyContactEmail, sendStaffInvitations,
  type InvitationOverview,
} from '@/app/actions/go-live'

const yearLabel = (y: number | null) => (y == null ? 'No year' : `Year ${y}`)

export default function InvitationsPanel({ overview }: { overview: InvitationOverview }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [contact, setContact] = useState(overview.familyContactEmail ?? '')
  const [years, setYears] = useState<number[]>([])
  const [resend, setResend] = useState(false)

  const selectable = overview.years.filter(y => y.yearGroup != null).map(y => y.yearGroup as number)
  const chosen = overview.years.filter(y => y.yearGroup != null && years.includes(y.yearGroup))
  const pupilCount  = chosen.reduce((n, y) => n + (resend ? y.withEmail - y.activated : y.withEmail - y.invited), 0)
  const parentCount = chosen.reduce((n, y) => n + (y.parentEmailsOnMis - y.parentsRegistered), 0)

  function run(label: string, fn: () => Promise<string>) {
    setMessage(''); setError('')
    start(async () => {
      try { setMessage(await fn()); router.refresh() }
      catch (e) { setError(e instanceof Error ? e.message : `${label} failed`) }
    })
  }

  return (
    <div className="space-y-6">
      {!overview.live && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-[13px] text-amber-900">
          Your school is not live yet, so invitations cannot be sent. Complete the <Link href="/admin/go-live" className="underline">go-live checklist</Link> first.
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-[15px] font-bold text-gray-900 mb-1">Contact email for families</h2>
        <p className="text-[12px] text-gray-500 mb-3">Shown in every invitation, so pupils and parents know who to ask. Usually the school office.</p>
        <div className="flex gap-2">
          <input value={contact} onChange={e => setContact(e.target.value)} type="email" placeholder="office@yourschool.sch.uk"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-[13px]" />
          <button disabled={pending} onClick={() => run('Saving', async () => { await setFamilyContactEmail(contact); return 'Contact email saved.' })}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold disabled:opacity-40">Save</button>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-[15px] font-bold text-gray-900 mb-1">Staff</h2>
        <p className="text-[12px] text-gray-500 mb-3">
          {overview.staff.total} staff accounts: {overview.staff.activated} signed in, {overview.staff.invited} invited.
          Teachers are created from your MIS with their classes already set up. You can invite staff before going live, so they can prepare.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={pending}
            onClick={() => {
              if (!confirm('Send set-up emails to staff who have not been invited yet?')) return
              run('Sending', async () => { const r = await sendStaffInvitations({ resend: false }); return `Sent ${r.sent} staff invitation(s).${r.failed ? ` ${r.failed} could not be sent.` : ''}` })
            }}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold disabled:opacity-40"
          >Invite staff</button>
          <button
            disabled={pending}
            onClick={() => {
              if (!confirm('Resend set-up emails to staff who have not signed in yet?')) return
              run('Sending', async () => { const r = await sendStaffInvitations({ resend: true }); return `Sent ${r.sent} staff reminder(s).${r.failed ? ` ${r.failed} could not be sent.` : ''}` })
            }}
            className="px-4 py-2 rounded-lg border border-gray-300 text-[13px] font-medium text-gray-700 disabled:opacity-40"
          >Resend to staff who haven’t signed in</button>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5 overflow-x-auto">
        <h2 className="text-[15px] font-bold text-gray-900 mb-3">Where things stand</h2>
        <table className="w-full text-[12px]">
          <thead className="text-gray-500 text-left">
            <tr>
              <th className="py-1 pr-2"></th><th className="py-1 pr-2">Year</th><th className="py-1 pr-2">Pupils</th>
              <th className="py-1 pr-2">With email</th><th className="py-1 pr-2">Invited</th><th className="py-1 pr-2">Signed in</th>
              <th className="py-1 pr-2">Parent emails on MIS</th><th className="py-1">Parents registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {overview.years.map(y => (
              <tr key={String(y.yearGroup)}>
                <td className="py-1.5 pr-2">
                  {y.yearGroup != null && (
                    <input type="checkbox" aria-label={`Select ${yearLabel(y.yearGroup)}`} checked={years.includes(y.yearGroup)}
                      onChange={e => setYears(e.target.checked ? [...years, y.yearGroup as number] : years.filter(v => v !== y.yearGroup))} />
                  )}
                </td>
                <td className="py-1.5 pr-2 font-medium text-gray-900">{yearLabel(y.yearGroup)}</td>
                <td className="py-1.5 pr-2">{y.pupils}</td>
                <td className={`py-1.5 pr-2 ${y.withEmail < y.pupils ? 'text-amber-700 font-semibold' : ''}`}>{y.withEmail}</td>
                <td className="py-1.5 pr-2">{y.invited}</td>
                <td className="py-1.5 pr-2">{y.activated}</td>
                <td className="py-1.5 pr-2">{y.parentEmailsOnMis}</td>
                <td className="py-1.5">{y.parentsRegistered}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-3 mt-3 text-[12px]">
          <button className="text-blue-700 hover:underline" onClick={() => setYears(selectable)}>Select all</button>
          <button className="text-blue-700 hover:underline" onClick={() => setYears([])}>Clear</button>
        </div>
        <p className="text-[12px] text-gray-500 mt-3">
          Pupils without an email address can’t be invited. Ask your MIS team to grant “contact details” in Wonde, or add
          addresses with the CSV import on the <Link href="/admin/users" className="underline">User Management</Link> page.
        </p>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-[15px] font-bold text-gray-900 mb-1">Pupils</h2>
        <p className="text-[12px] text-gray-500 mb-3">Each pupil gets an email with a link to choose a password. The link lasts 7 days.</p>
        <label className="flex items-center gap-2 text-[12px] text-gray-700 mb-3">
          <input type="checkbox" checked={resend} onChange={e => setResend(e.target.checked)} />
          Also resend to pupils who were invited but haven’t signed in yet
        </label>
        <button
          disabled={pending || !overview.live || years.length === 0 || pupilCount <= 0}
          onClick={() => {
            if (!confirm(`Send set-up emails to ${pupilCount} pupil(s) in ${chosen.map(y => yearLabel(y.yearGroup)).join(', ')}?`)) return
            run('Sending', async () => {
              const r = await sendPupilInvitations({ yearGroups: years, resend })
              return `Sent ${r.sent}.${r.failed ? ` ${r.failed} could not be sent.` : ''}${r.skippedNoEmail ? ` ${r.skippedNoEmail} skipped (no email address).` : ''}`
            })
          }}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold disabled:opacity-40"
        >
          {years.length === 0 ? 'Choose year groups above' : `Invite ${Math.max(pupilCount, 0)} pupil(s)`}
        </button>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-[15px] font-bold text-gray-900 mb-1">Parents and carers</h2>
        <p className="text-[12px] text-gray-500 mb-3">
          Parents register themselves at <span className="font-mono">omnis.education/parents</span> using the email address you hold on
          your MIS. Only adults with parental responsibility can register, and they are linked only to their own children.
          Registration is currently <strong>{overview.parentSignupOpen ? 'open' : 'closed'}</strong>.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={pending || !overview.live}
            onClick={() => run('Updating', async () => { await setParentRegistration(!overview.parentSignupOpen); return overview.parentSignupOpen ? 'Parent registration closed.' : 'Parent registration opened.' })}
            className="px-4 py-2 rounded-lg border border-gray-300 text-[13px] font-medium text-gray-700 disabled:opacity-40"
          >
            {overview.parentSignupOpen ? 'Close parent registration' : 'Open parent registration'}
          </button>
          <button
            disabled={pending || !overview.live || years.length === 0 || parentCount <= 0}
            onClick={() => {
              if (!confirm(`Email ${parentCount} parent(s)/carer(s) an invitation to register? This also opens parent registration.`)) return
              run('Sending', async () => {
                const r = await sendParentInvitations({ yearGroups: years })
                return `Sent ${r.sent} parent invitation(s).${r.failed ? ` ${r.failed} could not be sent.` : ''}`
              })
            }}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-[13px] font-semibold disabled:opacity-40"
          >
            {years.length === 0 ? 'Choose year groups above' : `Email ${Math.max(parentCount, 0)} parent(s) an invitation`}
          </button>
        </div>
        <p className="text-[12px] text-gray-500 mt-3">
          You don’t have to use the email button: you can send your own letter or message with the link instead.
        </p>
      </section>

      {message && <p className="text-[13px] text-green-800 bg-green-50 border border-green-200 rounded-lg px-4 py-2">{message}</p>}
      {error && <p className="text-[13px] text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}
    </div>
  )
}
