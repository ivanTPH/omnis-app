'use client'

import { useState, useRef, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import type { StaffMember, ClassOption } from '@/app/actions/admin'
import {
  createStaffMember,
  updateStaffMember,
  toggleStaffActive,
  deleteStaffMember,
  getSchoolClasses,
  getUserClasses,
  setTeacherClasses,
} from '@/app/actions/admin'
import { toCSV, downloadCSV } from '@/lib/csv'

// ─── Constants ────────────────────────────────────────────────────────────────

export const ROLE_LABEL: Record<string, string> = {
  TEACHER:             'Teacher',
  HEAD_OF_DEPT:        'Head of Dept',
  HEAD_OF_YEAR:        'Head of Year',
  SENCO:               'SENCo',
  SCHOOL_ADMIN:        'Admin',
  SLT:                 'SLT',
  COVER_MANAGER:       'Cover Manager',
  TEACHING_ASSISTANT:  'Teaching Assistant',
}

const ROLE_COLOUR: Record<string, string> = {
  TEACHER:             'bg-blue-50 text-blue-700',
  HEAD_OF_DEPT:        'bg-indigo-50 text-indigo-700',
  HEAD_OF_YEAR:        'bg-violet-50 text-violet-700',
  SENCO:               'bg-purple-50 text-purple-700',
  SCHOOL_ADMIN:        'bg-green-50 text-green-700',
  SLT:                 'bg-teal-50 text-teal-700',
  COVER_MANAGER:       'bg-orange-50 text-orange-700',
  TEACHING_ASSISTANT:  'bg-sky-50 text-sky-700',
}

const STAFF_ROLE_OPTIONS = [
  'TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO',
  'SCHOOL_ADMIN', 'SLT', 'COVER_MANAGER', 'TEACHING_ASSISTANT',
]

const DEPARTMENTS = [
  'English', 'Mathematics', 'Science', 'History', 'Geography',
  'Religious Education', 'Art', 'Physical Education', 'Drama',
  'Music', 'Modern Foreign Languages', 'Computing', 'Other',
]

function genPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ─── Form state ───────────────────────────────────────────────────────────────

type FormState = {
  firstName:   string
  lastName:    string
  email:       string
  role:        string
  department:  string
  tempPassword: string
}

function blankForm(): FormState {
  return { firstName: '', lastName: '', email: '', role: 'TEACHER', department: '', tempPassword: genPassword() }
}

function formFromStaff(s: StaffMember): FormState {
  return {
    firstName:    s.firstName,
    lastName:     s.lastName,
    email:        s.email,
    role:         s.role,
    department:   s.department ?? '',
    tempPassword: '',
  }
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'role' | 'department' | 'classCount'

function sortStaff(staff: StaffMember[], key: SortKey, asc: boolean): StaffMember[] {
  return [...staff].sort((a, b) => {
    const dir = asc ? 1 : -1
    switch (key) {
      case 'name':       return dir * `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)
      case 'role':       return dir * a.role.localeCompare(b.role)
      case 'department': return dir * (a.department ?? '').localeCompare(b.department ?? '')
      case 'classCount': return dir * (a.classCount - b.classCount)
    }
  })
}

// ─── Staff slide-over ─────────────────────────────────────────────────────────

function StaffSlideOver({
  mode, staff, onClose, onSaved,
}: {
  mode:    'add' | 'edit'
  staff?:  StaffMember
  onClose: () => void
  onSaved: (s: StaffMember) => void
}) {
  const [form, setForm]               = useState<FormState>(mode === 'edit' && staff ? formFromStaff(staff) : blankForm())
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [copied, setCopied]           = useState(false)
  const passwordRef                   = useRef<HTMLInputElement>(null)
  const [allClasses, setAllClasses]   = useState<ClassOption[]>([])
  const [assignedIds, setAssignedIds] = useState<string[]>([])
  const [classesLoaded, setClassesLoaded] = useState(false)

  // Load class assignments when editing
  useEffect(() => {
    if (mode !== 'edit' || !staff) return
    Promise.all([getSchoolClasses(), getUserClasses(staff.id)]).then(([all, assigned]) => {
      setAllClasses(all)
      setAssignedIds(assigned)
      setClassesLoaded(true)
    }).catch(() => setClassesLoaded(true))
  }, [mode, staff])

  function toggleClass(classId: string) {
    setAssignedIds(prev =>
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    )
  }

  function set(k: keyof FormState, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function copyPassword() {
    navigator.clipboard.writeText(form.tempPassword).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    if (mode === 'add') {
      const res = await createStaffMember({
        firstName:         form.firstName,
        lastName:          form.lastName,
        email:             form.email,
        role:              form.role,
        department:        form.department || undefined,
        temporaryPassword: form.tempPassword,
      })
      if (res.error) { setError(res.error); setSaving(false); return }
      onSaved({
        id:         res.staffId!,
        firstName:  form.firstName,
        lastName:   form.lastName,
        email:      form.email,
        role:       form.role,
        department: form.department || null,
        yearGroups: [],
        classCount: 0,
        isActive:   true,
      })
    } else {
      const res = await updateStaffMember({
        staffId:    staff!.id,
        firstName:  form.firstName,
        lastName:   form.lastName,
        email:      form.email,
        role:       form.role,
        department: form.department || undefined,
      })
      if (res.error) { setError(res.error); setSaving(false); return }
      // Save class assignments
      if (classesLoaded) {
        await setTeacherClasses(staff!.id, assignedIds)
      }
      const newYearGroups = allClasses
        .filter(c => assignedIds.includes(c.id))
        .map(c => c.yearGroup)
        .filter((y): y is number => y != null)
      onSaved({ ...staff!, ...form, department: form.department || null, yearGroups: [...new Set(newYearGroups)] })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <p className="text-[15px] font-semibold text-gray-900">
              {mode === 'add' ? 'Add staff member' : `Edit — ${staff!.firstName} ${staff!.lastName}`}
            </p>
            {mode === 'edit' && (
              <p className="text-[12px] text-gray-400 mt-0.5">{staff!.email}</p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <Icon name="close" size="md" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">

            {/* Personal details */}
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Personal Details</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-gray-700">First name <span className="text-red-500">*</span></span>
                  <input
                    required value={form.firstName} onChange={e => set('firstName', e.target.value)}
                    className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="First name"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-gray-700">Last name <span className="text-red-500">*</span></span>
                  <input
                    required value={form.lastName} onChange={e => set('lastName', e.target.value)}
                    className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Last name"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-gray-700">Email address <span className="text-red-500">*</span></span>
                <input
                  required type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="name@school.ac.uk"
                />
              </label>
            </div>

            {/* Role & Department */}
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Role &amp; Access</p>
              <div className="space-y-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-gray-700">Role <span className="text-red-500">*</span></span>
                  <select
                    required value={form.role} onChange={e => set('role', e.target.value)}
                    className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                  >
                    {STAFF_ROLE_OPTIONS.map(r => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-gray-700">Department</span>
                  <select
                    value={form.department} onChange={e => set('department', e.target.value)}
                    className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                  >
                    <option value="">— No department —</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {/* Class / Year Group assignment (edit only) */}
            {mode === 'edit' && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Class &amp; Year Group Assignment</p>
                {!classesLoaded ? (
                  <p className="text-[12px] text-gray-400">Loading classes…</p>
                ) : allClasses.length === 0 ? (
                  <p className="text-[12px] text-gray-400">No classes found. Add classes first.</p>
                ) : (
                  <div className="space-y-3">
                    {Array.from(new Set(allClasses.map(c => c.yearGroup).filter((y): y is number => y != null))).sort((a, b) => a - b).map(yr => {
                      const classes = allClasses.filter(c => c.yearGroup === yr)
                      return (
                        <div key={yr}>
                          <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Year {yr}</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {classes.map(c => (
                              <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={assignedIds.includes(c.id)}
                                  onChange={() => toggleClass(c.id)}
                                  className="accent-blue-600 w-3.5 h-3.5"
                                />
                                <span className="text-[12px] text-gray-700 truncate">{c.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Temporary password (add only) */}
            {mode === 'add' && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Account Setup</p>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-gray-700">Temporary password</span>
                  <div className="flex gap-2">
                    <input
                      ref={passwordRef}
                      type="text"
                      value={form.tempPassword}
                      onChange={e => set('tempPassword', e.target.value)}
                      className="flex-1 px-3 py-2 text-[13px] font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <button
                      type="button"
                      onClick={copyPassword}
                      className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition text-[12px] font-medium whitespace-nowrap"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => set('tempPassword', genPassword())}
                      className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition"
                      title="Regenerate password"
                    >
                      <Icon name="refresh" size="sm" />
                    </button>
                  </div>
                </label>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Share this with the staff member. They will be asked to change it on first sign-in.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-[13px] text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button
              type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving && <Icon name="refresh" size="sm" className="animate-spin" />}
              {mode === 'add' ? 'Add staff member' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete confirmation modal ─────────────────────────────────────────────────

function DeleteModal({
  staff, onClose, onDeleted,
}: {
  staff:     StaffMember
  onClose:   () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleDelete() {
    setError(null)
    setDeleting(true)
    const res = await deleteStaffMember(staff.id)
    if (res.error) { setError(res.error); setDeleting(false); return }
    onDeleted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <Icon name="delete" size="md" className="text-red-600" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-gray-900">Remove staff member?</p>
            <p className="text-[12px] text-gray-400">This will remove their login access</p>
          </div>
        </div>

        <p className="text-[13px] text-gray-600 mb-1">You are removing access for:</p>
        <p className="text-[14px] font-medium text-gray-900">{staff.firstName} {staff.lastName}</p>
        <p className="text-[12px] text-gray-400 mb-4">{staff.email}</p>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
          <p className="text-[12px] text-amber-800">
            Their lessons, homework and class records will be preserved.
            Only their login access will be removed.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[12px] text-red-700 mb-3">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-lg py-2.5 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete} disabled={deleting}
            className="flex-1 bg-red-600 text-white rounded-lg py-2.5 text-[13px] font-medium hover:bg-red-700 disabled:opacity-50 transition"
          >
            {deleting ? 'Removing…' : 'Remove access'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Invite staff modal ────────────────────────────────────────────────────────

function InviteModal({ onClose }: { onClose: () => void }) {
  const [form, setForm]     = useState({ firstName: '', lastName: '', email: '', role: 'TEACHER' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError]   = useState<string | null>(null)

  function set(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setStatus('sending')
    const res = await fetch('/api/staff/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setStatus('sent')
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong.')
      setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <p className="text-[15px] font-semibold text-gray-900">Invite staff member</p>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <Icon name="close" size="md" />
          </button>
        </div>
        {status === 'sent' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-12 h-12 bg-green-50 border border-green-100 rounded-2xl flex items-center justify-center mb-4">
              <Icon name="mark_email_read" size="lg" className="text-green-600" />
            </div>
            <p className="text-[15px] font-semibold text-gray-900 mb-1">Invitation sent</p>
            <p className="text-[13px] text-gray-500 mb-6">
              {form.firstName} will receive an email with a link to set up their account.
            </p>
            <button onClick={onClose} className="px-6 py-2 bg-blue-600 text-white text-[13px] font-semibold rounded-lg hover:bg-blue-700 transition">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
            <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">
              <p className="text-[13px] text-gray-500">
                An invitation email will be sent with a link to set up their account. They choose their own password — no temporary credentials needed.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1">First name</label>
                  <input required value={form.firstName} onChange={e => set('firstName', e.target.value)}
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 mb-1">Last name</label>
                  <input required value={form.lastName} onChange={e => set('lastName', e.target.value)}
                    className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">School email</label>
                <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="name@school.ac.uk"
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-600 mb-1">Role</label>
                <select required value={form.role} onChange={e => set('role', e.target.value)}
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                  {STAFF_ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
                </select>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-[13px] text-red-700">{error}</div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button type="submit" disabled={status === 'sending'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
                {status === 'sending' && <Icon name="refresh" size="sm" className="animate-spin" />}
                Send invitation
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function AdminStaffTable({ staff: initialStaff }: { staff: StaffMember[] }) {
  const [staffList, setStaffList]     = useState<StaffMember[]>(initialStaff)
  const [sortKey, setSortKey]         = useState<SortKey>('name')
  const [sortAsc, setSortAsc]         = useState(true)
  const [filter, setFilter]           = useState('')
  const [addOpen, setAddOpen]         = useState(false)
  const [inviteOpen, setInviteOpen]   = useState(false)
  const [editTarget, setEditTarget]   = useState<StaffMember | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null)
  const [toggling, setToggling]       = useState<string | null>(null)
  const [toast, setToast]             = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc(a => !a)
    else { setSortKey(k); setSortAsc(true) }
  }

  const activeCount   = staffList.filter(s => s.isActive).length
  const filteredSorted = sortStaff(
    staffList.filter(s => {
      if (!filter) return true
      const q = filter.toLowerCase()
      return (
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.department ?? '').toLowerCase().includes(q) ||
        (ROLE_LABEL[s.role] ?? s.role).toLowerCase().includes(q)
      )
    }),
    sortKey, sortAsc,
  )

  function handleAdded(s: StaffMember) {
    setStaffList(list => [s, ...list])
    setAddOpen(false)
    showToast(`${s.firstName} ${s.lastName} added`)
  }

  function handleEdited(s: StaffMember) {
    setStaffList(list => list.map(x => x.id === s.id ? s : x))
    setEditTarget(null)
    showToast('Staff member updated')
  }

  async function handleToggle(s: StaffMember) {
    setToggling(s.id)
    const res = await toggleStaffActive(s.id)
    setToggling(null)
    if (res.error) { showToast(res.error, 'error'); return }
    setStaffList(list => list.map(x => x.id === s.id ? { ...x, isActive: res.isActive! } : x))
    showToast(res.isActive ? `${s.firstName} reactivated` : `${s.firstName} deactivated`)
  }

  function handleDeleted(id: string) {
    const s = staffList.find(x => x.id === id)
    setStaffList(list => list.filter(x => x.id !== id))
    setDeleteTarget(null)
    showToast(s ? `${s.firstName} ${s.lastName} removed` : 'Staff member removed')
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <Icon name="expand_more" size="sm" className="text-gray-300" />
    return sortAsc
      ? <Icon name="expand_less" size="sm" className="text-blue-600" />
      : <Icon name="expand_more" size="sm" className="text-blue-600" />
  }

  const COLS: { k: SortKey; label: string }[] = [
    { k: 'name',       label: 'Name'       },
    { k: 'role',       label: 'Role'       },
    { k: 'department', label: 'Department' },
    { k: 'classCount', label: 'Classes'    },
  ]

  return (
    <>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-[13px] font-medium ${
          toast.type === 'success' ? 'bg-green-700 text-white' : 'bg-red-700 text-white'
        }`}>
          <Icon name={toast.type === 'success' ? 'check_circle' : 'error'} size="sm" />
          {toast.message}
        </div>
      )}

      <PageHeader
        title="Staff"
        subtitle={`${activeCount} active · ${staffList.length} total`}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const csv = toCSV(
                  ['First Name', 'Last Name', 'Email', 'Role', 'Department', 'Year Groups', 'Classes', 'Active'],
                  filteredSorted.map(s => [s.firstName, s.lastName, s.email, ROLE_LABEL[s.role] ?? s.role, s.department ?? '', (s.yearGroups ?? []).join('; '), s.classCount, s.isActive ? 'Yes' : 'No']),
                )
                downloadCSV(`staff-${new Date().toISOString().slice(0,10)}.csv`, csv)
              }}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 text-[13px] font-medium rounded-lg hover:bg-gray-50 transition"
            >
              <Icon name="download" size="sm" />
              Export CSV
            </button>
            <button
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 text-[13px] font-semibold rounded-lg hover:bg-gray-50 transition"
            >
              <Icon name="mail" size="sm" />
              Invite by email
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-[13px] font-semibold rounded-lg hover:bg-blue-700 transition"
            >
              <Icon name="add" size="sm" />
              Add staff member
            </button>
          </div>
        }
      />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Search */}
        <div className="px-5 py-3.5 border-b border-gray-100">
          <input
            type="text" value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Search by name, email, role or department…"
            className="w-full sm:w-96 px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {COLS.map(col => (
                  <th
                    key={col.k}
                    onClick={() => toggleSort(col.k)}
                    className="px-5 py-3 text-left font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-900 transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      {col.label}<SortIcon k={col.k} />
                    </span>
                  </th>
                ))}
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Year Groups</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Email</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSorted.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors group">
                  {/* Name */}
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${s.isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <span className={`font-bold text-[10px] ${s.isActive ? 'text-blue-700' : 'text-gray-400'}`}>
                          {s.firstName[0]}{s.lastName[0]}
                        </span>
                      </div>
                      <span className={s.isActive ? 'text-gray-900' : 'text-gray-400'}>
                        {s.firstName} {s.lastName}
                      </span>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-5 py-3.5">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${ROLE_COLOUR[s.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABEL[s.role] ?? s.role}
                    </span>
                  </td>

                  {/* Department */}
                  <td className="px-5 py-3.5 text-gray-500">{s.department ?? '—'}</td>

                  {/* Classes */}
                  <td className="px-5 py-3.5 font-medium text-gray-900">{s.classCount}</td>

                  {/* Year groups */}
                  <td className="px-5 py-3.5">
                    {s.yearGroups.length === 0 ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {s.yearGroups.map(yg => (
                          <span key={yg} className="text-[10px] font-semibold px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                            Y{yg}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Email */}
                  <td className="px-5 py-3.5 text-gray-400 text-[12px] max-w-[180px] truncate">{s.email}</td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      s.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Edit */}
                      <button
                        onClick={() => setEditTarget(s)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                        title="Edit"
                      >
                        <Icon name="edit" size="sm" />
                      </button>

                      {/* Deactivate / Reactivate */}
                      <button
                        onClick={() => handleToggle(s)}
                        disabled={toggling === s.id}
                        className={`p-1.5 rounded-lg transition ${
                          toggling === s.id
                            ? 'opacity-40 cursor-not-allowed'
                            : s.isActive
                              ? 'hover:bg-red-50 text-gray-400 hover:text-red-500'
                              : 'hover:bg-green-50 text-gray-400 hover:text-green-600'
                        }`}
                        title={s.isActive ? 'Deactivate account' : 'Reactivate account'}
                      >
                        {toggling === s.id
                          ? <Icon name="refresh" size="sm" className="animate-spin" />
                          : <Icon name={s.isActive ? 'person_off' : 'person'} size="sm" />
                        }
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteTarget(s)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                        title="Remove staff member"
                      >
                        <Icon name="delete" size="sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredSorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-gray-400 text-[13px]">
                    No staff found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite modal */}
      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}

      {/* Add slide-over */}
      {addOpen && (
        <StaffSlideOver mode="add" onClose={() => setAddOpen(false)} onSaved={handleAdded} />
      )}

      {/* Edit slide-over */}
      {editTarget && (
        <StaffSlideOver mode="edit" staff={editTarget} onClose={() => setEditTarget(null)} onSaved={handleEdited} />
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteModal
          staff={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => handleDeleted(deleteTarget.id)}
        />
      )}
    </>
  )
}
