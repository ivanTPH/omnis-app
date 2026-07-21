'use client'

import { useState, useMemo } from 'react'
import Link                  from 'next/link'
import Icon                  from '@/components/ui/Icon'
import { gradePillClass, gradeLabel } from '@/lib/grading'
import type { MobileHw }     from '@/components/StudentMobileDashboard'

// ── Calendar helpers ──────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // Monday-based
  const monday = new Date(d)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(d.getDate() + diff)
  return monday
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function CalendarView({ homework }: { homework: MobileHw[] }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7))
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const byDay = useMemo(() => {
    const map = new Map<string, MobileHw[]>()
    for (const hw of homework) {
      const key = new Date(hw.dueAt).toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(hw)
    }
    return map
  }, [homework])

  const weekLabel = `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${addDays(weekStart, 6).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`

  return (
    <div>
      {/* Week nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <Icon name="chevron_left" size="md" />
        </button>
        <span className="text-[13px] font-semibold text-gray-700">{weekLabel}</span>
        <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <Icon name="chevron_right" size="md" />
        </button>
      </div>

      {/* Day columns — desktop calendar grid */}
      <div className="hidden sm:grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const isToday    = day.toDateString() === new Date().toDateString()
          const dayHw      = byDay.get(day.toDateString()) ?? []
          return (
            <div key={i} className="min-h-[100px]">
              <div className={`text-center mb-1.5 px-1 py-1 rounded-lg text-[10px] font-semibold ${
                isToday ? 'bg-blue-600 text-white' : 'text-gray-400'
              }`}>
                <div>{DAY_LABELS[i]}</div>
                <div className={`text-[12px] font-bold ${isToday ? 'text-white' : 'text-gray-700'}`}>
                  {day.getDate()}
                </div>
              </div>
              <div className="space-y-1">
                {dayHw.map(hw => (
                  <Link
                    key={hw.id}
                    href={`/student/homework/${hw.id}`}
                    className={`block px-1.5 py-1 rounded text-[9px] font-medium leading-tight hover:opacity-80 transition ${STATUS_STYLES[hw.status] ?? 'bg-gray-100 text-gray-600'}`}
                    title={hw.title}
                  >
                    <div className="truncate">{hw.subject}</div>
                    <div className="truncate opacity-80">{hw.title}</div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile list — one row per day that has homework */}
      <div className="sm:hidden space-y-3">
        {days.map((day, i) => {
          const isToday = day.toDateString() === new Date().toDateString()
          const dayHw   = byDay.get(day.toDateString()) ?? []
          if (dayHw.length === 0) return null
          return (
            <div key={i}>
              <div className={`text-[11px] font-bold mb-1.5 px-1 ${isToday ? 'text-blue-700' : 'text-gray-400'}`}>
                {DAY_LABELS[i]} {day.getDate()} {day.toLocaleDateString('en-GB', { month: 'short' })}
                {isToday && <span className="ml-1.5 bg-blue-600 text-white px-1.5 py-0.5 rounded text-[10px]">Today</span>}
              </div>
              <div className="space-y-1.5">
                {dayHw.map(hw => (
                  <Link
                    key={hw.id}
                    href={`/student/homework/${hw.id}`}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:opacity-80 transition ${STATUS_STYLES[hw.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{hw.title}</div>
                      <div className="text-[11px] opacity-75">{hw.subject}</div>
                    </div>
                    <span className="material-icons text-base opacity-50">chevron_right</span>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {byDay.size === 0 && (
        <p className="text-center text-[13px] text-gray-400 py-6">No homework due this week.</p>
      )}
    </div>
  )
}

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
  const [search, setSearch]   = useState('')
  const [view, setView]       = useState<'list' | 'calendar'>('list')

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-page-title">My Homework</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">{homework.length} piece{homework.length !== 1 ? 's' : ''} assigned</p>
        </div>
        <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-white">
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition ${view === 'list' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <Icon name="list" size="sm" />
            List
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition ${view === 'calendar' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <Icon name="calendar_month" size="sm" />
            Calendar
          </button>
        </div>
      </div>

      {/* Calendar view */}
      {view === 'calendar' && <CalendarView homework={homework} />}

      {/* List view controls (hidden in calendar mode) */}
      {view === 'list' && <>

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
      </>}
    </div>
  )
}
