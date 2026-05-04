'use client'

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import StudentAvatar from '@/components/StudentAvatar'
import type { StudentRow } from '@/app/actions/admin'
import {
  createStudent,
  updateStudent,
  toggleStudentActive,
  deleteStudent,
} from '@/app/actions/admin'

// ─── Constants ────────────────────────────────────────────────────────────────

const YEAR_OPTIONS = [7, 8, 9, 10, 11]

function genPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ─── Form state ───────────────────────────────────────────────────────────────

type FormState = {
  firstName:    string
  lastName:     string
  email:        string
  yearGroup:    string // string for select binding, parsed to number on submit
  tutorGroup:   string
  tempPassword: string
}

function blankForm(): FormState {
  return { firstName: '', lastName: '', email: '', yearGroup: '9', tutorGroup: '', tempPassword: genPassword() }
}

function formFromStudent(s: StudentRow): FormState {
  return {
    firstName:    s.firstName,
    lastName:     s.lastName,
    email:        s.email,
    yearGroup:    String(s.yearGroup ?? 9),
    tutorGroup:   s.tutorGroup ?? '',
    tempPassword: '',
  }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type Toast = { message: string; type: 'success' | 'error' }

function ToastNotification({ toast }: { toast: Toast }) {
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-[13px] font-medium ${
      toast.type === 'success' ? 'bg-green-700 text-white' : 'bg-red-700 text-white'
    }`}>
      <Icon name={toast.type === 'success' ? 'check_circle' : 'error'} size="sm" />
      {toast.message}
    </div>
  )
}

// ─── Slide-over ───────────────────────────────────────────────────────────────

function StudentSlideOver({
  mode, student, onClose, onSaved,
}: {
  mode:     'add' | 'edit'
  student?: StudentRow
  onClose:  () => void
  onSaved:  (s: StudentRow) => void
}) {
  const [form, setForm]     = useState<FormState>(mode === 'edit' && student ? formFromStudent(student) : blankForm())
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
    const yearGroup = Number(form.yearGroup)

    if (mode === 'add') {
      const res = await createStudent({
        firstName: form.firstName, lastName: form.lastName,
        email: form.email, yearGroup,
        tutorGroup: form.tutorGroup || undefined,
        temporaryPassword: form.tempPassword,
      })
      if (res.error) { setError(res.error); setSaving(false); return }
      onSaved({
        id: res.studentId!, firstName: form.firstName, lastName: form.lastName,
        email: form.email, yearGroup, tutorGroup: form.tutorGroup || null,
        className: '—', hasSend: false, avatarUrl: null, isActive: true,
      })
    } else {
      const res = await updateStudent({
        studentId: student!.id, firstName: form.firstName, lastName: form.lastName,
        email: form.email, yearGroup, tutorGroup: form.tutorGroup || undefined,
      })
      if (res.error) { setError(res.error); setSaving(false); return }
      onSaved({ ...student!, firstName: form.firstName, lastName: form.lastName,
        email: form.email, yearGroup, tutorGroup: form.tutorGroup || null })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <p className="text-[15px] font-semibold text-gray-900">
              {mode === 'add' ? 'Add student' : `Edit — ${student!.firstName} ${student!.lastName}`}
            </p>
            {mode === 'edit' && <p className="text-[12px] text-gray-400 mt-0.5">{student!.email}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <Icon name="close" size="md" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {/* Personal details */}
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Personal Details</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-gray-700">First name <span className="text-red-500">*</span></span>
                  <input required value={form.firstName} onChange={e => set('firstName', e.target.value)}
                    className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="First name" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-gray-700">Last name <span className="text-red-500">*</span></span>
                  <input required value={form.lastName} onChange={e => set('lastName', e.target.value)}
                    className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Last name" />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-medium text-gray-700">Email address <span className="text-red-500">*</span></span>
                <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="student@students.school.ac.uk" />
              </label>
            </div>

            {/* Year & tutor group */}
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Year &amp; Form</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-gray-700">Year group <span className="text-red-500">*</span></span>
                  <select required value={form.yearGroup} onChange={e => set('yearGroup', e.target.value)}
                    className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                    {YEAR_OPTIONS.map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-gray-700">Form/tutor group</span>
                  <input value={form.tutorGroup} onChange={e => set('tutorGroup', e.target.value)}
                    className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="e.g. 9A" />
                </label>
              </div>
            </div>

            {/* Temp password (add only) */}
            {mode === 'add' && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Account Setup</p>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-gray-700">Temporary password</span>
                  <div className="flex gap-2">
                    <input type="text" value={form.tempPassword} onChange={e => set('tempPassword', e.target.value)}
                      className="flex-1 px-3 py-2 text-[13px] font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    <button type="button" onClick={copyPassword}
                      className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-[12px] font-medium text-gray-500 hover:text-gray-700 transition whitespace-nowrap">
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button type="button" onClick={() => set('tempPassword', genPassword())}
                      className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition" title="Regenerate">
                      <Icon name="refresh" size="sm" />
                    </button>
                  </div>
                </label>
                <p className="text-[11px] text-gray-400 mt-1.5">Share with the student. They should change it on first sign-in.</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-[13px] text-red-700">{error}</div>
            )}
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
              {saving && <Icon name="refresh" size="sm" className="animate-spin" />}
              {mode === 'add' ? 'Add student' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete modal ─────────────────────────────────────────────────────────────

function DeleteModal({ student, onClose, onDeleted }: {
  student:   StudentRow
  onClose:   () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleDelete() {
    setError(null); setDeleting(true)
    const res = await deleteStudent(student.id)
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
            <p className="text-[14px] font-semibold text-gray-900">Remove student account?</p>
            <p className="text-[12px] text-gray-400">Their records will be preserved</p>
          </div>
        </div>
        <p className="text-[14px] font-medium text-gray-900">{student.firstName} {student.lastName}</p>
        <p className="text-[12px] text-gray-400 mb-4">{student.email}</p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
          <p className="text-[12px] text-amber-800">
            Submissions, ILP records, and SEND data will be preserved. Only login access will be removed.
          </p>
        </div>
        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[12px] text-red-700 mb-3">{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 rounded-lg py-2.5 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 text-white rounded-lg py-2.5 text-[13px] font-medium hover:bg-red-700 disabled:opacity-50 transition">
            {deleting ? 'Removing…' : 'Remove access'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function AdminStudentTable({ students: initialStudents }: { students: StudentRow[] }) {
  const [students, setStudents]         = useState<StudentRow[]>(initialStudents)
  const [activeYear, setActiveYear]     = useState<number | 'all'>('all')
  const [search, setSearch]             = useState('')
  const [addOpen, setAddOpen]           = useState(false)
  const [editTarget, setEditTarget]     = useState<StudentRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null)
  const [toggling, setToggling]         = useState<string | null>(null)
  const [toast, setToast]               = useState<Toast | null>(null)

  function showToast(message: string, type: Toast['type'] = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const filtered = students.filter(s => {
    if (activeYear !== 'all' && s.yearGroup !== activeYear) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q) ||
        (s.tutorGroup ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  function countByYear(yr: number) {
    return students.filter(s => s.yearGroup === yr).length
  }

  function handleAdded(s: StudentRow) {
    setStudents(list => [s, ...list])
    setAddOpen(false)
    showToast(`${s.firstName} ${s.lastName} added`)
  }

  function handleEdited(s: StudentRow) {
    setStudents(list => list.map(x => x.id === s.id ? s : x))
    setEditTarget(null)
    showToast('Student updated')
  }

  async function handleToggle(s: StudentRow) {
    setToggling(s.id)
    const res = await toggleStudentActive(s.id)
    setToggling(null)
    if (res.error) { showToast(res.error, 'error'); return }
    setStudents(list => list.map(x => x.id === s.id ? { ...x, isActive: res.isActive! } : x))
    showToast(res.isActive ? `${s.firstName} reactivated` : `${s.firstName} deactivated`)
  }

  function handleDeleted(id: string) {
    const s = students.find(x => x.id === id)
    setStudents(list => list.filter(x => x.id !== id))
    setDeleteTarget(null)
    showToast(s ? `${s.firstName} ${s.lastName} removed` : 'Student removed')
  }

  const activeCount = students.filter(s => s.isActive).length

  return (
    <>
      {toast && <ToastNotification toast={toast} />}

      <PageHeader
        title="Students"
        subtitle={`${activeCount} active · ${students.length} total`}
        action={
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-[13px] font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            <Icon name="add" size="sm" />
            Add student
          </button>
        }
      />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Filters */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveYear('all')}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                activeYear === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({students.length})
            </button>
            {YEAR_OPTIONS.map(yr => (
              <button key={yr} onClick={() => setActiveYear(yr)}
                className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  activeYear === yr ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Y{yr} ({countByYear(yr)})
              </button>
            ))}
          </div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, class or form…"
            className="w-52 px-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Name</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Year</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Form</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Class</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-500">SEND</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Email</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    <div className="flex items-center gap-2.5">
                      <StudentAvatar firstName={s.firstName} lastName={s.lastName} avatarUrl={s.avatarUrl} userId={s.id} size="xs" />
                      <span className={s.isActive ? 'text-gray-900' : 'text-gray-400'}>{s.firstName} {s.lastName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{s.yearGroup ? `Year ${s.yearGroup}` : '—'}</td>
                  <td className="px-5 py-3.5 text-gray-400">{s.tutorGroup ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500">{s.className}</td>
                  <td className="px-5 py-3.5">
                    {s.hasSend && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">SEND</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-[12px] max-w-[160px] truncate">{s.email}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      s.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditTarget(s)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition" title="Edit">
                        <Icon name="edit" size="sm" />
                      </button>
                      <button onClick={() => handleToggle(s)} disabled={toggling === s.id}
                        className={`p-1.5 rounded-lg transition ${toggling === s.id ? 'opacity-40 cursor-not-allowed' :
                          s.isActive ? 'hover:bg-red-50 text-gray-400 hover:text-red-500' : 'hover:bg-green-50 text-gray-400 hover:text-green-600'
                        }`}
                        title={s.isActive ? 'Deactivate' : 'Reactivate'}>
                        {toggling === s.id
                          ? <Icon name="refresh" size="sm" className="animate-spin" />
                          : <Icon name={s.isActive ? 'person_off' : 'person'} size="sm" />}
                      </button>
                      <button onClick={() => setDeleteTarget(s)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition" title="Remove">
                        <Icon name="delete" size="sm" />
                      </button>
                      <Link href="/messages" title="Message parent"
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition">
                        <Icon name="chat" size="sm" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-gray-400 text-[13px]">No students found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && <StudentSlideOver mode="add" onClose={() => setAddOpen(false)} onSaved={handleAdded} />}
      {editTarget && <StudentSlideOver mode="edit" student={editTarget} onClose={() => setEditTarget(null)} onSaved={handleEdited} />}
      {deleteTarget && <DeleteModal student={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => handleDeleted(deleteTarget.id)} />}
    </>
  )
}
