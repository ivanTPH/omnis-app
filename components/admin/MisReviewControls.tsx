'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignClassTeacher, setStaffRole } from '@/app/actions/mis-review'
import { ASSIGNABLE_STAFF_ROLES, ROLE_LABELS } from '@/lib/mis-review-roles'
import type { ClassNoTeacher, StaffRow } from '@/lib/mis-review'

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
