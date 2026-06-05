'use client'
import { useState, useMemo } from 'react'
import type { TimetableRow } from '@/app/actions/admin'
import Icon from '@/components/ui/Icon'

const DAYS      = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

// Deterministic colour from subject name
const PALETTE = [
  'bg-blue-50 border-blue-200 text-blue-900',
  'bg-green-50 border-green-200 text-green-900',
  'bg-amber-50 border-amber-200 text-amber-900',
  'bg-purple-50 border-purple-200 text-purple-900',
  'bg-teal-50 border-teal-200 text-teal-900',
  'bg-rose-50 border-rose-200 text-rose-900',
  'bg-sky-50 border-sky-200 text-sky-900',
  'bg-orange-50 border-orange-200 text-orange-900',
  'bg-emerald-50 border-emerald-200 text-emerald-900',
  'bg-indigo-50 border-indigo-200 text-indigo-900',
  'bg-cyan-50 border-cyan-200 text-cyan-900',
  'bg-pink-50 border-pink-200 text-pink-900',
]

function subjectColour(subject: string | null): string {
  if (!subject) return 'bg-gray-50 border-gray-200 text-gray-700'
  let h = 0
  for (let i = 0; i < subject.length; i++) h = (h * 31 + subject.charCodeAt(i)) & 0xffffffff
  return PALETTE[Math.abs(h) % PALETTE.length]
}

/** Wonde returns numeric IDs like A1418790635 as "room" — filter them out. */
function roomLabel(r: string | null): string | null {
  if (!r || /^[A-Z]\d{6,}$/.test(r)) return null
  return r
}

function fmt(t: string): string {
  // "09:15:00" or "09:15" → "09:15"
  return t.slice(0, 5)
}

// ── Today highlight ────────────────────────────────────────────────────────────
function todayCol(): number {
  const d = new Date().getDay() // 0=Sun, 1=Mon…
  return d >= 1 && d <= 5 ? d : 0  // 1=Mon col, 0=none
}

