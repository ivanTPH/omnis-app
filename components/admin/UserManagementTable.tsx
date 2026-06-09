'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { deactivateUser, reactivateUser, resendWelcomeEmail } from '@/app/actions/admin'
import type { ManagedUser, UserFilter } from '@/app/actions/admin'

const ROLE_LABEL: Record<string, string> = {
  STUDENT:           'Student',
  PARENT:            'Parent',
  TEACHER:           'Teacher',
  HEAD_OF_DEPT:      'Head of Dept',
  HEAD_OF_YEAR:      'Head of Year',
  SENCO:             'SENCO',
  SLT:               'SLT',
  SCHOOL_ADMIN:      'School Admin',
  COVER_MANAGER:     'Cover Manager',
  TEACHING_ASSISTANT:'Teaching Assistant',
  PLATFORM_ADMIN:    'Platform Admin',
}

const ROLE_COLOUR: Record<string, string> = {
  STUDENT:           'bg-blue-100 text-blue-700',
  PARENT:            'bg-purple-100 text-purple-700',
  TEACHER:           'bg-green-100 text-green-700',
  HEAD_OF_DEPT:      'bg-teal-100 text-teal-700',
  HEAD_OF_YEAR:      'bg-teal-100 text-teal-700',
  SENCO:             'bg-amber-100 text-amber-700',
  SLT:               'bg-red-100 text-red-700',
  SCHOOL_ADMIN:      'bg-gray-100 text-gray-700',
  COVER_MANAGER:     'bg-orange-100 text-orange-700',
  TEACHING_ASSISTANT:'bg-cyan-100 text-cyan-700',
  PLATFORM_ADMIN:    'bg-gray-100 text-gray-700',
}

type FilterKey = UserFilter

const CHIPS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'students', label: 'Students' },
  { key: 'parents',  label: 'Parents'  },
  { key: 'staff',    label: 'Staff'    },
  { key: 'pending',  label: 'Pending activation' },
]

type Props = {
  users:  ManagedUser[]
  counts: Record<FilterKey, number>
}

export default function UserManagementTable({ users, counts }: Props) {
  const router                    = useRouter()
  const [filter,  setFilter]      = useState<FilterKey>('all')
  const [query,   setQuery]       = useState('')
  const [pending, startTransition]= useTransition()
  const [toast,   setToast]       = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const filtered = useMemo(() => {
    let list = users
    if (filter === 'students') list = list.filter(u => u.role === 'STUDENT')
    else if (filter === 'parents') list = list.filter(u => u.role === 'PARENT')
    else if (filter === 'staff') list = list.filter(u => !['STUDENT','PARENT'].includes(u.role))
    else if (filter === 'pending') list = list.filter(u => !u.activatedAt && u.isActive)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(u =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        ROLE_LABEL[u.role]?.toLowerCase().includes(q)
      )
    }
    return list
  }, [users, filter, query])

  async function handleDeactivate(userId: string) {
    startTransition(async () => {
      await deactivateUser(userId)
      router.refresh()
      showToast('User deactivated')
    })
  }

  async function handleReactivate(userId: string) {
    startTransition(async () => {
      await reactivateUser(userId)
      router.refresh()
      showToast('User reactivated')
    })
  }

  async function handleResend(userId: string) {
    startTransition(async () => {
      await resendWelcomeEmail(userId)
      showToast('Welcome email sent')
    })
  }

  return (
    <div className="space-y-4">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-[12px] px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {CHIPS.map(c => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`px-3 py-1 rounded-full text-[12px] font-medium border transition ${
              filter === c.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-200'
            }`}
          >
            {c.label}
            {counts[c.key] > 0 && (
              <span className={`ml-1.5 text-[10px] font-bold ${filter === c.key ? 'text-blue-100' : 'text-gray-400'}`}>
                {counts[c.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email or role…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Year</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Activated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">No users match this filter</td>
                </tr>
              )}
              {filtered.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 transition ${!u.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-[220px] truncate">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${ROLE_COLOUR[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {u.yearGroup != null ? `Year ${u.yearGroup}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {!u.isActive ? (
                      <span className="inline-flex items-center gap-1 text-gray-400 text-[11px]">
                        <Icon name="block" size="sm" /> Inactive
                      </span>
                    ) : u.activatedAt ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-[11px]">
                        <Icon name="check_circle" size="sm" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 text-[11px]">
                        <Icon name="schedule" size="sm" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {u.activatedAt
                      ? new Date(u.activatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {/* Resend welcome — only for pending/unactivated users */}
                      {!u.activatedAt && u.isActive && ['STUDENT','PARENT'].includes(u.role) && (
                        <button
                          onClick={() => handleResend(u.id)}
                          disabled={pending}
                          title="Resend welcome email"
                          className="p-1 rounded hover:bg-blue-50 text-blue-500 transition disabled:opacity-40"
                        >
                          <Icon name="email" size="sm" />
                        </button>
                      )}
                      {/* Deactivate / Reactivate */}
                      {u.isActive ? (
                        <button
                          onClick={() => handleDeactivate(u.id)}
                          disabled={pending}
                          title="Deactivate user"
                          className="p-1 rounded hover:bg-red-50 text-red-400 transition disabled:opacity-40"
                        >
                          <Icon name="person_off" size="sm" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(u.id)}
                          disabled={pending}
                          title="Reactivate user"
                          className="p-1 rounded hover:bg-green-50 text-green-500 transition disabled:opacity-40"
                        >
                          <Icon name="person_add" size="sm" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-400 bg-gray-50">
            Showing {filtered.length} of {users.length} users
          </div>
        )}
      </div>
    </div>
  )
}
