'use client'
import { useState, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { saveSubjectConfig, applySubjectConfigToAllClasses, type SubjectConfigRow } from '@/app/actions/admin'

const UK_EXAM_BOARDS = ['AQA', 'Edexcel', 'OCR', 'WJEC', 'Eduqas', 'CCEA', 'Cambridge International', 'iGCSE (Pearson)', 'iGCSE (Cambridge)', 'Other']
const TIERS = ['', 'Foundation', 'Higher', 'Foundation & Higher']

type Props = {
  configs:  SubjectConfigRow[]
  canEdit:  boolean
  role:     string
}

export default function SubjectConfigPanel({ configs: initial, canEdit, role }: Props) {
  const [rows,     setRows]     = useState(initial)
  const [editing,  setEditing]  = useState<string | null>(null)  // subject being edited
  const [form,     setForm]     = useState({ examBoard: '', tier: '' })
  const [saving,   startSave]   = useTransition()
  const [applying, startApply]  = useTransition()
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  const canApplyAll = ['SCHOOL_ADMIN', 'SLT'].includes(role)

  function startEdit(row: SubjectConfigRow) {
    setEditing(row.subject)
    setForm({ examBoard: row.examBoard ?? '', tier: row.tier ?? '' })
  }

  function handleSave(subject: string) {
    startSave(async () => {
      const r = await saveSubjectConfig({ subject, examBoard: form.examBoard, tier: form.tier })
      if (r.ok) {
        setRows(prev => prev.map(row =>
          row.subject === subject
            ? { ...row, examBoard: form.examBoard || null, tier: form.tier || null, updatedAt: new Date().toISOString() }
            : row
        ))
        setFeedback(f => ({ ...f, [subject]: 'Saved' }))
        setTimeout(() => setFeedback(f => { const n = { ...f }; delete n[subject]; return n }), 3000)
      } else {
        setFeedback(f => ({ ...f, [subject]: r.error ?? 'Error' }))
      }
      setEditing(null)
    })
  }

  function handleApplyAll(row: SubjectConfigRow) {
    if (!row.examBoard) return
    if (!confirm(`Apply "${row.examBoard}" to ALL ${row.subject} classes, overwriting any existing settings?`)) return
    startApply(async () => {
      const r = await applySubjectConfigToAllClasses({ subject: row.subject, examBoard: row.examBoard! })
      setFeedback(f => ({ ...f, [row.subject]: `Applied to ${r.updated} class${r.updated !== 1 ? 'es' : ''}` }))
      setTimeout(() => setFeedback(f => { const n = { ...f }; delete n[row.subject]; return n }), 4000)
    })
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
        <Icon name="school" size="lg" className="text-gray-300 mb-3" />
        <p className="text-[13px] text-gray-500">No subjects found. Classes will appear here once synced from MIS.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">{rows.length} subject{rows.length !== 1 ? 's' : ''}</p>
        {canEdit && (
          <p className="text-[11px] text-gray-400">
            {canApplyAll ? 'Set default or apply to all classes' : 'Set default exam board for your subjects'}
          </p>
        )}
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Subject</th>
            <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Exam Board</th>
            <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Tier</th>
            <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Classes</th>
            {canEdit && <th className="px-5 py-2.5" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map(row => (
            <tr key={row.subject} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-5 py-3">
                <span className="text-[13px] font-medium text-gray-900">{row.subject}</span>
              </td>

              <td className="px-5 py-3">
                {editing === row.subject ? (
                  <select
                    value={form.examBoard}
                    onChange={e => setForm(f => ({ ...f, examBoard: e.target.value }))}
                    className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-48"
                  >
                    <option value="">— Not set —</option>
                    {UK_EXAM_BOARDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                ) : row.examBoard ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                    {row.examBoard}
                  </span>
                ) : (
                  <span className="text-[12px] text-gray-400 italic">Not set</span>
                )}
                {feedback[row.subject] && (
                  <span className="ml-2 text-[11px] text-green-600 font-medium">{feedback[row.subject]}</span>
                )}
              </td>

              <td className="px-5 py-3">
                {editing === row.subject ? (
                  <select
                    value={form.tier}
                    onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}
                    className="text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {TIERS.map(t => <option key={t} value={t}>{t || '— Not set —'}</option>)}
                  </select>
                ) : row.tier ? (
                  <span className="text-[12px] text-gray-600">{row.tier}</span>
                ) : (
                  <span className="text-[12px] text-gray-400">—</span>
                )}
              </td>

              <td className="px-5 py-3">
                <span className="text-[12px] text-gray-500">{row.classCount}</span>
              </td>

              {canEdit && (
                <td className="px-5 py-3">
                  {editing === row.subject ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSave(row.subject)}
                        disabled={saving}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-[11px] font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                      >
                        {saving ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="check" size="sm" />}
                        Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="text-[11px] text-gray-500 hover:text-gray-700 px-2 py-1.5"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(row)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 hover:text-blue-700 border border-gray-200 hover:border-blue-300 rounded-lg px-2.5 py-1 transition"
                      >
                        <Icon name="edit" size="sm" />
                        Edit
                      </button>
                      {canApplyAll && row.examBoard && (
                        <button
                          onClick={() => handleApplyAll(row)}
                          disabled={applying}
                          title={`Apply ${row.examBoard} to all ${row.subject} classes`}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 rounded-lg px-2.5 py-1 transition disabled:opacity-50"
                        >
                          <Icon name="sync" size="sm" />
                          Apply all
                        </button>
                      )}
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/30">
        <p className="text-[11px] text-gray-400">
          Setting a default here auto-fills new classes and is used in AI homework generation, marking, and grade suggestions.
          {canApplyAll && ' "Apply all" overwrites the exam board on every class in that subject.'}
        </p>
      </div>
    </div>
  )
}
