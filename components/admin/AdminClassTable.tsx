'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import type { ClassRow } from '@/app/actions/admin'
import { createClass, updateClass } from '@/app/actions/admin'

const CLASS_SUBJECTS = [
  'English', 'Maths', 'Science', 'History', 'Geography',
  'Art', 'Drama', 'Music', 'PE', 'RE', 'French', 'Spanish', 'Computing', 'Other',
]

const CLASS_DEPARTMENTS = [
  'English', 'Mathematics', 'Science', 'History', 'Geography',
  'Art', 'Drama', 'Music', 'Physical Education', 'Religious Education',
  'Modern Foreign Languages', 'Computing', 'Other',
]

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECT_COLOURS: Record<string, string> = {
  English:   'bg-blue-50 text-blue-700',
  Maths:     'bg-green-50 text-green-700',
  Science:   'bg-teal-50 text-teal-700',
  History:   'bg-amber-50 text-amber-700',
  Geography: 'bg-emerald-50 text-emerald-700',
  Art:       'bg-pink-50 text-pink-700',
  Drama:     'bg-purple-50 text-purple-700',
  Music:     'bg-rose-50 text-rose-700',
  PE:        'bg-orange-50 text-orange-700',
  RE:        'bg-indigo-50 text-indigo-700',
  French:    'bg-sky-50 text-sky-700',
  Spanish:   'bg-cyan-50 text-cyan-700',
  Computing: 'bg-violet-50 text-violet-700',
}

function subjectColour(subject: string) {
  return SUBJECT_COLOURS[subject] ?? 'bg-gray-100 text-gray-600'
}

const YEAR_OPTIONS = [7, 8, 9, 10, 11]

function genDeptFromSubject(subject: string): string {
  const map: Record<string, string> = {
    English: 'English', Maths: 'Mathematics', Science: 'Science',
    History: 'History', Geography: 'Geography', Art: 'Art', Drama: 'Drama',
    Music: 'Music', PE: 'Physical Education', RE: 'Religious Education',
    French: 'Modern Foreign Languages', Spanish: 'Modern Foreign Languages',
    Computing: 'Computing',
  }
  return map[subject] ?? 'Other'
}

// ─── Form state ───────────────────────────────────────────────────────────────

type FormState = {
  name:       string
  subject:    string
  yearGroup:  string
  department: string
}

function blankForm(): FormState {
  return { name: '', subject: 'English', yearGroup: '9', department: 'English' }
}

