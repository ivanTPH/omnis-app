'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import SessionDetailModal from './SessionDetailModal'
import ExportPdfButton    from '@/components/ExportPdfButton'

type Session = {
  id:            string
  subject:       string
  topic:         string
  scheduledAt:   Date
  durationMins:  number
  status:        string
  confidence:    number | null
  notes:         string | null
  oakLessonSlug: string | null
  oakLessonTitle?: string | null
}

const SUBJECT_COLOURS: Record<string, string> = {
  'English':     'bg-purple-100 border-purple-200 text-purple-800',
  'Maths':       'bg-blue-100 border-blue-200 text-blue-800',
  'Science':     'bg-green-100 border-green-200 text-green-800',
  'Biology':     'bg-emerald-100 border-emerald-200 text-emerald-800',
  'Chemistry':   'bg-yellow-100 border-yellow-200 text-yellow-800',
  'Physics':     'bg-cyan-100 border-cyan-200 text-cyan-800',
  'History':     'bg-orange-100 border-orange-200 text-orange-800',
  'Geography':   'bg-teal-100 border-teal-200 text-teal-800',
  'French':      'bg-indigo-100 border-indigo-200 text-indigo-800',
  'Spanish':     'bg-pink-100 border-pink-200 text-pink-800',
  'German':      'bg-rose-100 border-rose-200 text-rose-800',
  'Computing':   'bg-sky-100 border-sky-200 text-sky-800',
  'RE':          'bg-lime-100 border-lime-200 text-lime-800',
  'PE':          'bg-red-100 border-red-200 text-red-800',
}

function subjectColour(subject: string) {
  return SUBJECT_COLOURS[subject] ?? 'bg-gray-100 border-gray-200 text-gray-800'
}

function statusDot(status: string) {
  if (status === 'completed') return 'bg-green-500'
  if (status === 'skipped')   return 'bg-gray-400'
  return 'bg-blue-500'
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function WeeklyRevisionGrid({
  sessions,
  onWeekChange,
  onRefresh,
  studentId,
}: {
  sessions:     Session[]
  onWeekChange: (monday: Date) => void
  onRefresh:    () => void
  studentId?:   string
}) {
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()))
  const [selected,  setSelected]  = useState<Session | null>(null)

  function navigate(direction: number) {
    const next = new Date(weekStart)
    next.setDate(next.getDate() + direction * 7)
    setWeekStart(next)
    onWeekChange(next)
  }

  // Build 7-day columns
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  function sessionsOnDay(day: Date): Session[] {
    return sessions.filter(s => {
      const sd = new Date(s.scheduledAt)
      return sd.getFullYear() === day.getFullYear()
        && sd.getMonth()      === day.getMonth()
        && sd.getDate()       === day.getDate()
    }).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  }

  const today = new Date(); today.setHours(0,0,0,0)
  const weekLabel = weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const weekEndDate = days[6]
  const weekEndLabel = weekEndDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-bold text-gray-900">Weekly Planner</h3>
        <div className="flex items-center gap-2">
          {studentId && (
            <ExportPdfButton
              href={`/api/export/revision-timetable?weekStart=${weekStart.toISOString()}&studentId=${studentId}`}
              filename={`revision-timetable-${weekStart.toISOString().slice(0,10)}.pdf`}
              label="Export Week"
            />
          )}
          <span className="text-[11px] text-gray-500">{weekLabel} – {weekEndLabel}</span>
          <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500">
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => { setWeekStart(getMonday(new Date())); onWeekChange(getMonday(new Date())) }}
            className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50"
          >
            Today
          </button>
          <button onClick={() => navigate(1)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const daySessions = sessionsOnDay(day)
          const isToday     = day.getTime() === today.getTime()
          const isWeekend   = i >= 5

          return (
            <div
              key={i}
              className={`min-h-24 rounded-xl border p-1.5 ${
                isToday   ? 'border-blue-300 bg-blue-50'
                : isWeekend ? 'border-gray-100 bg-gray-50/50'
                : 'border-gray-200 bg-white'
              }`}
            >
              {/* Day header */}
              <div className={`text-center mb-1.5 ${isToday ? 'text-blue-700' : 'text-gray-500'}`}>
                <div className="text-[9px] font-bold uppercase tracking-wide">{DAY_NAMES[i]}</div>
                <div className={`text-[13px] font-bold ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center mx-auto' : ''}`}>
                  {day.getDate()}
                </div>
              </div>

              {/* Sessions */}
              <div className="space-y-1">
                {daySessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => setSelected(session)}
                    className={`w-full text-left rounded-lg border p-1 text-[10px] font-medium leading-tight transition-opacity hover:opacity-80 ${subjectColour(session.subject)}`}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot(session.status)}`} />
                      <span className="font-semibold truncate">{session.subject}</span>
                    </div>
                    <div className="truncate opacity-80">{session.topic}</div>
                    <div className="opacity-60 mt-0.5">
                      {new Date(session.scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}{session.durationMins}m
                    </div>
                  </button>
                ))}
                {daySessions.length === 0 && (
                  <div className="text-[9px] text-gray-300 text-center pt-1">—</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <SessionDetailModal
          session={selected}
          onClose={() => setSelected(null)}
          onRefresh={() => { setSelected(null); onRefresh() }}
        />
      )}
    </div>
  )
}
