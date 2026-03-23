'use client'
import { useState, useEffect, useTransition, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, Pencil, Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import LessonSlideOver, { type SlideOverClass } from './LessonSlideOver'
import LessonFolder, { type FolderTab } from './LessonFolder'
import { rescheduleLesson, getWeekLessons } from '@/app/actions/lessons'

// ── Time grid config ──────────────────────────────────────────────────────────
const SLOT_H    = 56   // px per hour
const WEEKDAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

// Full literal class strings — required by Tailwind v4 scanner
const PALETTES = [
  { bg: 'bg-blue-100',    border: 'border-l-blue-500',    text: 'text-blue-900'    },
  { bg: 'bg-purple-100',  border: 'border-l-purple-500',  text: 'text-purple-900'  },
  { bg: 'bg-emerald-100', border: 'border-l-emerald-500', text: 'text-emerald-900' },
  { bg: 'bg-amber-100',   border: 'border-l-amber-500',   text: 'text-amber-900'   },
  { bg: 'bg-rose-100',    border: 'border-l-rose-500',    text: 'text-rose-900'    },
  { bg: 'bg-teal-100',    border: 'border-l-teal-500',    text: 'text-teal-900'    },
  { bg: 'bg-indigo-100',  border: 'border-l-indigo-500',  text: 'text-indigo-900'  },
  { bg: 'bg-orange-100',  border: 'border-l-orange-500',  text: 'text-orange-900'  },
]

const colorCache = new Map<string, typeof PALETTES[0]>()
let colorIdx = 0
function palette(subject: string) {
  if (!colorCache.has(subject)) colorCache.set(subject, PALETTES[colorIdx++ % PALETTES.length])
  return colorCache.get(subject)!
}

function getWeekStart(d: Date): Date {
  const r   = new Date(d)
  const dow = r.getDay()
  r.setDate(r.getDate() - (dow === 0 ? 6 : dow - 1))
  r.setHours(0, 0, 0, 0)
  return r
}
function fmt(d: Date) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }

// ── Types ─────────────────────────────────────────────────────────────────────

export type CalendarLesson = {
  id:             string
  title:          string
  scheduledAt:    string
  endsAt?:        string
  published:      boolean
  className:      string
  subject:        string
  lessonType?:    string
  hasPlan:        boolean
  hasSlides:      boolean
  hasHomework:    boolean
  homeworkStatus: string | null
  hasOther:       boolean
}

export type UnscheduledLesson = {
  id: string
  title: string
  className: string
  subject: string
}