function formFromClass(c: ClassRow): FormState {
  return { name: c.name, subject: c.subject, yearGroup: String(c.yearGroup), department: c.department }
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

function ClassSlideOver({
  mode, cls, onClose, onSaved,
}: {
  mode:    'add' | 'edit'
  cls?:    ClassRow
  onClose: () => void
  onSaved: (c: ClassRow) => void
}) {
  const [form, setForm]     = useState<FormState>(mode === 'edit' && cls ? formFromClass(cls) : blankForm())
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  function set(k: keyof FormState, v: string) {
    setForm(f => {
      const next = { ...f, [k]: v }
      // Auto-fill department when subject changes (add mode)
      if (k === 'subject' && mode === 'add') next.department = genDeptFromSubject(v)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSaving(true)
    const yearGroup = Number(form.yearGroup)

    if (mode === 'add') {
      const res = await createClass({ name: form.name, subject: form.subject, yearGroup, department: form.department })
      if (res.error) { setError(res.error); setSaving(false); return }
      onSaved({
        id: res.classId!, name: form.name, subject: form.subject,
        yearGroup, department: form.department, studentCount: 0, teacherNames: [],
      })
    } else {
      const res = await updateClass({ classId: cls!.id, name: form.name, subject: form.subject, yearGroup, department: form.department })
      if (res.error) { setError(res.error); setSaving(false); return }
      onSaved({ ...cls!, name: form.name, subject: form.subject, yearGroup, department: form.department })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <p className="text-[15px] font-semibold text-gray-900">
              {mode === 'add' ? 'Create class' : `Edit — ${cls!.name}`}
            </p>
            {mode === 'edit' && <p className="text-[12px] text-gray-400 mt-0.5">{cls!.subject} · Year {cls!.yearGroup}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <Icon name="close" size="md" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Class Details</p>
              <div className="space-y-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-gray-700">Class name <span className="text-red-500">*</span></span>
                  <input required value={form.name} onChange={e => set('name', e.target.value)}
                    className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="e.g. 9E/En1" />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-gray-700">Subject <span className="text-red-500">*</span></span>
                    <select required value={form.subject} onChange={e => set('subject', e.target.value)}
                      className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                      {CLASS_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] font-medium text-gray-700">Year group <span className="text-red-500">*</span></span>
                    <select required value={form.yearGroup} onChange={e => set('yearGroup', e.target.value)}
                      className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                      {YEAR_OPTIONS.map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                  </label>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-gray-700">Department <span className="text-red-500">*</span></span>
                  <select required value={form.department} onChange={e => set('department', e.target.value)}
                    className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                    {CLASS_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {mode === 'edit' && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-[12px] text-blue-700">
                  <strong>Teacher assignment</strong> is managed from each teacher's profile. Students are enrolled via the class roster on the Classes page.
                </p>
              </div>
            )}

            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-[13px] text-red-700">{error}</div>}
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
              {saving && <Icon name="refresh" size="sm" className="animate-spin" />}
              {mode === 'add' ? 'Create class' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function AdminClassTable({ classes: initialClasses }: { classes: ClassRow[] }) {
  const [classList, setClassList]     = useState<ClassRow[]>(initialClasses)
  const [search, setSearch]           = useState('')
  const [yearFilter, setYearFilter]   = useState<number | 'all'>('all')
  const [addOpen, setAddOpen]         = useState(false)
  const [editTarget, setEditTarget]   = useState<ClassRow | null>(null)
  const [toast, setToast]             = useState<Toast | null>(null)

  function showToast(message: string, type: Toast['type'] = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const years = [...new Set(classList.map(c => c.yearGroup))].sort((a, b) => a - b)

  const filtered = classList.filter(c => {
    if (yearFilter !== 'all' && c.yearGroup !== yearFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        c.name.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        c.department.toLowerCase().includes(q) ||
        c.teacherNames.join(' ').toLowerCase().includes(q)
      )
    }
    return true
  })

  function handleAdded(c: ClassRow) {
    setClassList(list => [c, ...list])
    setAddOpen(false)
    showToast(`${c.name} created`)
  }

  function handleEdited(c: ClassRow) {
    setClassList(list => list.map(x => x.id === c.id ? c : x))
    setEditTarget(null)
    showToast(`${c.name} updated`)
  }

  return (
    <>
      {toast && <ToastNotification toast={toast} />}

      <PageHeader
        title="Classes"
        subtitle={`${classList.length} classes`}
        action={
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-[13px] font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            <Icon name="add" size="sm" />
            Create class
          </button>
        }
      />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search classes, subjects, teachers…"
            className="w-64 px-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <select value={yearFilter}
            onChange={e => setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200">
            <option value="all">All year groups</option>
            {years.map(y => <option key={y} value={y}>Year {y}</option>)}
          </select>
          <span className="text-[12px] text-gray-400">{filtered.length} classes</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Class</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Subject</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Year</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Teacher(s)</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Students</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Department</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-5 py-3.5 font-semibold text-gray-900">{c.name}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${subjectColour(c.subject)}`}>
                      {c.subject}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">Year {c.yearGroup}</td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {c.teacherNames.length > 0 ? c.teacherNames.join(', ') : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-gray-900">{c.studentCount}</td>
                  <td className="px-5 py-3.5 text-gray-400">{c.department}</td>
                  <td className="px-4 py-3.5">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditTarget(c)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition" title="Edit class">
                        <Icon name="edit" size="sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-400 text-[13px]">No classes found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && <ClassSlideOver mode="add" onClose={() => setAddOpen(false)} onSaved={handleAdded} />}
      {editTarget && <ClassSlideOver mode="edit" cls={editTarget} onClose={() => setEditTarget(null)} onSaved={handleEdited} />}
    </>
  )
}
