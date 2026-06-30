'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import type { ClassRow, ClassDetailForAdmin } from '@/app/actions/admin'
import {
  createClass, updateClass,
  getClassDetail, assignTeacherToClass, removeTeacherFromClass,
  addStudentToClass, removeStudentFromClass,
  getStaffMembers, getStudentList,
} from '@/app/actions/admin'

const CLASS_SUBJECTS = [
  'English', 'Maths', 'Science', 'History', 'Geography',
  'Art', 'Drama', 'Music', 'PE', 'RE', 'French', 'Spanish', 'Computing', 'Other',
]

const CLASS_DEPARTMENTS = [
  'English', 'Mathematics', 'Science', 'History', 'Geography',
  'Art', 'Drama', 'Music', 'Physical Education', 'Religious Education',
  'Modern Foreign Languages', 'Computing', 'Other',
]

const UK_EXAM_BOARDS = [
  'AQA', 'Edexcel', 'OCR', 'WJEC', 'Eduqas', 'CCEA',
  'Cambridge International', 'iGCSE (Pearson)', 'iGCSE (Cambridge)',
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
  name:        string
  subject:     string
  yearGroup:   string
  department:  string
  examBoard:   string
  modulesInput: string
}

function blankForm(): FormState {
  return { name: '', subject: 'English', yearGroup: '9', department: 'English', examBoard: '', modulesInput: '' }
}

