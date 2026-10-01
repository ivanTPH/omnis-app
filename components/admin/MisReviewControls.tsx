'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignClassTeacher, setStaffRole, saveClassImport, linkPupilToAccount, createPupilAccount } from '@/app/actions/mis-review'
import { ASSIGNABLE_STAFF_ROLES, ROLE_LABELS } from '@/lib/mis-review-roles'
import type { ClassNoTeacher, StaffRow, ClassImportView, NameReviewPupil } from '@/lib/mis-review'

export function ClassTeacherAssigner({ classes, teachers }: { classes: ClassNoTeacher[]; teachers: { id: string; name: string }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const shown = classes.slice(0, 200)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead className="text-left text-gray-500"><tr><th className="py-1 pr-2">Class</th><th className="py-1 pr-2">Year</th><th className="py-1 pr-2">Pupils</th><th className="py-1">Teacher</th></tr></thead>
        <tbody className="divide-y divide-gray-100">
          {shown.map(c => (
            <tr key={c.id}>
              <td className="py-1.5 pr-2"><span className="font-medium text-gray-900">{c.name}</span> <span className="text-gray-400">{c.subject}</span></td>
              <td className="py-1.5 pr-2">{c.yearGroup}</td>
              <td className="py-1.5 pr-2">{c.pupils}</td>
              <td className="py-1.5">
                <div className="flex gap-2">
                  <select aria-label={`Teacher for ${c.name}`} value={choice[c.id] ?? ''} onChange={e => setChoice({ ...choice, [c.id]: e.target.value })}
                    className="border border-gray-300 rounded px-2 py-1 text-[12px] max-w-[200px]">
                    <option value="">Choose…</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button disabled={pending || !choice[c.id]}
                    onClick={() => start(async () => {
                      setError('')
                      try { await assignClassTeacher(c.id, choice[c.id]); router.refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Could not assign') }
                    })}
                    className="px-3 py-1 rounded bg-gray-900 text-white text-[12px] disabled:opacity-40">Assign</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {classes.length > shown.length && <p className="text-[12px] text-gray-500 mt-2">Showing the first {shown.length} of {classes.length}.</p>}
      {error && <p className="text-[12px] text-red-700 mt-2">{error}</p>}
    </div>
  )
}

export function StaffRoleEditor({ staff }: { staff: StaffRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const shown = staff.filter(s => !filter || `${s.name} ${s.email}`.toLowerCase().includes(filter.toLowerCase())).slice(0, 300)
  return (
    <div>
      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search staff" aria-label="Search staff"
        className="mb-3 w-full sm:w-64 border border-gray-300 rounded-lg px-3 py-1.5 text-[12px]" />
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="text-left text-gray-500"><tr><th className="py-1 pr-2">Name</th><th className="py-1 pr-2">Email</th><th className="py-1 pr-2">Signed in</th><th className="py-1">Role</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {shown.map(s => (
              <tr key={s.id}>
                <td className="py-1.5 pr-2 font-medium text-gray-900">{s.name}{s.fromMis && <span className="ml-1 text-[10px] text-gray-400">MIS</span>}</td>
                <td className="py-1.5 pr-2 text-gray-500">{s.email}</td>
                <td className="py-1.5 pr-2">{s.signedIn ? 'Yes' : 'Not yet'}</td>
                <td className="py-1.5">
                  {(ASSIGNABLE_STAFF_ROLES as readonly string[]).includes(s.role) ? (
                    <select aria-label={`Role for ${s.name}`} defaultValue={s.role} disabled={pending}
                      onChange={e => {
                        const role = e.target.value
                        start(async () => {
                          setError('')
                          try { await setStaffRole(s.id, role); router.refresh() } catch (err) { setError(err instanceof Error ? err.message : 'Could not change role') }
                        })
                      }}
                      className="border border-gray-300 rounded px-2 py-1 text-[12px]">
                      {ASSIGNABLE_STAFF_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  ) : <span className="text-gray-500">{s.role}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-[12px] text-red-700 mt-2">{error}</p>}
    </div>
  )
}


export function ClassImportForm({ view }: { view: ClassImportView }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [forms, setForms] = useState(view.settings.formGroups)
  const [included, setIncluded] = useState<Record<string, boolean>>(Object.fromEntries(view.subjects.map(s => [s.key, s.included])))
  const [msg, setMsg] = useState('')
  const save = () => start(async () => {
    setMsg('')
    try {
      await saveClassImport(forms, view.subjects.filter(s => !included[s.key]).map(s => s.key))
      setMsg('Saved. Your choice is applied at the next MIS sync (tonight, or run one now from MIS Sync).')
      router.refresh()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Could not save') }
  })
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-2 text-[13px] text-gray-800">
        <input type="checkbox" checked={forms} onChange={e => setForms(e.target.checked)} className="mt-0.5" />
        <span>
          <span className="font-medium">Form groups</span> ({view.formGroups} forms in your MIS)
          <span className="block text-[12px] text-gray-500">Tutors can then see their form&rsquo;s pupils, including SEND needs and interventions. Assign each form tutor in &ldquo;Classes without a teacher&rdquo; below.</span>
        </span>
      </label>
      <div>
        <p className="text-[13px] font-medium text-gray-800 mb-1">Teaching classes, by subject</p>
        {view.subjects.length === 0
          ? <p className="text-[12px] text-gray-500">No MIS classes yet. They appear after the first sync.</p>
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              {view.subjects.map(s => (
                <label key={s.key} className="flex items-center gap-2 text-[12px] text-gray-700">
                  <input type="checkbox" checked={!!included[s.key]} onChange={e => setIncluded({ ...included, [s.key]: e.target.checked })} />
                  {s.label} <span className="text-gray-400">({s.classes})</span>
                </label>
              ))}
            </div>
          )}
        <p className="text-[12px] text-gray-500 mt-2">Untick anything that isn&rsquo;t taught as a class, such as clubs, enrichment or study support. Classes already set up in Omnis are not deleted.</p>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="px-3 py-1.5 rounded bg-gray-900 text-white text-[12px] disabled:opacity-40">Save choice</button>
        {msg && <span className="text-[12px] text-gray-600">{msg}</span>}
      </div>
    </div>
  )
}

export function PupilNameReview({ pupils }: { pupils: NameReviewPupil[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const run = (fn: () => Promise<void>) => start(async () => {
    setError('')
    try { await fn(); router.refresh() } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong') }
  })
  const d = (x: Date | null) => x ? new Date(x).toLocaleDateString('en-GB') : 'not known'
  return (
    <div className="space-y-3">
      {pupils.slice(0, 100).map(p => (
        <div key={p.wondeId} className="border border-gray-200 rounded-lg p-3">
          <p className="text-[13px] font-medium text-gray-900">{p.name}</p>
          <p className="text-[12px] text-gray-500">MIS: Year {p.yearGroup ?? '?'}{p.formGroup ? `, form ${p.formGroup}` : ''}, date of birth {d(p.dob)}</p>
          <p className="text-[12px] text-gray-700 mt-2">Existing Omnis account(s) with the same name:</p>
          <ul className="mt-1 space-y-1">
            {p.candidates.map(c => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 text-[12px] text-gray-600">
                <span>{c.email} · Year {c.yearGroup ?? '?'} · added {d(c.createdAt)} · {c.submissions} piece(s) of work</span>
                <button disabled={pending} onClick={() => run(() => linkPupilToAccount(p.wondeId, c.id))}
                  className="px-2 py-0.5 rounded border border-gray-300 text-[12px] disabled:opacity-40">This is the same pupil</button>
              </li>
            ))}
          </ul>
          <button disabled={pending} onClick={() => run(() => createPupilAccount(p.wondeId))}
            className="mt-2 px-2 py-0.5 rounded bg-gray-900 text-white text-[12px] disabled:opacity-40">None of these: create a new account</button>
        </div>
      ))}
      {pupils.length > 100 && <p className="text-[12px] text-gray-500">Showing the first 100 of {pupils.length}.</p>}
      {error && <p className="text-[12px] text-red-700">{error}</p>}
    </div>
  )
}
