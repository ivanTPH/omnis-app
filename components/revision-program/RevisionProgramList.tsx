'use client'
import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

type ProgramRow = {
  id:             string
  title:          string
  subject:        string
  status:         string
  mode:           string
  classId:        string | null
  programType?:   string
  createdAt:      Date | string
  taskCount:      number
  completedCount: number
}

type Filter = 'all' | 'active' | 'study_guide' | 'formal_assignment' | 'closed'

export default function RevisionProgramList({
  programs,
  onNew,
  onNewYear,
}: {
  programs:  ProgramRow[]
  onNew:     () => void
  onNewYear: () => void
}) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = programs.filter(p => {
    if (filter === 'active')           return ['sent', 'active'].includes(p.status)
    if (filter === 'study_guide')      return p.mode === 'study_guide'
    if (filter === 'formal_assignment') return p.mode === 'formal_assignment'
    if (filter === 'closed')           return p.status === 'closed'
    return true
  })

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all',               label: 'All' },
    { key: 'active',            label: 'Active' },
    { key: 'study_guide',       label: 'Study Guides' },
    { key: 'formal_assignment', label: 'Assignments' },
    { key: 'closed',            label: 'Closed' },
  ]

  return (
    <div className="flex-1 overflow-auto px-6 py-6 max-w-3xl mx-auto w-full">
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Icon name="bookmark" size="md" className="text-gray-500" />
          <h1 className="text-lg font-semibold text-gray-900">Revision Programs</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewYear}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            <Icon name="school" size="sm" /> Year Revision
          </button>
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            <Icon name="add" size="sm" /> New Program
          </button>
        </div>
      </div>

      {/* filter tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
              filter === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Icon name="bookmark" size="lg" className="mb-3 opacity-30" />
          <p className="text-sm">No revision programs yet</p>
          <button onClick={onNew} className="mt-3 text-sm text-blue-600 hover:underline">Create your first program →</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const isAssignment = p.mode === 'formal_assignment'
            const pct = p.taskCount > 0 ? Math.round((p.completedCount / p.taskCount) * 100) : 0

            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/revision-program/${p.id}`} className="text-sm font-semibold text-gray-900 truncate hover:text-blue-600 transition-colors">
                        {p.title}
                      </Link>
                      {p.programType === 'year' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 flex items-center gap-0.5">
                          <Icon name="school" size="sm" /> Year
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isAssignment ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {isAssignment ? 'Assignment' : 'Study Guide'}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        p.status === 'sent' || p.status === 'active' ? 'bg-green-100 text-green-700' :
                        p.status === 'closed' ? 'bg-gray-100 text-gray-500' :
                        'bg-amber-100 text-amber-700'
                      }`}>{p.status}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Icon name="calendar_today" size="sm" /> {new Date(p.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span className="flex items-center gap-1"><Icon name="people" size="sm" /> {p.completedCount}/{p.taskCount} complete</span>
                    </div>
                    {/* progress bar */}
                    <div className="mt-2 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pct >= 75 ? 'bg-green-500' : pct >= 40 ? 'bg-blue-500' : 'bg-gray-300'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/revision-program/${p.id}`}
                      className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
                    >
                      View <Icon name="chevron_right" size="sm" />
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