interface Props {
  lessons:          CalendarLesson[]
  unscheduled:      UnscheduledLesson[]
  firstName:        string
  classes:          SlideOverClass[]
  allClasses:       SlideOverClass[]
  teacherSubjects?: string[]
  startHour:        number
  endHour:          number
  extStartHour:     number
  extEndHour:       number
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeeklyCalendar({
  lessons, unscheduled, firstName, classes, allClasses, teacherSubjects = [],
  startHour, endHour, extStartHour, extEndHour,
}: Props) {
  const today  = new Date()
  const router = useRouter()
  const [, startReschedule] = useTransition()

  // Current-week start (stable reference)
  const currentWeekStart = useMemo(() => getWeekStart(new Date()), [])

  const [weekStart,       setWeekStart]       = useState(() => getWeekStart(today))
  // Client-fetched lessons for non-current weeks; null = use server prop
  const [fetchedLessons,  setFetchedLessons]  = useState<CalendarLesson[] | null>(null)

  // Sync server prop → state when on current week (after router.refresh())
  useEffect(() => {
    if (weekStart.getTime() === currentWeekStart.getTime()) {
      setFetchedLessons(null)
    }
  }, [lessons, weekStart, currentWeekStart])

  // Fetch lessons from server when navigating to a different week
  useEffect(() => {
    if (weekStart.getTime() === currentWeekStart.getTime()) return
    let cancelled = false
    getWeekLessons(weekStart.toISOString()).then(data => {
      if (!cancelled) setFetchedLessons(data)
    }).catch(() => {
      if (!cancelled) setFetchedLessons([])
    })
    return () => { cancelled = true }
  }, [weekStart, currentWeekStart])

  // Which lesson array to display
  const displayLessons = fetchedLessons ?? lessons
  const [dragging,        setDragging]        = useState<string | null>(null)
  const [dropTarget,      setDropTarget]      = useState<string | null>(null)
  const [optimisticMoves, setOptimisticMoves] = useState<Map<string, { di: number; hr: number }>>(new Map())
  const [slideOver,    setSlideOver]    = useState<{ date: string; hour: number; endHour?: number } | null>(null)
  const [folderId,     setFolderId]     = useState<string | null>(null)
  const [folderTab,    setFolderTab]    = useState<FolderTab>('Overview')
  const [folderWizard, setFolderWizard] = useState(false)

  // Drag-to-create
  const [dragCreate, setDragCreate] = useState<{
    dayIdx: number; startHour: number; currentHour: number
  } | null>(null)

  // Release drag-to-create if mouse is released outside the grid
  useEffect(() => {
    function onUp() { setDragCreate(null) }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  // Single-click opens lesson panel
  function onLessonClick(id: string) {
    setFolderWizard(false)
    setFolderTab('Overview')
    setFolderId(prev => prev === id ? null : id)
  }

  const HOURS = Array.from({ length: extEndHour - extStartHour }, (_, i) => extStartHour + i)

  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const isToday       = (d: Date) => d.toDateString() === today.toDateString()
  const isCurrentWeek = today >= weekStart && today <= days[4]

  const nowPx = isCurrentWeek
    ? (today.getHours() - extStartHour) * SLOT_H + (today.getMinutes() / 60) * SLOT_H
    : -1

  // Slot map: "dayIdx-hour" → lessons (used for drop targeting + "add lesson" hint)
  const slotMap = new Map<string, CalendarLesson[]>()
  for (const l of displayLessons) {
    const dt  = new Date(l.scheduledAt)
    const di  = Math.round((dt.getTime() - weekStart.getTime()) / 86_400_000)
    const hr  = dt.getHours()
    if (di >= 0 && di < 5 && hr >= extStartHour && hr < extEndHour) {
      const k = `${di}-${hr}`
      slotMap.set(k, [...(slotMap.get(k) ?? []), l])
    }
  }
  // Apply optimistic drag-drop overrides
  for (const [id, { di: newDi, hr: newHr }] of optimisticMoves) {
    const moved = displayLessons.find(l => l.id === id)
    if (!moved) continue
    const origDt  = new Date(moved.scheduledAt)
    const origDi  = Math.round((origDt.getTime() - weekStart.getTime()) / 86_400_000)
    const origKey = `${origDi}-${origDt.getHours()}`
    slotMap.set(origKey, (slotMap.get(origKey) ?? []).filter(l => l.id !== id))
    const newKey  = `${newDi}-${newHr}`
    slotMap.set(newKey, [...(slotMap.get(newKey) ?? []), moved])
  }

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }
  const goToday  = () => setWeekStart(getWeekStart(today))

  return (
    <div style={{
      display:             'grid',
      gridTemplateRows:    folderId ? '42% 1fr' : '1fr',
      flex:                1,
      minHeight:           0,
      overflow:            'hidden',
    }}>

      {/* ── Main calendar area — top grid row ────────────────────── */}
      <div
        className="flex min-w-0 bg-white overflow-hidden"
        style={{ minHeight: 0 }}
      >

        {/* ── Calendar panel ──────────────────────────────── */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 sm:px-5 h-12 border-b border-gray-200 shrink-0">
            <span className="hidden sm:block text-[14px] font-semibold text-gray-900">
              Good morning, {firstName}
            </span>
            <div className="flex items-center gap-1 sm:ml-auto">
              <button
                onClick={goToday}
                className="h-7 px-3 text-[12px] font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Today
              </button>
              <button onClick={prevWeek} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100">
                <ChevronLeft size={15} className="text-gray-400" />
              </button>
              <button onClick={nextWeek} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100">
                <ChevronRight size={15} className="text-gray-400" />
              </button>
              <span className="text-[12px] text-gray-500 font-medium ml-1 w-36 shrink-0">
                {fmt(days[0])} – {fmt(days[4])}
              </span>
            </div>
          </div>

          {/* Scrollable grid */}
          <div className="flex-1 overflow-auto">
            <div className="flex min-h-full">

              {/* Time gutter */}
              <div className="w-12 shrink-0 sticky left-0 z-10 bg-white">
                <div className="h-14 border-b border-gray-200" />
                {HOURS.map(h => {
                  const outOfHours = h < startHour || h >= endHour
                  return (
                    <div key={h} style={{ height: SLOT_H }} className={`relative border-b ${outOfHours ? 'border-gray-100 bg-gray-50/50' : 'border-gray-100'}`}>
                      <span className="absolute -top-2 right-2 text-[10px] font-medium text-gray-400 select-none">
                        {h < 10 ? `0${h}` : h}:00
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Day columns */}
              <div className="flex flex-1">
                {days.map((day, di) => {
                  const todayCol = isToday(day)
                  const dateStr  = day.toISOString().split('T')[0]
                  return (
                    <div key={di} className="flex-1 min-w-[110px] flex flex-col border-l border-gray-200">

                      {/* Day header */}
                      <div className="h-14 flex flex-col items-center justify-center border-b border-gray-200 shrink-0 sticky top-0 z-10 bg-white">
                        <span className={`text-[10px] font-semibold tracking-widest uppercase ${todayCol ? 'text-blue-500' : 'text-gray-400'}`}>
                          {WEEKDAYS[di]}
                        </span>
                        <div className={`w-9 h-9 mt-0.5 flex items-center justify-center rounded-full text-[22px] font-light leading-none ${todayCol ? 'bg-blue-500 text-white' : 'text-gray-800'}`}>
                          {day.getDate()}
                        </div>
                      </div>

                      {/* Hour slots — drop targets + absolute lesson tiles */}
                      <div className="relative flex-1">
                        {HOURS.map(h => {
                          const outOfHours  = h < startHour || h >= endHour
                          const key         = `${di}-${h}`
                          const slotLessons = slotMap.get(key) ?? []
                          const isTarget    = dropTarget === key

                          const isDragHighlight = dragCreate !== null &&
                            dragCreate.dayIdx === di &&
                            h >= Math.min(dragCreate.startHour, dragCreate.currentHour) &&
                            h <= Math.max(dragCreate.startHour, dragCreate.currentHour)

                          return (
                            <div
                              key={h}
                              style={{ height: SLOT_H }}
                              className={`border-b relative group
                                ${outOfHours ? 'bg-gray-50/60 border-gray-100' : todayCol ? 'bg-blue-50/20 border-gray-100' : 'border-gray-100'}
                                ${isTarget        ? '!bg-blue-50'  : ''}
                                ${isDragHighlight ? '!bg-blue-100' : ''}
                                ${dragCreate?.dayIdx === di ? 'select-none cursor-ns-resize' : ''}
                              `}
                              onDragOver={e => { e.preventDefault(); setDropTarget(key) }}
                              onDragLeave={() => setDropTarget(null)}
                              onDrop={e => {
                                e.preventDefault()
                                setDropTarget(null)
                                const id = e.dataTransfer.getData('id')
                                setDragging(null)
                                if (!id) return
                                const dragged = displayLessons.find(l => l.id === id)
                                const origStart = dragged ? new Date(dragged.scheduledAt) : null
                                const origEnd   = dragged?.endsAt ? new Date(dragged.endsAt) : null
                                const durationMs = origStart && origEnd ? origEnd.getTime() - origStart.getTime() : 3600_000
                                const newStart = new Date(day)
                                newStart.setHours(h, 0, 0, 0)
                                const newEnd = new Date(newStart.getTime() + durationMs)
                                if (dragged) setOptimisticMoves(m => new Map(m).set(id, { di, hr: h }))
                                startReschedule(async () => {
                                  try {
                                    await rescheduleLesson(id, newStart.toISOString(), newEnd.toISOString())
                                    // Re-fetch immediately so the calendar never goes blank while
                                    // router.refresh() propagates the server-component update.
                                    const fresh = await getWeekLessons(weekStart.toISOString())
                                    setFetchedLessons(fresh)
                                    router.refresh()
                                  } finally {
                                    setOptimisticMoves(m => { const n = new Map(m); n.delete(id); return n })
                                  }
                                })
                              }}
                              onMouseDown={e => {
                                if (slotLessons.length === 0 && e.button === 0) {
                                  e.preventDefault()
                                  setDragCreate({ dayIdx: di, startHour: h, currentHour: h })
                                }
                              }}
                              onMouseMove={() => {
                                if (dragCreate?.dayIdx === di) {
                                  setDragCreate(prev => prev ? { ...prev, currentHour: h } : null)
                                }
                              }}
                              onMouseUp={() => {
                                if (dragCreate?.dayIdx === di) {
                                  const startH = Math.min(dragCreate.startHour, dragCreate.currentHour)
                                  const endH   = Math.max(dragCreate.startHour, dragCreate.currentHour) + 1
                                  setSlideOver({ date: dateStr, hour: startH, endHour: endH > startH + 1 ? endH : undefined })
                                  setDragCreate(null)
                                }
                              }}
                            >
                              {/* Half-hour hairline */}
                              <div className="absolute inset-x-0 top-1/2 border-b border-gray-100/60 pointer-events-none" />

                              {/* "Add lesson" hover / drag highlight overlay */}
                              {slotLessons.length === 0 && (
                                <div
                                  className={`absolute inset-0.5 rounded-md flex items-center justify-center transition-opacity bg-blue-50/80 border border-dashed border-blue-300 z-[5] pointer-events-none
                                    ${isDragHighlight ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                                  `}
                                >
                                  <span className="flex items-center gap-0.5 text-[11px] text-blue-400 font-medium">
                                    <Plus size={10} />Add lesson
                                  </span>
                                </div>
                              )}

                              {/* FIX 3 — Apple Calendar: lessons positioned by actual start time + duration */}
                              {slotLessons.map((lesson, ti) => {
                                const c = palette(lesson.subject)
                                const isOptimistic = optimisticMoves.has(lesson.id)
                                const dt = new Date(lesson.scheduledAt)
                                // Sub-hour offset within the slot (0 when optimistically moved)
                                const minuteOffset = isOptimistic ? 0 : dt.getMinutes()
                                const topPx = (minuteOffset / 60) * SLOT_H + 2
                                // Duration → height
                                const endDt = (!isOptimistic && lesson.endsAt) ? new Date(lesson.endsAt) : null
                                const durationH = endDt
                                  ? Math.max(0.5, (endDt.getTime() - dt.getTime()) / 3600000)
                                  : 1
                                const heightPx = durationH * SLOT_H - 4

                                return (
                                  <div
                                    key={lesson.id}
                                    draggable
                                    onClick={() => onLessonClick(lesson.id)}
                                    onDragStart={e => { e.dataTransfer.setData('id', lesson.id); setDragging(lesson.id) }}
                                    onDragEnd={() => setDragging(null)}
                                    style={{ top: topPx, height: heightPx, left: 2 + ti * 5, right: 2 }}
                                    className={`absolute rounded-md border-l-[3px] px-2 py-1 cursor-pointer z-[6] transition-opacity select-none overflow-hidden
                                      ${c.bg} ${c.border} ${c.text}
                                      ${dragging === lesson.id ? 'opacity-40' : 'opacity-100'}
                                    `}
                                  >
                                    <p className="text-[11px] font-semibold leading-tight truncate">{lesson.title}</p>
                                    <p className="text-[10px] opacity-60 truncate mt-0.5">{lesson.className}</p>

                                    {/* Resource completeness badges */}
                                    <div className="flex gap-0.5 mt-1">
                                      <span className={`text-[8px] font-bold px-1 rounded leading-4 ${lesson.hasPlan     ? 'bg-green-500 text-white' : 'bg-white/60 text-gray-400'}`}>P</span>
                                      <span className={`text-[8px] font-bold px-1 rounded leading-4 ${lesson.hasSlides   ? 'bg-green-500 text-white' : 'bg-white/60 text-gray-400'}`}>S</span>
                                      {lesson.hasHomework ? (
                                        <span className={`inline-flex items-center px-1 rounded leading-4 h-4 ${lesson.homeworkStatus === 'DRAFT' ? 'bg-amber-400 text-white' : 'bg-green-500 text-white'}`} title={lesson.homeworkStatus === 'DRAFT' ? 'Homework (draft)' : 'Homework (published)'}>
                                          {lesson.homeworkStatus === 'DRAFT'
                                            ? <Pencil size={7} strokeWidth={2.5} />
                                            : <Lock size={7} strokeWidth={2.5} />}
                                        </span>
                                      ) : (
                                        <span className="text-[8px] font-bold px-1 rounded leading-4 bg-white/60 text-gray-400">H</span>
                                      )}
                                      {lesson.hasOther && <span className="text-[8px] font-bold px-1 rounded leading-4 bg-blue-200 text-blue-800">+</span>}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })}

                        {/* Current-time indicator */}
                        {todayCol && nowPx >= 0 && nowPx <= SLOT_H * HOURS.length && (
                          <div
                            className="absolute left-0 right-0 z-20 pointer-events-none"
                            style={{ top: nowPx }}
                          >
                            <div className="flex items-center">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 -ml-1" />
                              <div className="flex-1 h-px bg-red-500" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Lessons sidebar — hidden on small screens ─────── */}
        <div className="hidden lg:flex w-52 shrink-0 border-l border-gray-200 flex-col bg-gray-50/50">
          <div className="px-4 h-12 flex flex-col justify-center border-b border-gray-200 bg-white shrink-0">
            <p className="text-[13px] font-semibold text-gray-900 leading-tight">Lessons</p>
            <p className="text-[10px] text-gray-400">Drag to schedule</p>
          </div>

          <div className="flex-1 overflow-auto p-2.5 space-y-1.5">
            {unscheduled.length === 0 ? (
              <p className="text-[11px] text-gray-400 text-center pt-10 leading-relaxed px-2">
                No unscheduled lessons.<br />Create one below.
              </p>
            ) : (
              unscheduled.map(l => {
                const c = palette(l.subject)
                return (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('id', l.id); setDragging(l.id) }}
                    onDragEnd={() => setDragging(null)}
                    className={`rounded-lg border-l-[3px] px-2.5 py-2 cursor-grab active:cursor-grabbing ${c.bg} ${c.border} ${c.text} ${dragging === l.id ? 'opacity-40' : ''}`}
                  >
                    <p className="text-[12px] font-semibold truncate leading-tight">{l.title}</p>
                    <p className="text-[10px] opacity-60 truncate mt-0.5">{l.className}</p>
                  </div>
                )
              })
            )}
          </div>

          <div className="p-2.5 border-t border-gray-200 bg-white shrink-0">
            <button
              onClick={() => setSlideOver({ date: new Date().toISOString().split('T')[0], hour: startHour })}
              className="flex items-center justify-center gap-1 w-full py-2 rounded-lg border border-dashed border-gray-300 text-[11px] text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors"
            >
              <Plus size={11} />New lesson
            </button>
          </div>
        </div>
      </div>

      {/* ── Inline lesson panel — bottom grid row ───────────────────── */}
      {folderId && (
        <div style={{
          minHeight:       0,
          display:         'flex',
          flexDirection:   'column',
          overflow:        'hidden',
          borderTop:       '2px solid #e5e7eb',
          backgroundColor: 'white',
          animation:       'slideUp 0.25s ease-out',
        }}>
          <LessonFolder
            lessonId={folderId}
            defaultTab={folderTab}
            wizardMode={folderWizard}
            onClose={() => setFolderId(null)}
            inline
          />
        </div>
      )}

      {/* ── Slide-over (create lesson modal) ────────────────────────── */}
      <LessonSlideOver
        open={slideOver !== null}
        onClose={() => setSlideOver(null)}
        defaultDate={slideOver?.date}
        defaultHour={slideOver?.hour}
        defaultEndHour={slideOver?.endHour}
        classes={classes}
        allClasses={allClasses}
        teacherSubjects={teacherSubjects}
        onCreated={id => { setSlideOver(null); setFolderWizard(true); setFolderId(id); router.refresh() }}
      />
    </div>
  )
}
