'use client'
import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import StudentAvatar from '@/components/StudentAvatar'

type Student = {
  id:         string
  firstName:  string
  lastName:   string
  yearGroup:  number | null
  sendStatus: string
  needArea:   string | null
  avatarUrl?: string | null
}

type ClassData = {
  id:         string
  name:       string
  subject:    string
  yearGroup:  number
  department: string
  students:   Student[]
}

const SEND_LABEL: Record<string, string> = {
  SEN_SUPPORT: 'SEN Support',
  EHCP:        'EHCP',
}

const YEAR_COLORS = [
  'bg-blue-50 border-blue-200 text-blue-700',
  'bg-violet-50 border-violet-200 text-violet-700',
  'bg-emerald-50 border-emerald-200 text-emerald-700',
  'bg-amber-50 border-amber-200 text-amber-700',
  'bg-rose-50 border-rose-200 text-rose-700',
  'bg-cyan-50 border-cyan-200 text-cyan-700',
  'bg-indigo-50 border-indigo-200 text-indigo-700',
]

function yearColor(yearGroup: number) {
  return YEAR_COLORS[(yearGroup - 7) % YEAR_COLORS.length] ?? YEAR_COLORS[0]
}

export default function ClassListView({ classes }: { classes: ClassData[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([classes[0]?.id]))

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  if (classes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 text-sm text-gray-400">
        No classes assigned yet.
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-8">

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">My Classes</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {classes.length} class{classes.length !== 1 ? 'es' : ''} ·{' '}
          {classes.reduce((n, c) => n + c.students.length, 0)} students total
        </p>
      </div>

      {/* Class cards */}
      <div className="space-y-3">
        {classes.map(cls => {
          const isOpen   = expanded.has(cls.id)
          const sendCount = cls.students.filter(s => s.sendStatus !== 'NONE').length

          return (
            <div
              key={cls.id}
              className="bg-white border border-gray-200 rounded-2xl overflow-hidden"
            >
              {/* Class header row */}
              <button
                onClick={() => toggle(cls.id)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                {/* Expand icon */}
                <span className="text-gray-400 shrink-0">
                  {isOpen
                    ? <Icon name="expand_more" size="sm" />
                    : <Icon name="chevron_right" size="sm" />}
                </span>

                {/* Year group badge */}
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${yearColor(cls.yearGroup)}`}>
                  Y{cls.yearGroup}
                </span>

                {/* Class name + subject */}
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-gray-900 text-sm">{cls.name}</span>
                  <span className="text-gray-400 text-xs ml-2">{cls.subject}</span>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 shrink-0 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Icon name="people" size="sm" />
                    {cls.students.length} students
                  </span>
                  {sendCount > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Icon name="favorite" size="sm" />
                      {sendCount} SEND
                    </span>
                  )}
                </div>
              </button>

              {/* Student list */}
              {isOpen && (
                <div className="border-t border-gray-100">
                  {cls.students.length === 0 ? (
                    <div className="px-5 py-6 text-sm text-gray-400 text-center">No students enrolled.</div>
                  ) : (
                    <>
                      {/* Column header */}
                      <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_100px_120px] px-5 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        <span>Student</span>
                        <span className="hidden sm:block text-right">Year</span>
                        <span className="text-right">SEND</span>
                      </div>

                      <div className="divide-y divide-gray-50">
                        {cls.students.map((s, i) => (
                          <div
                            key={s.id}
                            className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_100px_120px] items-center px-5 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                          >
                            {/* Name + avatar */}
                            <div className="flex items-center gap-2.5 min-w-0">
                              <StudentAvatar
                                firstName={s.firstName}
                                lastName={s.lastName}
                                avatarUrl={s.avatarUrl}
                                userId={s.id}
                                sendStatus={s.sendStatus !== 'NONE' ? (s.sendStatus as 'SEN_SUPPORT' | 'EHCP') : undefined}
                                size="sm"
                              />
                              <span className="font-medium text-gray-800 truncate">
                                {s.lastName}, {s.firstName}
                              </span>
                            </div>

                            {/* Year */}
                            <div className="hidden sm:block text-right text-xs text-gray-400">
                              {s.yearGroup != null ? `Year ${s.yearGroup}` : '—'}
                            </div>

                            {/* SEND badge */}
                            <div className="text-right">
                              {s.sendStatus !== 'NONE' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                                  <Icon name="favorite" size="sm" />
                                  {SEND_LABEL[s.sendStatus] ?? s.sendStatus}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Footer summary */}
                      <div className="px-5 py-2.5 border-t border-gray-50 bg-gray-50 flex items-center gap-4 text-[11px] text-gray-400">
                        <Icon name="menu_book" size="sm" />
                        <span>{cls.students.length} enrolled</span>
                        {sendCount > 0 && (
                          <span className="text-amber-600">{sendCount} with SEND</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
