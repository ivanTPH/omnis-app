'use client'

import { useMemo, useState } from 'react'
import Link                  from 'next/link'
import Icon                  from '@/components/ui/Icon'
import type { SchoolLesson } from '@/app/lessons/page'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function getLessonDay(lesson: SchoolLesson): number {
  const d = new Date(lesson.scheduledAt).getDay()
  return d === 0 ? 6 : d  // 1=Mon…5=Fri
}

export default function LessonsWeekView({
  lessons,
  weekStart,
  prevWeek,
  nextWeek,
  totalAbsences,
}: {
  lessons:        SchoolLesson[]
  weekStart:      string
  prevWeek:       string
  nextWeek:       string
  totalAbsences:  number
}) {
  const [search, setSearch]     = useState('')
  const [subject, setSubject]   = useState<string>('all')
  const [activeDay, setActiveDay] = useState<number | null>(null)

  const subjects = useMemo(() => {
    const s = new Set(lessons.map(l => l.subject))
    return Array.from(s).sort()
  }, [lessons])

  const filtered = useMemo(() => {
    let items = lessons
    if (activeDay != null)   items = items.filter(l => getLessonDay(l) === activeDay)
    if (subject !== 'all')   items = items.filter(l => l.subject === subject)
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.teacherName.toLowerCase().includes(q) ||
        l.className.toLowerCase().includes(q)
      )
    }
    return items
  }, [lessons, activeDay, subject, search])

  // Group by day
  const byDay = useMemo(() => {
    const map = new Map<number, SchoolLesson[]>()
    for (let d = 1; d <= 5; d++) map.set(d, [])
    for (const l of filtered) {
      const day = getLessonDay(l)
      if (map.has(day)) map.get(day)!.push(l)
    }
    return map
  }, [filtered])

  const weekStartDate = new Date(weekStart)
  const dayDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekStartDate)
    d.setDate(weekStartDate.getDate() + i)
    return d
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-page-title">School Lessons</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            Week of {formatDate(weekStart)} · {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
            {totalAbsences > 0 && (
              <span className="ml-2 text-amber-600 font-medium">· {totalAbsences} absence{totalAbsences !== 1 ? 's' : ''} this week</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/lessons?week=${prevWeek}`}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500"
          >
            <Icon name="chevron_left" size="sm" />
          </Link>
          <Link
            href="/lessons"
            className="px-3 py-1.5 text-[12px] font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600"
          >
            This week
          </Link>
          <Link
            href={`/lessons?week=${nextWeek}`}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500"
          >
            <Icon name="chevron_right" size="sm" />
          </Link>
          <a
            href="/api/export/cover-stats?days=30"
            className="px-3 py-1.5 text-[12px] font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600 flex items-center gap-1.5"
          >
            <Icon name="download" size="sm" />Cover Stats CSV
          </a>
          <Link
            href="/admin/cover"
            className="inline-flex items-center gap-1.5 ml-2 px-3 py-1.5 text-[12px] font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition"
          >
            <Icon name="event_busy" size="sm" />Manage Cover
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search lessons…"
            className="pl-9 pr-4 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={subject}
          onChange={e => setSubject(e.target.value)}
          className="text-[12px] border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
        >
          <option value="all">All subjects</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {/* Day filter */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveDay(null)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${activeDay == null ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
          >
            All days
          </button>
          {DAY_NAMES.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveDay(i + 1)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${activeDay === i + 1 ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Weekly grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="calendar_today" size="lg" className="mx-auto mb-3 text-gray-300" />
          <p>No lessons found for this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }, (_, i) => {
            const day     = i + 1
            const date    = dayDates[i]
            const dayLess = byDay.get(day) ?? []
            return (
              <div key={day} className="space-y-2">
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-center sticky top-4">
                  <p className="text-[11px] font-semibold text-gray-500">{DAY_NAMES[i]}</p>
                  <p className="text-[13px] font-bold text-gray-900">
                    {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                  <p className="text-[10px] text-gray-400">{dayLess.length} lesson{dayLess.length !== 1 ? 's' : ''}</p>
                </div>
                {dayLess.map(l => (
                  <div
                    key={l.id}
                    className={`bg-white rounded-xl border px-3 py-3 text-[12px] ${l.hasAbsence ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}
                  >
                    {l.hasAbsence && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-700 font-semibold mb-1.5">
                        <Icon name="event_busy" size="sm" />Absence recorded
                      </div>
                    )}
                    <p className="font-medium text-gray-900 line-clamp-2 leading-snug mb-1">{l.title}</p>
                    <p className="text-[11px] text-gray-500">{l.className} · {l.subject}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{l.teacherName}</p>

                    {l.resourceCount > 0 && (
                      <p className="text-[10px] text-blue-600 mt-1.5 flex items-center gap-0.5">
                        <Icon name="attach_file" size="sm" />{l.resourceCount} resource{l.resourceCount !== 1 ? 's' : ''}
                      </p>
                    )}
                    {l.hasAbsence && l.absenceId && (
                      <Link
                        href="/admin/cover"
                        className="inline-flex items-center gap-1 mt-2 text-[10px] text-amber-700 font-medium hover:text-amber-900"
                      >
                        <Icon name="arrow_forward" size="sm" />Assign cover
                      </Link>
                    )}
                  </div>
                ))}
                {dayLess.length === 0 && (
                  <div className="border border-dashed border-gray-200 rounded-xl px-3 py-4 text-center text-[11px] text-gray-300">
                    No lessons
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
