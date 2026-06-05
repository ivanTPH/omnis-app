'use client'
import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { getDashboardData, addConcernNote, escalateConcernToStaff, dismissSencoAlert, getTeacherTodayTimetable, type DashboardData, type OpenConcern, type TeacherTimetableLesson } from '@/app/actions/dashboard'
import { CONCERN_SECTIONS } from '@/components/send-support/ConcernList'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatCardSkeleton, StudentListSkeleton, HomeworkCardSkeleton } from '@/components/ui/skeletons'
import Icon from '@/components/ui/Icon'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function StatCard({
  label, value, icon, trend, iconDanger, href, anchor,
}: {
  label: string; value: number; icon: string; trend: string; iconDanger?: boolean
  href?: string; anchor?: string
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-label">{label}</p>
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
          <Icon name={icon} size="sm" className={iconDanger ? 'text-red-500' : 'text-gray-500'} />
        </div>
      </div>
      <p className="text-3xl font-semibold text-gray-900 mt-2">{value}</p>
      <p className="text-meta mt-1">{trend}</p>
    </>
  )

  const base = 'card-stat block transition-shadow'

  if (href) {
    return <Link href={href} className={`${base} hover:shadow-md`}>{inner}</Link>
  }
  if (anchor) {
    return (
      <button
        type="button"
        onClick={() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className={`${base} w-full text-left hover:shadow-md cursor-pointer`}
      >
        {inner}
      </button>
    )
  }
  return <div className={base}>{inner}</div>
}

const CATEGORY_LABELS: Record<string, string> = {
  literacy:         'Literacy',
  numeracy:         'Numeracy',
  behaviour:        'Behaviour',
  attendance:       'Attendance',
  social_emotional: 'Social/Emotional',
  communication:    'Communication',
  physical:         'Physical',
  sensory:          'Sensory',
  other:            'Other',
}

const CATEGORY_COLOURS: Record<string, string> = {
  literacy:         'bg-blue-100 text-blue-700',
  numeracy:         'bg-purple-100 text-purple-700',
  behaviour:        'bg-orange-100 text-orange-700',
  attendance:       'bg-yellow-100 text-yellow-700',
  social_emotional: 'bg-pink-100 text-pink-700',
  communication:    'bg-teal-100 text-teal-700',
  physical:         'bg-green-100 text-green-700',
  sensory:          'bg-indigo-100 text-indigo-700',
  other:            'bg-gray-100 text-gray-700',
}

const ESCALATION_TARGETS = [
  { label: 'Notify SENCO',         roles: ['SENCO'],                    icon: 'support_agent' },
  { label: 'Notify Head of Year',  roles: ['HEAD_OF_YEAR'],             icon: 'school' },
  { label: 'Notify Safeguarding',  roles: ['SLT', 'HEAD_OF_YEAR'],      icon: 'shield' },
]

function ConcernCard({ concern, onUpdate }: { concern: OpenConcern; onUpdate: () => void }) {
  const [expanded,       setExpanded]       = useState(false)
  const [note,           setNote]           = useState('')
  const [escalateMsg,    setEscalateMsg]    = useState('')
  const [showEscalate,   setShowEscalate]   = useState(false)
  const [successMsg,     setSuccessMsg]     = useState('')
  const [isPending,      startTransition]   = useTransition()

  function flash(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3500)
  }

  function handleAddNote() {
    if (!note.trim()) return
    startTransition(async () => {
      try {
        await addConcernNote(concern.id, note.trim())
        setNote('')
        flash('Note added.')
        onUpdate()
      } catch {
        flash('Failed to save note.')
      }
    })
  }

  function handleEscalate(roles: string[]) {
    if (!escalateMsg.trim()) return
    startTransition(async () => {
      try {
        const result = await escalateConcernToStaff(concern.id, roles, escalateMsg.trim())
        setEscalateMsg('')
        setShowEscalate(false)
        flash(`Escalated — ${result.notified} staff member${result.notified !== 1 ? 's' : ''} notified.`)
        onUpdate()
      } catch {
        flash('Failed to send escalation.')
      }
    })
  }

  const catLabel  = CATEGORY_LABELS[concern.category]  ?? concern.category
  const catColour = CATEGORY_COLOURS[concern.category] ?? 'bg-gray-100 text-gray-700'

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 mb-2 last:mb-0 overflow-hidden">
      {/* Header row — always visible */}
      <button
        type="button"
        className="w-full flex items-start gap-3 p-3 hover:bg-red-100 transition-colors text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <Icon name="flag" size="sm" className="text-red-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-data font-medium">{concern.studentName}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${catColour}`}>{catLabel}</span>
          </div>
          <p className={`text-meta mt-0.5 ${expanded ? '' : 'truncate'}`}>{concern.description}</p>
          {!expanded && concern.todayLesson && (
            <p className="text-meta mt-0.5 text-blue-600">
              Next in class: {concern.todayLesson.className} at {formatTime(concern.todayLesson.scheduledAt)}
            </p>
          )}
        </div>
        <Icon
          name="expand_more"
          size="sm"
          className={`text-red-400 shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-red-200 bg-white px-4 pb-4 pt-3 space-y-4">

          {/* Raised info */}
          <p className="text-xs text-gray-400">Raised {formatDate(concern.createdAt)} · Status: <span className="capitalize">{concern.status.replace('_', ' ')}</span></p>

          {/* Today's lesson */}
          {concern.todayLesson ? (
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Icon name="schedule" size="sm" className="shrink-0" />
              <span>Next in class: <strong>{concern.todayLesson.className}</strong> at {formatTime(concern.todayLesson.scheduledAt)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Icon name="schedule" size="sm" className="shrink-0" />
              <span>Not in your class today</span>
            </div>
          )}

          {/* Existing evidence notes */}
          {concern.evidenceNotes && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Evidence notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{concern.evidenceNotes}</p>
            </div>
          )}

          {/* Homework evidence links */}
          {concern.recentHomework.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Recent homework submissions</p>
              <div className="space-y-1">
                {concern.recentHomework.map(hw => (
                  <Link
                    key={hw.submissionId}
                    href={`/homework/${hw.id}/mark`}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <Icon name="assignment_turned_in" size="sm" className="shrink-0 text-gray-400" />
                    {hw.title}
                    <span className="text-gray-400">· due {formatDate(hw.dueAt)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Add note */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Add a note</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add an observation or update to this concern…"
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="button"
              disabled={!note.trim() || isPending}
              onClick={handleAddNote}
              className="mt-1 text-xs font-medium bg-gray-800 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving…' : 'Save note'}
            </button>
          </div>

          {/* Escalate section */}
          <div>
            <button
              type="button"
              onClick={() => setShowEscalate(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800"
            >
              <Icon name="send" size="sm" />
              {showEscalate ? 'Cancel escalation' : 'Escalate / notify staff'}
            </button>

            {showEscalate && (
              <div className="mt-2 space-y-2">
                <textarea
                  value={escalateMsg}
                  onChange={e => setEscalateMsg(e.target.value)}
                  placeholder="Add a message for the recipient…"
                  rows={2}
                  className="w-full text-sm border border-red-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <div className="flex flex-wrap gap-2">
                  {ESCALATION_TARGETS.map(t => (
                    <button
                      key={t.label}
                      type="button"
                      disabled={!escalateMsg.trim() || isPending}
                      onClick={() => handleEscalate(t.roles)}
                      className="flex items-center gap-1.5 text-xs font-medium bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      <Icon name={t.icon} size="sm" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Success / error flash */}
          {successMsg && (
            <p className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1.5">
              {successMsg}
            </p>
          )}

          {/* Link to student profile */}
          <Link
            href={`/students/${concern.studentId}`}
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            <Icon name="person" size="sm" />
            View full student profile
          </Link>
        </div>
      )}
    </div>
  )
}

export default function DashboardMorningView({ firstName, role }: { firstName: string; role: string }) {
  const [data,             setData]             = useState<DashboardData | null>(null)
  const [timetable,        setTimetable]        = useState<TeacherTimetableLesson[]>([])
  const [dismissedAlerts,  setDismissedAlerts]  = useState<Set<string>>(new Set())
  const [,                 startDismiss]        = useTransition()

  function load() {
    getDashboardData().then(setData).catch(console.error)
  }

  useEffect(() => {
    load()
    getTeacherTodayTimetable().then(setTimetable).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDismissAlert(id: string) {
    setDismissedAlerts(prev => new Set(prev).add(id))
    startDismiss(async () => { await dismissSencoAlert(id) })
  }

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Stat card derived values
  const totalUngraded  = data?.homeworkToMark.reduce((s, h) => s + h.ungradedCount, 0) ?? 0
  const nextLesson     = data?.todaysLessons[0]
    ? `Next: ${formatTime(data.todaysLessons[0].scheduledAt)} — ${data.todaysLessons[0].className}`
    : 'No more today'

  const visibleAlerts = (data?.sencoAlerts ?? []).filter(a => !dismissedAlerts.has(a.id))

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <PageHeader
        title={`${greeting}, ${firstName}`}
        subtitle="Here's your day at a glance"
      />

      {/* MIS timetable strip — only shown when Wonde data is available */}
      {timetable.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="event_note" size="sm" className="text-gray-400" />
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
              Your timetable today · from school MIS
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {timetable.map((lesson, i) => (
              <div
                key={i}
                className="flex-shrink-0 bg-white border border-gray-200 rounded-lg px-3 py-2.5 min-w-[140px] max-w-[180px]"
              >
                <p className="text-[11px] font-mono font-medium text-blue-700">
                  {lesson.startTime}–{lesson.endTime}
                </p>
                <p className="text-[12px] font-semibold text-gray-900 leading-tight mt-0.5 truncate">
                  {lesson.className}
                </p>
                {lesson.subject && (
                  <p className="text-[11px] text-gray-500 leading-tight truncate">{lesson.subject}</p>
                )}
                {lesson.room && (
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{lesson.room}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SENCO alerts banner */}
      {visibleAlerts.length > 0 && (
        <div className="mb-5 space-y-2">
          {visibleAlerts.map(alert => (
            <div
              key={alert.id}
              className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
            >
              <Icon name="notification_important" size="md" className="text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-amber-900">{alert.title}</p>
                <p className="text-[12px] text-amber-800 mt-0.5 leading-relaxed">{alert.body}</p>
                <p className="text-[10px] text-amber-600 mt-1">
                  {new Date(alert.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {alert.linkHref && (
                    <>
                      {' · '}
                      <Link href={alert.linkHref} className="underline hover:text-amber-900">
                        View student profile
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => handleDismissAlert(alert.id)}
                className="text-amber-400 hover:text-amber-700 shrink-0"
                title="Dismiss alert"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ROW 1 — stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {!data ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              icon="calendar_today"
              label="TODAY'S LESSONS"
              value={data.todaysLessons.length}
              trend={nextLesson}
              anchor="today-lessons"
            />
            <StatCard
              icon="assignment"
              label="TO MARK"
              value={data.homeworkToMark.length}
              trend={`${totalUngraded} submission${totalUngraded !== 1 ? 's' : ''} waiting`}
              anchor="homework-mark"
            />
            <StatCard
              icon="inbox"
              label="SUBMITTED TODAY"
              value={data.submissionsToday}
              trend={data.submissionsToday === 0 ? 'None yet today' : `Across ${data.homeworkToMark.length} assignment${data.homeworkToMark.length !== 1 ? 's' : ''}`}
              href="/homework"
            />
            <StatCard
              icon="flag"
              label="OPEN CONCERNS"
              value={data.openConcernsCount}
              trend={data.openConcernsCount > 0 ? 'Requires attention' : 'All clear'}
              iconDanger={data.openConcernsCount > 0}
              anchor="open-concerns"
            />
          </>
        )}
      </div>

      {/* ROW 2 — two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT — Today's lessons */}
        <div id="today-lessons" className="card">
          <p className="text-section-header mb-4">Today&apos;s Lessons</p>
          {!data ? (
            <StudentListSkeleton />
          ) : data.todaysLessons.length === 0 ? (
            <EmptyState icon="calendar_today" title="No lessons today" size="sm" />
          ) : (
            <div>
              {data.todaysLessons.map(lesson => (
                <Link
                  key={lesson.id}
                  href={`/lessons/${lesson.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 -mx-1 transition-colors"
                >
                  <div className="w-16 text-center flex-shrink-0">
                    <p className="text-xs font-medium text-blue-700 bg-blue-50 rounded px-2 py-1">
                      {formatTime(lesson.scheduledAt)}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-data truncate">{lesson.title}</p>
                    <p className="text-meta">{lesson.className} · {lesson.subject}</p>
                  </div>
                  <Icon name="chevron_right" size="sm" className="text-gray-400" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — Homework to mark */}
        <div id="homework-mark" className="card">
          <p className="text-section-header mb-4">Homework to Mark</p>
          {!data ? (
            <div className="space-y-3">
              <HomeworkCardSkeleton />
              <HomeworkCardSkeleton />
              <HomeworkCardSkeleton />
            </div>
          ) : data.homeworkToMark.length === 0 ? (
            <EmptyState
              icon="check_circle"
              title="All marked"
              description="No outstanding submissions"
              size="sm"
            />
          ) : (
            <div>
              {data.homeworkToMark.map(hw => (
                <Link
                  key={hw.id}
                  href={`/homework/${hw.id}/mark`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 -mx-1 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-data truncate">{hw.title}</p>
                    <p className="text-meta">{hw.ungradedCount} ungraded · due {formatDate(hw.dueAt)}</p>
                  </div>
                  <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex-shrink-0">
                    {hw.ungradedCount} to mark
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ROW 3 — open concerns (only when flagCount > 0) */}
      {data && data.openConcernsCount > 0 && (
        <div id="open-concerns" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <p className="text-section-header">Open Concerns</p>
            {['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR'].includes(role) && (
              <Link href="/senco/concerns" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                View all →
              </Link>
            )}
          </div>

          {CONCERN_SECTIONS.map(section => {
            const sectionConcerns = data.openConcerns.filter(c =>
              (section.categories as readonly string[]).includes(c.category)
            )
            return (
              <div key={section.key} className={`rounded-xl border overflow-hidden ${section.headerClass}`}>
                <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${section.headerClass}`}>
                  <Icon name={section.icon} size="sm" className={section.iconClass} />
                  <span className="text-[13px] font-bold text-gray-900 flex-1">{section.label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${section.badgeClass}`}>
                    {sectionConcerns.length}
                  </span>
                </div>
                {sectionConcerns.length === 0 ? (
                  <div className="px-4 py-3 bg-white">
                    <p className="text-[12px] text-gray-400 italic">No concerns in this category.</p>
                  </div>
                ) : (
                  <div className="bg-white divide-y divide-gray-100">
                    {sectionConcerns.map(concern => (
                      <ConcernCard key={concern.id} concern={concern} onUpdate={load} />
                    ))}
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
