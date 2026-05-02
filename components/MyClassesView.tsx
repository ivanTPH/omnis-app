'use client'
import { useState, useTransition, useCallback } from 'react'
import ClassRosterTab from '@/components/ClassRosterTab'
import Icon from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { bulkGenerateLearningPassports, generatePassportsForStudents } from '@/app/actions/students'

type ClassOption = { id: string; name: string; subject: string; yearGroup: number }

export default function MyClassesView({ classes, role }: { classes: ClassOption[]; role: string }) {
  const [subject,     setSubject]     = useState('')
  const [year,        setYear]        = useState('')
  const [selectedId,  setSelectedId]  = useState('')
  const [search,      setSearch]      = useState('')
  const [generating,  startGenerate]  = useTransition()
  const [genResult,   setGenResult]   = useState<{ created: number; skipped: number; errors: number } | null>(null)
  const [rosterSelectedIds, setRosterSelectedIds] = useState<string[]>([])

  const handleSelectionChange = useCallback((ids: string[]) => {
    setRosterSelectedIds(ids)
  }, [])

  if (classes.length === 0) {
    return (
      <EmptyState
        icon="groups"
        title="No classes assigned"
        description="Classes are synced from your MIS. Contact your administrator if this looks wrong."
        size="md"
      />
    )
  }

  // ── Derived options ──────────────────────────────────────────────────────────
  const subjects = ([...new Set(classes.map(c => c.subject))] as string[]).sort()
  const years    = ([...new Set(classes.map(c => c.yearGroup))] as number[]).sort((a, b) => a - b)

  // Classes narrowed by subject + year
  const filteredClasses = classes.filter(c =>
    (!subject || c.subject === subject) &&
    (!year    || c.yearGroup === Number(year)),
  )

  // Effective selection: explicit or first in filtered list
  const effectiveId = selectedId && filteredClasses.find(c => c.id === selectedId)
    ? selectedId
    : filteredClasses[0]?.id ?? ''

  // ── Chips ─────────────────────────────────────────────────────────────────────
  const chips = [
    subject && { key: 'subject', label: subject,           clear: () => { setSubject(''); setSelectedId('') } },
    year    && { key: 'year',    label: `Year ${year}`,     clear: () => { setYear('');    setSelectedId('') } },
    search  && { key: 'search',  label: `"${search}"`,      clear: () => setSearch('') },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[]

  return (
    <div className="space-y-4">

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

          {/* Subject */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
              Subject
            </label>
            <select
              value={subject}
              onChange={e => { setSubject(e.target.value); setSelectedId('') }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Year Group */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
              Year Group
            </label>
            <select
              value={year}
              onChange={e => { setYear(e.target.value); setSelectedId('') }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
              Class
            </label>
            <select
              value={effectiveId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[12px] bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Generate passports */}
          <div className="flex flex-col justify-end">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1 opacity-0 select-none">
              Actions
            </label>
            {rosterSelectedIds.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500">
                  {rosterSelectedIds.length} selected
                </span>
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => startGenerate(async () => {
                    setGenResult(null)
                    const r = await generatePassportsForStudents(rosterSelectedIds)
                    setGenResult(r)
                    setRosterSelectedIds([])
                  })}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition disabled:opacity-50"
                >
                  <Icon name={generating ? 'refresh' : 'auto_awesome'} size="sm" className={generating ? 'animate-spin' : ''} />
                  {generating ? 'Generating…' : `Generate (${rosterSelectedIds.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setRosterSelectedIds([])}
                  className="text-gray-400 hover:text-gray-600"
                  title="Clear selection"
                >
                  <Icon name="close" size="sm" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={generating || !effectiveId}
                onClick={() => startGenerate(async () => {
                  setGenResult(null)
                  const r = await bulkGenerateLearningPassports(effectiveId)
                  setGenResult({ created: r.generated, skipped: r.skipped, errors: r.errors })
                })}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition disabled:opacity-50"
                title="Auto-generate Learning Passports for students who don't yet have one"
              >
                <Icon name={generating ? 'refresh' : 'auto_awesome'} size="sm" className={generating ? 'animate-spin' : ''} />
                {generating ? 'Generating…' : 'Generate missing passports'}
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by student name…"
            className="w-full pl-8 pr-8 py-2 text-[12px] border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <Icon name="close" size="sm" />
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {chips.map(chip => (
              <button
                key={chip.key}
                onClick={chip.clear}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-[11px] rounded-full border border-blue-100 hover:bg-blue-100 transition"
              >
                {chip.label}
                <Icon name="close" size="sm" />
              </button>
            ))}
            <button
              onClick={() => { setSubject(''); setYear(''); setSelectedId(''); setSearch('') }}
              className="text-[11px] text-gray-400 hover:text-gray-600 px-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {genResult && (
        <div className="flex items-center gap-2 text-[12px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
          <Icon name="check_circle" size="sm" />
          Generated {genResult.created} Learning Passport{genResult.created !== 1 ? 's' : ''}.
          {genResult.skipped > 0 && (
            <span className="text-blue-500">{genResult.skipped} already had one.</span>
          )}
          {genResult.errors > 0 && (
            <span className="text-red-500">{genResult.errors} failed.</span>
          )}
        </div>
      )}

      {/* ── Roster for selected class ── */}
      {effectiveId && (
        <ClassRosterTab
          key={effectiveId}
          classId={effectiveId}
          externalSearch={search}
          showCheckboxes
          onSelectionChange={handleSelectionChange}
        />
      )}
    </div>
  )
}
