'use client'

import { useState, useMemo } from 'react'
import Link                  from 'next/link'
import Icon                  from '@/components/ui/Icon'
import { gradePillClass, gradeLabel } from '@/lib/grading'
import type { MobileHw }     from '@/components/StudentMobileDashboard'

const STATUS_CHIPS = [
  { key: undefined,    label: 'All' },
  { key: 'overdue',   label: 'Overdue' },
  { key: 'due_soon',  label: 'Due soon' },
  { key: 'upcoming',  label: 'Upcoming' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'graded',    label: 'Graded' },
] as const

const STATUS_STYLES: Record<string, string> = {
  overdue:   'bg-red-100 text-red-700',
  due_soon:  'bg-amber-100 text-amber-700',
  upcoming:  'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-700',
  graded:    'bg-green-100 text-green-700',
}

const STATUS_LABELS: Record<string, string> = {
  overdue:   'Overdue',
  due_soon:  'Due soon',
  upcoming:  'Upcoming',
  submitted: 'Submitted',
  graded:    'Graded',
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  const days = Math.ceil(diff / 86_400_000)
  if (days < 0)  return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days}d`
}

export default function StudentHomeworkListView({
  homework,
  initialStatus,
}: {
  homework:      MobileHw[]
  initialStatus?: string
}) {
  const [activeStatus, setActiveStatus] = useState<string | undefined>(
    initialStatus && initialStatus !== 'all' ? initialStatus : undefined
  )
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let items = homework
    if (activeStatus) items = items.filter(h => h.status === activeStatus)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(h =>
        h.title.toLowerCase().includes(q) || h.subject.toLowerCase().includes(q) || h.className.toLowerCase().includes(q)
      )
    }
    return items
  }, [homework, activeStatus, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const h of homework) c[h.status] = (c[h.status] ?? 0) + 1
    return c
  }, [homework])

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-page-title">My Homework</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">{homework.length} piece{homework.length !== 1 ? 's' : ''} assigned</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title or subject…"
          className="w-full pl-9 pr-4 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {STATUS_CHIPS.map(chip => {
          const active = activeStatus === chip.key
          const count  = chip.key ? (counts[chip.key] ?? 0) : homework.length
          return (
            <button
              key={String(chip.key)}
              type="button"
              onClick={() => setActiveStatus(chip.key)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {chip.label}
              <span className={`text-[10px] ${active ? 'text-gray-300' : 'text-gray-400'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Icon name="assignment" size="lg" className="mx-auto mb-3 text-gray-300" />
          <p>No homework matches this filter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(hw => (
            <Link
              key={hw.id}
              href={`/student/homework/${hw.id}`}
              className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-gray-300 hover:shadow-sm transition group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLES[hw.status] ?? ''}`}>
                    {STATUS_LABELS[hw.status]}
                  </span>
                  <span className="text-[10px] text-gray-400">{hw.subject}</span>
                  <span className="text-[10px] text-gray-300">·</span>
                  <span className="text-[10px] text-gray-400">{hw.className}</span>
                </div>
                <p className="text-[13px] font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">{hw.title}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{daysUntil(hw.dueAt)}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {hw.score != null ? (
                  <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-bold ${gradePillClass(Math.round((hw.score / 100) * 9) || 1)}`}>
                    {gradeLabel(Math.round((hw.score / 100) * 9) || 1)}
                  </span>
                ) : null}
                <Icon name="chevron_right" size="sm" className="text-gray-300 group-hover:text-gray-500" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