function formFromClass(c: ClassRow): FormState {
  return {
    name: c.name, subject: c.subject, yearGroup: String(c.yearGroup), department: c.department,
    examBoard: c.examBoard ?? '', modulesInput: (c.examModules ?? []).join(', '),
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
    const yearGroup    = Number(form.yearGroup)
    const examBoard    = form.examBoard || undefined
    const examModules  = form.modulesInput.split(',').map(s => s.trim()).filter(Boolean)

    if (mode === 'add') {
      const res = await createClass({ name: form.name, subject: form.subject, yearGroup, department: form.department, examBoard, examModules })
      if (res.error) { setError(res.error); setSaving(false); return }
      onSaved({
        id: res.classId!, name: form.name, subject: form.subject,
        yearGroup, department: form.department, examBoard: examBoard ?? null, examModules, studentCount: 0, teacherNames: [],
      })
    } else {
      const res = await updateClass({ classId: cls!.id, name: form.name, subject: form.subject, yearGroup, department: form.department, examBoard, examModules })
      if (res.error) { setError(res.error); setSaving(false); return }
      onSaved({ ...cls!, name: form.name, subject: form.subject, yearGroup, department: form.department, examBoard: examBoard ?? null, examModules })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Class details" className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <p className="text-[15px] font-semibold text-gray-900">
              {mode === 'add' ? 'Create class' : `Edit — ${cls!.name}`}
            </p>
            {mode === 'edit' && <p className="text-[12px] text-gray-400 mt-0.5">{cls!.subject} · Year {cls!.yearGroup}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
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

            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Exam Board</p>
              <div className="space-y-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-gray-700">Examination board</span>
                  <select value={form.examBoard} onChange={e => set('examBoard', e.target.value)}
                    className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                    <option value="">— Not set —</option>
                    {UK_EXAM_BOARDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-gray-700">Required modules</span>
                  <input value={form.modulesInput} onChange={e => set('modulesInput', e.target.value)}
                    placeholder="e.g. Paper 1: Language, Paper 2: Literature"
                    className="px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  <span className="text-[11px] text-gray-400">Comma-separated. Used for AI mark scheme context.</span>
                </label>
              </div>
            </div>

            {mode === 'edit' && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-[12px] text-blue-700">
                  <strong>Teacher assignment</strong> is managed from each teacher&apos;s profile. Students are enrolled via the class roster on the Classes page.
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

// ─── Class manage panel ────────────────────────────────────────────────────────

function ClassManagePanel({ classId, onStudentCountChange }: { classId: string; onStudentCountChange: (delta: number) => void }) {
  const [detail,      setDetail]      = useState<ClassDetailForAdmin | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [loaded,      setLoaded]      = useState(false)
  const [staffSearch, setStaffSearch] = useState('')
  const [stuSearch,   setStuSearch]   = useState('')
  const [staffPool,   setStaffPool]   = useState<{ id: string; firstName: string; lastName: string; role: string }[]>([])
  const [stuPool,     setStuPool]     = useState<{ id: string; firstName: string; lastName: string; yearGroup: number | null }[]>([])
  const [busy,        setBusy]        = useState<string | null>(null)
  const [error,       setError]       = useState<string | null>(null)

  async function load() {
    if (loaded) return
    setLoading(true)
    const [d, staff, students] = await Promise.all([
      getClassDetail(classId),
      getStaffMembers(),
      getStudentList(),
    ])
    setDetail(d)
    setStaffPool(staff.map(s => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, role: s.role })))
    setStuPool(students.map(s => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, yearGroup: s.yearGroup })))
    setLoaded(true)
    setLoading(false)
  }

  async function handleAssignTeacher(userId: string) {
    setBusy(userId); setError(null)
    const r = await assignTeacherToClass(classId, userId)
    if (r.error) { setError(r.error); setBusy(null); return }
    const t = staffPool.find(s => s.id === userId)!
    setDetail(d => d ? { ...d, teachers: [...d.teachers, t] } : d)
    setBusy(null)
  }

  async function handleRemoveTeacher(userId: string) {
    setBusy(userId); setError(null)
    const r = await removeTeacherFromClass(classId, userId)
    if (r.error) { setError(r.error); setBusy(null); return }
    setDetail(d => d ? { ...d, teachers: d.teachers.filter(t => t.id !== userId) } : d)
    setBusy(null)
  }

  async function handleAddStudent(studentId: string) {
    setBusy(studentId); setError(null)
    const r = await addStudentToClass(classId, studentId)
    if (r.error) { setError(r.error); setBusy(null); return }
    const s = stuPool.find(x => x.id === studentId)!
    setDetail(d => d ? { ...d, students: [...d.students, s] } : d)
    onStudentCountChange(1)
    setBusy(null)
  }

  async function handleRemoveStudent(studentId: string) {
    setBusy(studentId); setError(null)
    const r = await removeStudentFromClass(classId, studentId)
    if (r.error) { setError(r.error); setBusy(null); return }
    setDetail(d => d ? { ...d, students: d.students.filter(s => s.id !== studentId) } : d)
    onStudentCountChange(-1)
    setBusy(null)
  }

  // Auto-load on mount
  if (!loaded && !loading) { void load() }

  if (loading) return (
    <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-2 text-[12px] text-gray-400">
      <Icon name="refresh" size="sm" className="animate-spin" /> Loading…
    </div>
  )
  if (!detail) return null

  const enrolledIds     = new Set(detail.students.map(s => s.id))
  const teacherIds      = new Set(detail.teachers.map(t => t.id))
  const availableStaff  = staffPool.filter(s => !teacherIds.has(s.id) &&
    (!staffSearch || `${s.firstName} ${s.lastName}`.toLowerCase().includes(staffSearch.toLowerCase())))
  const availableStudents = stuPool.filter(s => !enrolledIds.has(s.id) &&
    (!stuSearch || `${s.firstName} ${s.lastName}`.toLowerCase().includes(stuSearch.toLowerCase())))

  return (
    <tr>
      <td colSpan={8} className="border-t border-gray-100 bg-gray-50/50 px-5 py-4">
        {error && <p className="text-[12px] text-red-600 mb-3">{error}</p>}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Teachers */}
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Teachers ({detail.teachers.length})</p>
            <div className="space-y-1 mb-3">
              {detail.teachers.map(t => (
                <div key={t.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                  <span className="text-[13px] text-gray-800">{t.firstName} {t.lastName}</span>
                  <button onClick={() => handleRemoveTeacher(t.id)} disabled={busy === t.id}
                    className="text-[11px] text-red-500 hover:text-red-700 disabled:opacity-40 transition">
                    {busy === t.id ? '…' : 'Remove'}
                  </button>
                </div>
              ))}
              {detail.teachers.length === 0 && <p className="text-[12px] text-gray-400 italic">No teachers assigned</p>}
            </div>
            <input value={staffSearch} onChange={e => setStaffSearch(e.target.value)}
              placeholder="Search staff to add…"
              className="w-full px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 mb-1.5" />
            <div className="max-h-36 overflow-y-auto space-y-1">
              {availableStaff.slice(0, 8).map(s => (
                <button key={s.id} onClick={() => handleAssignTeacher(s.id)} disabled={busy === s.id}
                  className="w-full text-left flex items-center justify-between px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 disabled:opacity-40 text-[12px] transition">
                  <span>{s.firstName} {s.lastName} <span className="text-gray-400">· {s.role.replace(/_/g,' ')}</span></span>
                  <Icon name="add" size="sm" className="text-blue-500" />
                </button>
              ))}
              {availableStaff.length === 0 && staffSearch && <p className="text-[11px] text-gray-400 italic px-1">No matches</p>}
            </div>
          </div>

          {/* Students */}
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Students ({detail.students.length})</p>
            <div className="space-y-1 mb-3 max-h-36 overflow-y-auto">
              {detail.students.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                  <span className="text-[13px] text-gray-800">{s.firstName} {s.lastName}{s.yearGroup ? ` · Y${s.yearGroup}` : ''}</span>
                  <button onClick={() => handleRemoveStudent(s.id)} disabled={busy === s.id}
                    className="text-[11px] text-red-500 hover:text-red-700 disabled:opacity-40 transition">
                    {busy === s.id ? '…' : 'Remove'}
                  </button>
                </div>
              ))}
              {detail.students.length === 0 && <p className="text-[12px] text-gray-400 italic">No students enrolled</p>}
            </div>
            <input value={stuSearch} onChange={e => setStuSearch(e.target.value)}
              placeholder="Search students to add…"
              className="w-full px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 mb-1.5" />
            <div className="max-h-36 overflow-y-auto space-y-1">
              {availableStudents.slice(0, 8).map(s => (
                <button key={s.id} onClick={() => handleAddStudent(s.id)} disabled={busy === s.id}
                  className="w-full text-left flex items-center justify-between px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 disabled:opacity-40 text-[12px] transition">
                  <span>{s.firstName} {s.lastName}{s.yearGroup ? ` · Y${s.yearGroup}` : ''}</span>
                  <Icon name="add" size="sm" className="text-blue-500" />
                </button>
              ))}
              {availableStudents.length === 0 && stuSearch && <p className="text-[11px] text-gray-400 italic px-1">No matches</p>}
            </div>
          </div>
        </div>
      </td>
    </tr>
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
  const [expandedId, setExpandedId]   = useState<string | null>(null)

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
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Exam Board</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-500">Department</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.flatMap(c => {
                const isExpanded = expandedId === c.id
                return [
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
                    <td className="px-5 py-3.5">
                      {c.examBoard
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{c.examBoard}</span>
                        : <span className="text-gray-300 text-[12px]">—</span>
                      }
                    </td>
                    <td className="px-5 py-3.5 text-gray-400">{c.department}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditTarget(c)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition" title="Edit class">
                          <Icon name="edit" size="sm" />
                        </button>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                          className={`p-1.5 rounded-lg transition text-gray-400 ${isExpanded ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 hover:text-gray-600'}`}
                          title="Manage teachers & students"
                        >
                          <Icon name={isExpanded ? 'expand_less' : 'manage_accounts'} size="sm" />
                        </button>
                      </div>
                    </td>
                  </tr>,
                  isExpanded && (
                    <ClassManagePanel
                      key={`manage-${c.id}`}
                      classId={c.id}
                      onStudentCountChange={delta => setClassList(list => list.map(x => x.id === c.id ? { ...x, studentCount: x.studentCount + delta } : x))}
                    />
                  ),
                ].filter(Boolean)
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-gray-400 text-[13px]">No classes found</td>
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
