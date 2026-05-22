'use client'
import { useState, useTransition, useCallback } from 'react'
import ClassRosterTab from '@/components/ClassRosterTab'
import Icon from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { bulkGenerateLearningPassports, generatePassportsForStudents } from '@/app/actions/students'
import { updateClassExamBoard } from '@/app/actions/admin'

const UK_EXAM_BOARDS = ['AQA', 'Edexcel', 'OCR', 'WJEC', 'Eduqas', 'CCEA', 'Cambridge International', 'iGCSE (Pearson)', 'iGCSE (Cambridge)']
const HOD_ROLES = ['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN']

type ClassOption = { id: string; name: string; subject: string; yearGroup: number; examBoard: string | null; examModules: string[] }

export type ClassKpis = { students: number; sendCount: number; needsMarking: number }

export default function MyClassesView({ classes, role, kpiData }: { classes: ClassOption[]; role: string; kpiData?: Record<string, ClassKpis> }) {
  const [subject,     setSubject]     = useState('')
  const [year,        setYear]        = useState('')
  const [selectedId,  setSelectedId]  = useState('')
  const [search,      setSearch]      = useState('')
  const [generating,  startGenerate]  = useTransition()
  const [genResult,   setGenResult]   = useState<{ created: number; skipped: number; errors: number } | null>(null)
  const [rosterSelectedIds, setRosterSelectedIds] = useState<string[]>([])
  const [classList,   setClassList]   = useState<ClassOption[]>(classes)
  const [examEditing, setExamEditing] = useState(false)
  const [examSaving,  setExamSaving]  = useState(false)

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
  const subjects = ([...new Set(classList.map(c => c.subject))] as string[]).sort()
  const years    = ([...new Set(classList.map(c => c.yearGroup))] as number[]).sort((a, b) => a - b)

  // Classes narrowed by subject + year
  const filteredClasses = classList.filter(c =>
    (!subject || c.subject === subject) &&
    (!year    || c.yearGroup === Number(year)),
  )

  // Effective selection: explicit or first in filtered list
  const effectiveId = selectedId && filteredClasses.find(c => c.id === selectedId)
    ? selectedId
    : filteredClasses[0]?.id ?? ''

  const effectiveClass = classList.find(c => c.id === effectiveId) ?? null
  const canEditExamBoard = HOD_ROLES.includes(role)

  async function handleSaveExamBoard(examBoard: string) {
    if (!effectiveId) return
    setExamSaving(true)
    const modules = effectiveClass?.examModules ?? []
    const r = await updateClassExamBoard({ classId: effectiveId, examBoard, examModules: modules })
    if (!r.error) {
      setClassList(list => list.map(c => c.id === effectiveId ? { ...c, examBoard: examBoard || null } : c))
    }
    setExamSaving(false)
    setExamEditing(false)
  }

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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">

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

          {/* Class pills */}
          <div className="sm:col-span-2">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">
              Class
            </label>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
              {filteredClasses.map(c => {
                const marking = kpiData?.[c.id]?.needsMarking ?? 0
                const isSelected = c.id === effectiveId
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`relative flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {c.name}
                    {marking > 0 && (
                      <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-none ${
                        isSelected ? 'bg-white text-rose-600' : 'bg-rose-500 text-white'
                      }`}>
                        {marking}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
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

      {/* ── Exam board strip for selected class ── */}
      {effectiveClass && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
          <Icon name="school" size="sm" className="text-indigo-500 shrink-0" />
          <span className="text-[12px] font-medium text-indigo-800">
            {effectiveClass.examBoard
              ? <>Exam board: <strong>{effectiveClass.examBoard}</strong>{effectiveClass.examModules?.length > 0 && <span className="text-indigo-600 font-normal"> · {effectiveClass.examModules.join(', ')}</span>}</>
              : <span className="text-indigo-500 italic">No exam board set for this class</span>
            }
          </span>
          {canEditExamBoard && !examEditing && (
            <button
              onClick={() => setExamEditing(true)}
              className="ml-auto flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 rounded-lg px-2.5 py-1 transition"
            >
              <Icon name="edit" size="sm" />
              {effectiveClass.examBoard ? 'Change' : 'Set exam board'}
            </button>
          )}
          {canEditExamBoard && examEditing && (
            <div className="ml-auto flex items-center gap-2">
              <select
                defaultValue={effectiveClass.examBoard ?? ''}
                id="exam-board-select"
                className="text-[12px] border border-indigo-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                onChange={e => e.target.value !== '__cancel' && handleSaveExamBoard(e.target.value)}
                disabled={examSaving}
              >
                <option value="">— Remove —</option>
                {UK_EXAM_BOARDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              {examSaving && <Icon name="refresh" size="sm" className="animate-spin text-indigo-500" />}
              <button onClick={() => setExamEditing(false)} className="text-gray-400 hover:text-gray-600">
                <Icon name="close" size="sm" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── KPI strip for selected class ── */}
      {effectiveId && kpiData?.[effectiveId] && (() => {
        const kpi = kpiData[effectiveId]
        return (
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Icon name="groups" size="sm" className="text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Students</p>
                <p className="text-lg font-bold text-gray-900 leading-none">{kpi.students}</p>
              </div>
            </div>
            <div className="card p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <Icon name="support" size="sm" className="text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">SEND</p>
                <p className="text-lg font-bold text-gray-900 leading-none">{kpi.sendCount}</p>
              </div>
            </div>
            <div className={`card p-3 flex items-center gap-3 ${kpi.needsMarking > 0 ? 'border-rose-200 bg-rose-50' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${kpi.needsMarking > 0 ? 'bg-rose-100' : 'bg-gray-50'}`}>
                <Icon name="grading" size="sm" className={kpi.needsMarking > 0 ? 'text-rose-600' : 'text-gray-400'} />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Needs Marking</p>
                <p className={`text-lg font-bold leading-none ${kpi.needsMarking > 0 ? 'text-rose-700' : 'text-gray-900'}`}>{kpi.needsMarking}</p>
              </div>
            </div>
          </div>
        )
      })()}

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
