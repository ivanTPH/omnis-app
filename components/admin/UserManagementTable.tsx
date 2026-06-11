'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import {
  deactivateUser, reactivateUser, resendWelcomeEmail,
  changeUserRole, updateStudentYearGroup,
  getSchoolClasses, getUserClasses, setTeacherClasses,
  getStudentEnrolments, setStudentEnrolments,
} from '@/app/actions/admin'
import type { ManagedUser, UserFilter, ClassOption } from '@/app/actions/admin'
import StudentImportModal from '@/components/admin/StudentImportModal'
import { toCSV, downloadCSV } from '@/lib/csv'

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
  ACADEMY_ADMIN:     'Academy Admin',
}

const ASSIGNABLE_ROLES = [
  'TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO',
  'SLT', 'COVER_MANAGER', 'SCHOOL_ADMIN', 'TEACHING_ASSISTANT',
  'STUDENT', 'PARENT',
]

const CLASS_ROLES = new Set(['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'COVER_MANAGER', 'TEACHING_ASSISTANT'])

// ─── Edit User Modal ──────────────────────────────────────────────────────────

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: ManagedUser
  onClose: () => void
  onSaved: () => void
}) {
  const [role,       setRole]       = useState(user.role)
  const [yearGroup,  setYearGroup]  = useState<string>(user.yearGroup?.toString() ?? '')
  const [classes,    setClasses]    = useState<ClassOption[]>([])
  const [selectedCls, setSelectedCls] = useState<Set<string>>(new Set())
  const [pending,    startT]        = useTransition()
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    if (CLASS_ROLES.has(user.role)) {
      Promise.all([getSchoolClasses(), getUserClasses(user.id)]).then(([cls, userCls]) => {
        setClasses(cls)
        setSelectedCls(new Set(userCls))
      }).catch(() => {})
    } else if (user.role === 'STUDENT') {
      Promise.all([getSchoolClasses(), getStudentEnrolments(user.id)]).then(([cls, enrCls]) => {
        setClasses(cls)
        setSelectedCls(new Set(enrCls))
      }).catch(() => {})
    }
  }, [user.id, user.role])

  function toggleClass(id: string) {
    setSelectedCls(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSave() {
    setError(null)
    startT(async () => {
      try {
        const tasks: Promise<void>[] = []
        if (role !== user.role) tasks.push(changeUserRole(user.id, role))
        if (user.role === 'STUDENT') {
          const yg = yearGroup.trim() ? parseInt(yearGroup) : null
          tasks.push(updateStudentYearGroup(user.id, yg))
        }
        if (CLASS_ROLES.has(role)) {
          tasks.push(setTeacherClasses(user.id, [...selectedCls]))
        } else if (role === 'STUDENT' || user.role === 'STUDENT') {
          tasks.push(setStudentEnrolments(user.id, [...selectedCls]))
        }
        await Promise.all(tasks)
        onSaved()
      } catch (e) {
        setError(String(e))
      }
    })
  }

  // Group classes by year group for the UI
  const classByYear = classes.reduce<Record<number, ClassOption[]>>((acc, c) => {
    if (!acc[c.yearGroup]) acc[c.yearGroup] = []
    acc[c.yearGroup].push(c)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900">
            Edit — {user.firstName} {user.lastName}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition">
            <Icon name="close" size="sm" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Role */}
          <div>
            <label className="block text-[12px] font-medium text-gray-700 mb-1">Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ASSIGNABLE_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
              ))}
            </select>
          </div>

          {/* Year group (students only) */}
          {(role === 'STUDENT' || user.role === 'STUDENT') && (
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1">Year group</label>
              <select
                value={yearGroup}
                onChange={e => setYearGroup(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Not set</option>
                {[7,8,9,10,11,12,13].map(y => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
            </div>
          )}

          {/* Class enrolment (students) */}
          {(role === 'STUDENT' || user.role === 'STUDENT') && classes.length > 0 && (
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-2">
                Class enrolments
                <span className="ml-1 text-gray-400 font-normal">({selectedCls.size} selected)</span>
              </label>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-52 overflow-y-auto">
                {Object.entries(classByYear).sort(([a],[b]) => Number(a)-Number(b)).map(([yr, cls]) => (
                  <div key={yr}>
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                      Year {yr}
                    </p>
                    {cls.map(c => (
                      <label
                        key={c.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-blue-50 cursor-pointer transition"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCls.has(c.id)}
                          onChange={() => toggleClass(c.id)}
                          className="accent-blue-600"
                        />
                        <span className="text-[12px] text-gray-800">{c.name}</span>
                        <span className="text-[11px] text-gray-400 ml-auto">{c.subject}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Class assignment (staff roles) */}
          {CLASS_ROLES.has(role) && classes.length > 0 && (
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-2">
                Class assignments
                <span className="ml-1 text-gray-400 font-normal">({selectedCls.size} selected)</span>
              </label>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-52 overflow-y-auto">
                {Object.entries(classByYear).sort(([a],[b]) => Number(a)-Number(b)).map(([yr, cls]) => (
                  <div key={yr}>
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                      Year {yr}
                    </p>
                    {cls.map(c => (
                      <label
                        key={c.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-blue-50 cursor-pointer transition"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCls.has(c.id)}
                          onChange={() => toggleClass(c.id)}
                          className="accent-blue-600"
                        />
                        <span className="text-[12px] text-gray-800">{c.name}</span>
                        <span className="text-[11px] text-gray-400 ml-auto">{c.subject}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={pending}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-medium transition"
          >
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
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
  users:         ManagedUser[]
  counts:        Record<FilterKey, number>
  initialFilter?: FilterKey
}

export default function UserManagementTable({ users, counts, initialFilter = 'all' }: Props) {
  const router                    = useRouter()
  const [filter,  setFilter]      = useState<FilterKey>(initialFilter)
  const [query,   setQuery]       = useState('')
  const [pending, startTransition]= useTransition()
  const [toast,   setToast]       = useState<string | null>(null)
  const [editing, setEditing]     = useState<ManagedUser | null>(null)
  const [importing, setImporting] = useState(false)

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

      {/* Import modal */}
      {importing && (
        <StudentImportModal
          onClose={() => setImporting(false)}
          onImported={count => { setImporting(false); router.refresh(); showToast(`${count} student${count !== 1 ? 's' : ''} imported`) }}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); showToast('User updated') }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-[12px] px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => setImporting(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium rounded-lg transition"
        >
          <Icon name="upload_file" size="sm" />
          Import students (CSV)
        </button>
        <button
          onClick={() => {
            const csv = toCSV(
              ['First Name', 'Last Name', 'Email', 'Role', 'Year Group', 'Active', 'Activated', 'Created'],
              filtered.map(u => [
                u.firstName, u.lastName, u.email,
                ROLE_LABEL[u.role] ?? u.role,
                u.yearGroup ?? '',
                u.isActive ? 'Yes' : 'No',
                u.activatedAt ? new Date(u.activatedAt).toLocaleDateString('en-GB') : 'Pending',
                new Date(u.createdAt).toLocaleDateString('en-GB'),
              ]),
            )
            downloadCSV(`users-${filter}-${new Date().toISOString().slice(0,10)}.csv`, csv)
          }}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 text-[13px] font-medium rounded-lg hover:bg-gray-50 transition"
        >
          <Icon name="download" size="sm" />
          Export CSV
        </button>
      </div>

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
                      {/* Edit */}
                      <button
                        onClick={() => setEditing(u)}
                        title="Edit user"
                        className="p-1 rounded hover:bg-blue-50 text-blue-400 transition"
                      >
                        <Icon name="edit" size="sm" />
                      </button>
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
