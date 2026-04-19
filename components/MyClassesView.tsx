'use client'
import { useState, useTransition } from 'react'
import ClassRosterTab from '@/components/ClassRosterTab'
import Icon from '@/components/ui/Icon'
import { bulkGenerateLearningPassports } from '@/app/actions/students'

type ClassOption = { id: string; name: string; subject: string; yearGroup: number }

export default function MyClassesView({ classes, role }: { classes: ClassOption[]; role: string }) {
  const [selectedId,    setSelectedId]    = useState<string>(classes[0]?.id ?? '')
  const [subjectFilter, setSubjectFilter] = useState<string>('All')
  const [yearFilter,    setYearFilter]    = useState<number | 'All'>('All')
  const [generating,    startGenerate]    = useTransition()
  const [genResult,     setGenResult]     = useState<{ generated: number; errors: number } | null>(null)

  if (classes.length === 0) {
    return (
      <p className="text-[13px] text-gray-400 text-center py-16">
        No classes assigned to your account yet.
      </p>
    )
  }

  // ── Filter chains ────────────────────────────────────────────────────────────
  const subjects = ['All', ...Array.from(new Set(classes.map(c => c.subject))).sort()]

  const classesForSubject = subjectFilter === 'All' ? classes : classes.filter(c => c.subject === subjectFilter)

  const yearGroups: Array<number | 'All'> = [
    'All',
    ...Array.from(new Set(classesForSubject.map(c => c.yearGroup))).sort((a, b) => a - b),
  ]

  const visibleClasses = classesForSubject.filter(c =>
    yearFilter === 'All' || c.yearGroup === yearFilter,
  )

  function handleSubjectChange(s: string) {
    setSubjectFilter(s)
    setYearFilter('All')
    const newVisible = s === 'All' ? classes : classes.filter(c => c.subject === s)
    if (!newVisible.find(c => c.id === selectedId)) {
      setSelectedId(newVisible[0]?.id ?? '')
    }
  }

  function handleYearChange(y: number | 'All') {
    setYearFilter(y)
    const newVisible = classesForSubject.filter(c => y === 'All' || c.yearGroup === y)
    if (!newVisible.find(c => c.id === selectedId)) {
      setSelectedId(newVisible[0]?.id ?? '')
    }
  }

  return (
    <div className="space-y-3">

      {/* ── Filters row: Subject + Year dropdowns ── */}
      {(subjects.length > 2 || yearGroups.length > 2) && (
        <div className="flex flex-wrap items-center gap-2">
          {subjects.length > 2 && (
            <select
              value={subjectFilter}
              onChange={e => handleSubjectChange(e.target.value)}
              className="text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {subjects.map(s => (
                <option key={s} value={s}>{s === 'All' ? 'All subjects' : s}</option>
              ))}
            </select>
          )}
          {yearGroups.length > 2 && (
            <select
              value={String(yearFilter)}
              onChange={e => handleYearChange(e.target.value === 'All' ? 'All' : Number(e.target.value))}
              className="text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {yearGroups.map(y => (
                <option key={String(y)} value={String(y)}>{y === 'All' ? 'All years' : `Year ${y}`}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ── Class pills + generate button ── */}
      <div className="flex flex-wrap items-center gap-2">
        {visibleClasses.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedId(c.id)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
              selectedId === c.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {c.name}
          </button>
        ))}
        {/* Generate Learning Passports for selected class */}
        {selectedId && (
          <button
            type="button"
            disabled={generating}
            onClick={() => startGenerate(async () => {
              const r = await bulkGenerateLearningPassports(selectedId)
              setGenResult(r)
            })}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full transition disabled:opacity-50"
            title="Auto-generate Learning Passports for all students in this class using AI"
          >
            <Icon name={generating ? 'refresh' : 'auto_awesome'} size="sm" className={generating ? 'animate-spin' : ''} />
            {generating ? 'Generating…' : 'Generate passports'}
          </button>
        )}
      </div>

      {genResult && (
        <p className="text-[11px] text-indigo-600">
          Generated {genResult.generated} Learning Passports{genResult.errors > 0 ? `, ${genResult.errors} failed` : ''}.
        </p>
      )}

      {/* ── Roster for selected class ── */}
      {selectedId && (
        <ClassRosterTab key={selectedId} classId={selectedId} />
      )}
    </div>
  )
}
