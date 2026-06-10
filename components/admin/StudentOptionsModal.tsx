'use client'

import { useState, useEffect, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import {
  getStudentSubjects,
  setStudentSubjects,
  getClassesForSubject,
  type SubjectClassOption,
} from '@/app/actions/admin'

// ─── Subject lists ─────────────────────────────────────────────────────────────

const CORE_SUBJECTS = ['English', 'Mathematics', 'Science']

const OPTION_SUBJECTS = [
  'History', 'Geography', 'French', 'Spanish', 'German',
  'Art', 'Drama', 'Music', 'PE', 'Computing', 'RE',
  'Business Studies', 'Design & Technology', 'Food Technology',
  'Psychology', 'Sociology', 'Economics', 'Politics',
  'Further Mathematics', 'Media Studies', 'Film Studies',
]

const LEVELS = ['GCSE', 'A-Level', 'BTEC', 'Other']

// ─── Types ─────────────────────────────────────────────────────────────────────

type SubjectEntry = {
  subject:         string
  isCore:          boolean
  level:           string | null
  assignedClassId: string | null
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function StudentOptionsModal({
  studentId,
  studentName,
  yearGroup,
  onClose,
  onSaved,
}: {
  studentId:   string
  studentName: string
  yearGroup:   number | null
  onClose:     () => void
  onSaved:     () => void
}) {
  const [entries,  setEntries]  = useState<SubjectEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [classMap, setClassMap] = useState<Record<string, SubjectClassOption[]>>({})
  const [pending,  startT]      = useTransition()

  // ── Load existing subject choices ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getStudentSubjects(studentId).then(rows => {
      if (cancelled) return
      if (rows.length === 0) {
        // Default: all core subjects pre-selected
        setEntries(CORE_SUBJECTS.map(s => ({
          subject: s, isCore: true, level: 'GCSE', assignedClassId: null,
        })))
      } else {
        setEntries(rows.map(r => ({
          subject:         r.subject,
          isCore:          r.isCore,
          level:           r.level,
          assignedClassId: r.assignedClassId,
        })))
        // Pre-load class options for each selected subject
        rows.forEach(r => loadClassOptions(r.subject))
      }
      setLoading(false)
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  async function loadClassOptions(subject: string) {
    if (classMap[subject]) return
    const yr = yearGroup ?? 10
    const classes = await getClassesForSubject(subject, yr)
    setClassMap(prev => ({ ...prev, [subject]: classes }))
  }

  // ── Toggle subject on/off ──────────────────────────────────────────────────
  function toggleSubject(subject: string, isCore: boolean) {
    setEntries(prev => {
      const exists = prev.find(e => e.subject === subject)
      if (exists) {
        if (isCore) return prev // cannot remove core subjects
        return prev.filter(e => e.subject !== subject)
      }
      loadClassOptions(subject)
      return [...prev, { subject, isCore, level: 'GCSE', assignedClassId: null }]
    })
  }

  function setLevel(subject: string, level: string) {
    setEntries(prev => prev.map(e => e.subject === subject ? { ...e, level } : e))
  }

  function setClass(subject: string, classId: string) {
    setEntries(prev => prev.map(e => e.subject === subject ? { ...e, assignedClassId: classId || null } : e))
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  function handleSave() {
    setError(null)
    startT(async () => {
      const res = await setStudentSubjects(studentId, entries)
      if (!res.success) { setError(res.error ?? 'Failed to save'); return }
      onSaved()
      onClose()
    })
  }

  const selectedSubjects = new Set(entries.map(e => e.subject))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Subject options</h2>
            <p className="text-[12px] text-gray-400 mt-0.5">{studentName}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <Icon name="close" size="sm" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
              <Icon name="refresh" size="sm" className="animate-spin" />
              <span className="text-[13px]">Loading…</span>
            </div>
          ) : (
            <>
              {/* Core subjects — always selected */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">
                  Core subjects (compulsory)
                </p>
                <div className="space-y-2">
                  {CORE_SUBJECTS.map(subject => {
                    const entry = entries.find(e => e.subject === subject)
                    const classes = classMap[subject] ?? []
                    return (
                      <SubjectRow
                        key={subject}
                        subject={subject}
                        isCore
                        selected
                        locked
                        level={entry?.level ?? 'GCSE'}
                        assignedClassId={entry?.assignedClassId ?? null}
                        classes={classes}
                        onLevel={lv => setLevel(subject, lv)}
                        onClass={cid => setClass(subject, cid)}
                        onToggle={() => {}}
                        onFocus={() => loadClassOptions(subject)}
                      />
                    )
                  })}
                </div>
              </div>

              {/* Option subjects */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">
                  Option subjects — tick to add
                </p>
                <div className="space-y-2">
                  {OPTION_SUBJECTS.map(subject => {
                    const selected = selectedSubjects.has(subject)
                    const entry    = entries.find(e => e.subject === subject)
                    const classes  = classMap[subject] ?? []
                    return (
                      <SubjectRow
                        key={subject}
                        subject={subject}
                        isCore={false}
                        selected={selected}
                        locked={false}
                        level={entry?.level ?? 'GCSE'}
                        assignedClassId={entry?.assignedClassId ?? null}
                        classes={classes}
                        onLevel={lv => setLevel(subject, lv)}
                        onClass={cid => setClass(subject, cid)}
                        onToggle={() => toggleSubject(subject, false)}
                        onFocus={() => loadClassOptions(subject)}
                      />
                    )
                  })}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[12px] text-red-700">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={pending || loading}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-semibold transition"
          >
            {pending && <Icon name="refresh" size="sm" className="animate-spin" />}
            Save options ({entries.length} subject{entries.length !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SubjectRow sub-component ─────────────────────────────────────────────────

function SubjectRow({
  subject, isCore, selected, locked,
  level, assignedClassId, classes,
  onLevel, onClass, onToggle, onFocus,
}: {
  subject:         string
  isCore:          boolean
  selected:        boolean
  locked:          boolean
  level:           string
  assignedClassId: string | null
  classes:         SubjectClassOption[]
  onLevel:         (v: string) => void
  onClass:         (v: string) => void
  onToggle:        () => void
  onFocus:         () => void
}) {
  return (
    <div className={`rounded-xl border transition-colors ${
      selected ? 'border-blue-200 bg-blue-50/50' : 'border-gray-100 bg-gray-50/50'
    }`}>
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Checkbox */}
        <button
          type="button"
          onClick={onToggle}
          disabled={locked}
          className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition ${
            selected
              ? 'bg-blue-600 text-white'
              : 'border-2 border-gray-300 hover:border-blue-400'
          } ${locked ? 'opacity-60 cursor-default' : ''}`}
          aria-label={selected ? `Remove ${subject}` : `Add ${subject}`}
        >
          {selected && <Icon name="check" size="sm" />}
        </button>

        {/* Subject name */}
        <span className={`text-[13px] font-medium flex-1 ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {subject}
          {isCore && (
            <span className="ml-2 text-[10px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">core</span>
          )}
        </span>

        {/* Level + class dropdowns — only when selected */}
        {selected && (
          <div className="flex items-center gap-2">
            <select
              value={level ?? 'GCSE'}
              onChange={e => onLevel(e.target.value)}
              className="text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
            >
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select
              value={assignedClassId ?? ''}
              onChange={e => onClass(e.target.value)}
              onFocus={onFocus}
              className="text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white min-w-[120px]"
            >
              <option value="">No class set</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