export default function AdminTimetableGrid({ entries }: { entries: TimetableRow[] }) {
  const [subjectFilter, setSubjectFilter] = useState('')
  const [search,        setSearch]        = useState('')
  const [view,          setView]          = useState<'grid' | 'list'>('grid')

  // ── Derived data ─────────────────────────────────────────────────────────────

  const subjects = useMemo(() => {
    const s = new Set<string>()
    for (const e of entries) if (e.subject) s.add(e.subject)
    return [...s].sort()
  }, [entries])

  const filtered = useMemo(() => {
    let rows = entries
    if (subjectFilter) rows = rows.filter(e => e.subject === subjectFilter)
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(e =>
        e.className.toLowerCase().includes(q) ||
        (e.subject ?? '').toLowerCase().includes(q) ||
        e.teacher.toLowerCase().includes(q),
      )
    }
    return rows
  }, [entries, subjectFilter, search])

  // Unique time slots across all days, sorted by start time
  const slots = useMemo(() => {
    const map = new Map<string, { startTime: string; endTime: string }>()
    for (const e of filtered) {
      const key = `${e.startTime}`
      if (!map.has(key)) map.set(key, { startTime: e.startTime, endTime: e.endTime })
    }
    return [...map.values()].sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [filtered])

  // Grid lookup: `${startTime}-${dayOfWeek}` → entries
  const grid = useMemo(() => {
    const g = new Map<string, TimetableRow[]>()
    for (const e of filtered) {
      const key = `${e.startTime}-${e.dayOfWeek}`
      if (!g.has(key)) g.set(key, [])
      g.get(key)!.push(e)
    }
    return g
  }, [filtered])

  const today = todayCol()

  // ── Empty state ───────────────────────────────────────────────────────────────

  if (entries.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-16 text-center text-gray-400">
        <Icon name="calendar_today" size="lg" className="mx-auto mb-3 opacity-30" />
        <p className="text-[14px] font-medium text-gray-600">No timetable data</p>
        <p className="text-[12px] mt-1">Run a Wonde sync to import timetable entries from your MIS</p>
      </div>
    )
  }

  // ── Filter bar ────────────────────────────────────────────────────────────────

  const FilterBar = (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Subject filter */}
      <select
        value={subjectFilter}
        onChange={e => setSubjectFilter(e.target.value)}
        className="text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All subjects</option>
        {subjects.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      {/* Search */}
      <div className="relative">
        <Icon name="search" size="sm" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Class, teacher…"
          className="text-[12px] border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 bg-white text-gray-700 w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Count */}
      <span className="text-[12px] text-gray-400 ml-auto">
        {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
      </span>

      {/* View toggle */}
      <div className="flex border border-gray-200 rounded-lg overflow-hidden">
        {(['grid', 'list'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 text-[12px] font-medium flex items-center gap-1.5 transition ${
              view === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Icon name={v === 'grid' ? 'grid_view' : 'list'} size="sm" />
            {v === 'grid' ? 'Grid' : 'List'}
          </button>
        ))}
      </div>
    </div>
  )

  // ── List view ─────────────────────────────────────────────────────────────────

  if (view === 'list') {
    const sorted = [...filtered].sort((a, b) => {
      if ((a.dayOfWeek ?? 0) !== (b.dayOfWeek ?? 0)) return (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0)
      return a.startTime.localeCompare(b.startTime)
    })
    return (
      <div>
        {FilterBar}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Day</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Time</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Class</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Subject</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Teacher</th>
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden lg:table-cell">Room</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                    {e.dayOfWeek ? DAYS[e.dayOfWeek - 1] : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap font-mono">
                    {fmt(e.startTime)}–{fmt(e.endTime)}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{e.className}</td>
                  <td className="px-4 py-2.5">
                    {e.subject && (
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${subjectColour(e.subject)}`}>
                        {e.subject}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{e.teacher}</td>
                  <td className="px-4 py-2.5 text-gray-400 hidden lg:table-cell">
                    {roomLabel(e.room) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Grid view ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {FilterBar}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-3 text-left font-semibold text-gray-500 border-r border-gray-200 w-24 whitespace-nowrap sticky left-0 bg-gray-50 z-10">
                  Time
                </th>
                {DAYS.map((day, i) => (
                  <th
                    key={day}
                    className={`px-3 py-3 text-center font-semibold border-r border-gray-100 last:border-r-0 min-w-[150px] ${
                      today === i + 1 ? 'text-blue-700 bg-blue-50/50' : 'text-gray-700'
                    }`}
                  >
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden">{DAYS_SHORT[i]}</span>
                    {today === i + 1 && (
                      <span className="ml-1.5 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-bold">Today</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot, si) => (
                <tr key={slot.startTime} className={si % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'}>
                  {/* Time column — sticky on scroll */}
                  <td className="px-3 py-2 border-r border-gray-200 align-top sticky left-0 bg-inherit z-10 whitespace-nowrap">
                    <p className="font-semibold text-gray-700 text-[11px]">{fmt(slot.startTime)}</p>
                    <p className="text-[10px] text-gray-400">{fmt(slot.endTime)}</p>
                  </td>

                  {/* Day columns */}
                  {DAYS.map((_, di) => {
                    const dayNum     = di + 1
                    const cellEntries = grid.get(`${slot.startTime}-${dayNum}`) ?? []
                    return (
                      <td
                        key={di}
                        className={`px-1.5 py-1.5 border-r border-gray-100 last:border-r-0 align-top ${
                          today === dayNum ? 'bg-blue-50/20' : ''
                        }`}
                      >
                        <div className="space-y-1">
                          {cellEntries.map(e => {
                            const room = roomLabel(e.room)
                            return (
                              <div
                                key={e.id}
                                className={`px-2 py-1.5 rounded-lg border text-[11px] ${subjectColour(e.subject)}`}
                              >
                                <p className="font-semibold leading-tight truncate" title={e.className}>
                                  {e.className}
                                </p>
                                {e.subject && (
                                  <p className="text-[10px] opacity-70 leading-tight truncate">{e.subject}</p>
                                )}
                                <p className="text-[10px] opacity-60 leading-tight mt-0.5 truncate">{e.teacher}</p>
                                {room && (
                                  <p className="text-[10px] opacity-50 leading-tight truncate">{room}</p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
