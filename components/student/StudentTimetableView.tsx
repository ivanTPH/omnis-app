'use client'
import type { TimetableDay, TimetableLesson } from '@/app/actions/students'
import Icon from '@/components/ui/Icon'

const DAY_LABELS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const DAY_SHORT  = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']

// Colour palette: cycle through subjects deterministically
const SUBJECT_COLOURS = [
  'bg-blue-50 border-blue-200 text-blue-800',
  'bg-purple-50 border-purple-200 text-purple-800',
  'bg-green-50 border-green-200 text-green-800',
  'bg-amber-50 border-amber-200 text-amber-800',
  'bg-rose-50 border-rose-200 text-rose-800',
  'bg-teal-50 border-teal-200 text-teal-800',
  'bg-indigo-50 border-indigo-200 text-indigo-800',
  'bg-orange-50 border-orange-200 text-orange-800',
  'bg-cyan-50 border-cyan-200 text-cyan-800',
  'bg-pink-50 border-pink-200 text-pink-800',
]

function subjectColour(subject: string): string {
  let hash = 0
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) & 0xffffffff
  return SUBJECT_COLOURS[Math.abs(hash) % SUBJECT_COLOURS.length]
}

function todayDayOfWeek(): number {
  // JS: 0=Sun, 1=Mon … 6=Sat  →  ISO: 1=Mon … 7=Sun
  const d = new Date().getDay()
  return d === 0 ? 7 : d
}

function LessonCard({ lesson }: { lesson: TimetableLesson }) {
  const colour = subjectColour(lesson.subject)
  return (
    <div className={`border rounded-lg px-3 py-2.5 mb-1.5 last:mb-0 ${colour}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold leading-snug">{lesson.subject}</span>
        <span className="text-[11px] font-medium shrink-0 opacity-75 mt-0.5">
          {lesson.startTime}–{lesson.endTime}
        </span>
      </div>
      <div className="text-[11px] opacity-70 mt-0.5 flex items-center gap-2 flex-wrap">
        <span>{lesson.className}</span>
        {lesson.teacher && <span>· {lesson.teacher}</span>}
        {lesson.room    && <span>· {lesson.room}</span>}
      </div>
    </div>
  )
}

export default function StudentTimetableView({ timetable }: { timetable: TimetableDay[] }) {
  const today     = todayDayOfWeek()
  const isWeekday = today >= 1 && today <= 5
  const hasData   = timetable.some(d => d.lessons.length > 0)

  if (!hasData) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="calendar_today" size="lg" className="text-gray-400" />
        </div>
        <h2 className="text-[16px] font-semibold text-gray-700 mb-2">No timetable available</h2>
        <p className="text-[13px] text-gray-400 max-w-xs mx-auto">
          Your timetable will appear here once your school&apos;s MIS has been synced with Omnis.
          Contact your school admin if you think this is an error.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-page-title">My Timetable</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">Your weekly lesson schedule</p>
      </div>

      {/* Today highlight (when it's a school day) */}
      {isWeekday && (() => {
        const todayDay = timetable.find(d => d.dayOfWeek === today)
        if (!todayDay || todayDay.lessons.length === 0) return null
        return (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="today" size="sm" className="text-blue-600" />
              <span className="text-[13px] font-semibold text-blue-800">Today — {DAY_LABELS[today]}</span>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {todayDay.lessons.map((l, i) => <LessonCard key={i} lesson={l} />)}
            </div>
          </div>
        )
      })()}

      {/* Full week grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {timetable.map(day => {
          const isToday = day.dayOfWeek === today
          return (
            <div key={day.dayOfWeek}>
              {/* Day header */}
              <div className={`flex items-center gap-1.5 mb-2 pb-1.5 border-b ${
                isToday ? 'border-blue-300' : 'border-gray-200'
              }`}>
                <span className={`text-[12px] font-bold uppercase tracking-wide ${
                  isToday ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  <span className="hidden lg:inline">{DAY_LABELS[day.dayOfWeek]}</span>
                  <span className="lg:hidden">{DAY_SHORT[day.dayOfWeek]}</span>
                </span>
                {isToday && (
                  <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-semibold">
                    Today
                  </span>
                )}
                <span className="ml-auto text-[11px] text-gray-400">{day.lessons.length} lesson{day.lessons.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Lessons */}
              {day.lessons.length === 0 ? (
                <p className="text-[11px] text-gray-300 py-4 text-center">No lessons</p>
              ) : (
                day.lessons.map((l, i) => <LessonCard key={i} lesson={l} />)
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
