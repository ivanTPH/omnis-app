'use client'
import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import SendBadge from '@/components/ui/SendBadge'
import StudentAvatar from '@/components/StudentAvatar'
import { markSubmission, suggestHomeworkGrade } from '@/app/actions/homework'

// ── Types ─────────────────────────────────────────────────────────────────────

type Student = {
  id:        string
  firstName: string
  lastName:  string
  avatarUrl: string | null
}

type Sub = {
  id:          string
  content:     string
  grade:       string | null
  teacherScore: number | null
  feedback:    string | null
  status:      string
  submittedAt: Date
  student:     Student
}

type GradeSuggestion = {
  grade:      string
  rationale:  string
  feedback:   string
  confidence: 'high' | 'medium' | 'low'
}

type HW = {
  id:           string
  title:        string
  modelAnswer:  string | null
  gradingBands: unknown
  dueAt:        Date
  class:        { name: string; subject: string } | null
  lesson:       { id: string; title: string } | null
  submissions:  Sub[]
  sendByStudent: Record<string, { activeStatus: string }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GRADES = ['9', '8', '7', '6', '5', '4', '3', '2', '1', 'U']

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

// ── MarkingPanel ──────────────────────────────────────────────────────────────

function MarkingPanel({
  sub,
  hw,
  autoAdvance,
  onAutoAdvanceChange,
  onGraded,
  canGrade,
  cachedSuggestion,
}: {
  sub:                  Sub
  hw:                   HW
  autoAdvance:          boolean
  onAutoAdvanceChange:  (v: boolean) => void
  onGraded:             (subId: string, grade: string) => void
  canGrade:             boolean
  cachedSuggestion?:    GradeSuggestion | null
}) {
  const [grade, setGrade]               = useState(sub.grade ?? cachedSuggestion?.grade ?? '')
  const [note, setNote]                 = useState(sub.feedback ?? cachedSuggestion?.feedback ?? '')
  const [markSchemeOpen, setMarkSchemeOpen] = useState(false)
  const [isPending, startTransition]    = useTransition()
  const [saved, setSaved]               = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [suggestion, setSuggestion]     = useState<GradeSuggestion | null>(cachedSuggestion ?? null)
  const [suggesting, setSuggesting]     = useState(false)
  const [suggestionFailed, setSuggestionFailed] = useState(false)

  // Apply cached suggestion when it arrives after mount
  useEffect(() => {
    if (!cachedSuggestion?.grade || suggestion) return
    setSuggestion(cachedSuggestion)
    setGrade(g => g || cachedSuggestion.grade)
    if (!sub.feedback) setNote(cachedSuggestion.feedback)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedSuggestion])

  // Fetch AI grade suggestion directly if no cached suggestion available
  useEffect(() => {
    if (!canGrade || sub.grade || !hw.modelAnswer || cachedSuggestion?.grade) return
    let cancelled = false
    setSuggesting(true)
    suggestHomeworkGrade(sub.id)
      .then(r => {
        if (cancelled) return
        if (r.grade) {
          setSuggestion(r)
          setGrade(g => g || r.grade)
          if (!sub.feedback) setNote(r.feedback)
        } else {
          setSuggestionFailed(true)
        }
      })
      .catch(() => { if (!cancelled) setSuggestionFailed(true) })
      .finally(() => { if (!cancelled) setSuggesting(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSave() {
    if (!grade) return
    setError(null)
    startTransition(async () => {
      try {
        await markSubmission(sub.id, {
          teacherScore: grade === 'U' ? 0 : parseInt(grade),
          feedback:     note,
          grade,
        })
        setSaved(true)
        setSuggestion(null)
        // Brief "Saved" flash before advancing
        setTimeout(() => {
          onGraded(sub.id, grade)
        }, 700)
      } catch {
        setError('Failed to save grade. Please try again.')
      }
    })
  }

  function handleAcceptAndReturn() {
    if (!grade) return
    setError(null)
    startTransition(async () => {
      try {
        await markSubmission(sub.id, {
          teacherScore: grade === 'U' ? 0 : parseInt(grade),
          feedback:     note,
          grade,
        })
        setSaved(true)
        setSuggestion(null)
        setTimeout(() => {
          onGraded(sub.id, grade)
        }, 400)
      } catch {
        setError('Failed to save grade. Please try again.')
      }
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable submission + mark scheme */}
      <div className="flex-1 overflow-y-auto pb-4">

        {/* SECTION A — Student submission */}
        <div className="card m-4">
          <div className="flex items-center gap-3 mb-4">
            <StudentAvatar
              firstName={sub.student.firstName}
              lastName={sub.student.lastName}
              avatarUrl={sub.student.avatarUrl}
              userId={sub.student.id}
              size="md"
            />
            <div>
              <p className="text-section-header">
                {sub.student.firstName} {sub.student.lastName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <SendBadge
                  status={(hw.sendByStudent[sub.student.id]?.activeStatus ?? 'NONE') as 'EHCP' | 'SEN_SUPPORT' | 'NONE'}
                />
                <p className="text-meta">Submitted {formatDate(sub.submittedAt)}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <p className="text-label mb-2">STUDENT ANSWER</p>
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {sub.content
                ? sub.content
                : <span className="text-gray-400 italic">No written response submitted</span>
              }
            </div>
          </div>
        </div>

        {/* SECTION B — Mark scheme (collapsible) */}
        {hw.modelAnswer && (
          <div className="card mx-4 mb-4">
            <button
              onClick={() => setMarkSchemeOpen(v => !v)}
              className="w-full flex items-center justify-between"
            >
              <p className="text-section-header">Mark Scheme</p>
              <Icon
                name={markSchemeOpen ? 'expand_less' : 'expand_more'}
                size="sm"
                className="text-gray-400"
              />
            </button>
            {markSchemeOpen && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {hw.modelAnswer}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* SECTION C — Grade input (always visible at bottom) */}
      <div className="shrink-0 bg-white border-t border-gray-200 p-4">

        {canGrade ? (
          <>
            {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}

            {suggestion && !saved && (
              <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                    <Icon name="auto_awesome" size="sm" />
                    AI suggests Grade {suggestion.grade}
                    <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      suggestion.confidence === 'high'   ? 'bg-green-100 text-green-700' :
                      suggestion.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                                                           'bg-gray-100 text-gray-500'
                    }`}>{suggestion.confidence}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setSuggestion(null)}
                    className="text-blue-400 hover:text-blue-600 flex-shrink-0"
                    title="Dismiss"
                  >
                    <Icon name="close" size="sm" />
                  </button>
                </div>
                <p className="text-xs text-blue-600 leading-relaxed mb-1">{suggestion.rationale}</p>
                {suggestion.feedback && (
                  <p className="text-xs text-blue-700 italic leading-relaxed border-t border-blue-200 pt-1.5 mt-1.5">
                    &ldquo;{suggestion.feedback}&rdquo;
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSuggestion(null)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-300 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"
                  >
                    <Icon name="edit" size="sm" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptAndReturn}
                    disabled={!grade || isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 px-3 py-1.5 rounded-lg transition"
                  >
                    <Icon name="check_circle" size="sm" />
                    Accept &amp; Return
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-5 items-start">
              {/* Left: GCSE grade picker */}
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <label className="text-label">GCSE GRADE</label>
                  {suggesting && (
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <Icon name="refresh" size="sm" className="animate-spin" />
                      AI loading…
                    </span>
                  )}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {GRADES.map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGrade(g)}
                      className={`w-8 h-8 text-xs font-bold rounded-lg border transition-colors ${
                        grade === g
                          ? (suggestion && grade === suggestion.grade && !saved
                              ? 'bg-gray-200 text-gray-500 border-gray-300'
                              : 'bg-blue-700 text-white border-blue-700')
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-700'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                {!suggesting && suggestion && grade === suggestion.grade && !saved && (
                  <span className="text-[10px] text-blue-500 font-medium">AI suggested — click to confirm</span>
                )}
                {!suggesting && suggestionFailed && !suggestion && (
                  <span className="text-[10px] text-amber-600">Could not auto-suggest grade — please grade manually</span>
                )}
              </div>

              {/* Right: Teacher feedback + save + auto-advance */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="flex flex-col gap-1.5">
                  <label className="text-label">TEACHER FEEDBACK</label>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Optional feedback for the student…"
                    rows={3}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-700 w-full"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoAdvance}
                      onChange={e => onAutoAdvanceChange(e.target.checked)}
                      className="rounded border-gray-300 text-blue-700 focus:ring-blue-700"
                    />
                    <span className="text-meta">Auto-advance to next student after saving</span>
                  </label>
                  <button
                    onClick={handleSave}
                    disabled={!grade || isPending}
                    className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm px-5 rounded-lg h-9 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPending
                      ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      : saved
                        ? <Icon name="check_circle" size="sm" />
                        : <Icon name="save" size="sm" />
                    }
                    {saved ? 'Saved!' : 'Save Grade'}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* READ-ONLY view for non-teaching staff */
          <div className="space-y-3">
            {sub.grade && (
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-label mb-1">GRADE</p>
                  <span className="text-2xl font-bold text-gray-900">{sub.grade}</span>
                </div>
              </div>
            )}
            {sub.feedback && (
              <div>
                <p className="text-label mb-1">TEACHER FEEDBACK</p>
                <p className="text-sm text-gray-700 leading-relaxed">{sub.feedback}</p>
              </div>
            )}
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Icon name="info" size="sm" className="text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">Grades can only be set by the class teacher.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HomeworkMarkingV2({ hw, canGrade = true }: { hw: HW; canGrade?: boolean }) {
  // Initialise grades map from existing submission grades
  const [gradesMap, setGradesMap] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    for (const s of hw.submissions) {
      if (s.grade) m[s.id] = s.grade
    }
    return m
  })

  // Select first ungraded submission on mount, or first submission if all graded
  const [selectedSubId, setSelectedSubId] = useState<string | null>(() => {
    const first = hw.submissions.find(s => !s.grade)
    return (first ?? hw.submissions[0])?.id ?? null
  })

  const [autoAdvance, setAutoAdvance] = useState(true)

  // Pre-fetch AI suggestions for first 5 ungraded submissions with staggered 800ms delay
  const [suggestionsCache, setSuggestionsCache] = useState<Record<string, GradeSuggestion>>({})
  useEffect(() => {
    if (!canGrade || !hw.modelAnswer) return
    const ungraded = hw.submissions.filter(s => !s.grade).slice(0, 5)
    const timers = ungraded.map((sub, i) =>
      setTimeout(async () => {
        try {
          const r = await suggestHomeworkGrade(sub.id)
          if (r.grade) setSuggestionsCache(prev => ({ ...prev, [sub.id]: r }))
        } catch {}
      }, i * 800),
    )
    return () => timers.forEach(t => clearTimeout(t))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleGraded(subId: string, grade: string) {
    setGradesMap(prev => ({ ...prev, [subId]: grade }))
    if (autoAdvance) {
      const currentIdx = hw.submissions.findIndex(s => s.id === subId)
      const nextSub    = hw.submissions
        .slice(currentIdx + 1)
        .find(s => !gradesMap[s.id])
      if (nextSub) setSelectedSubId(nextSub.id)
    }
  }

  const gradedCount = Object.keys(gradesMap).length
  const totalCount  = hw.submissions.length
  const selectedSub = hw.submissions.find(s => s.id === selectedSubId) ?? null

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

      {/* Page header */}
      <div className="px-6 pt-5 pb-0 bg-white border-b border-gray-200 shrink-0">
        <PageHeader
          title={hw.title}
          subtitle={`${hw.class?.name ?? '—'} · Due ${formatDate(hw.dueAt)}`}
          backHref="/homework"
          backLabel="Homework"
          action={
            hw.lesson ? (
              <Link
                href={`/dashboard`}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <Icon name="calendar_today" size="sm" />
                {hw.lesson.title}
              </Link>
            ) : undefined
          }
        />
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT PANEL — student list */}
        <div className="w-72 flex-shrink-0 border-r border-gray-200 overflow-y-auto bg-white">

          {/* Panel header + progress */}
          <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <p className="text-section-header truncate">{hw.title}</p>
            <p className="text-meta mt-0.5">{gradedCount}/{totalCount} marked</p>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-1.5 bg-blue-700 rounded-full transition-all duration-300"
                style={{ width: `${totalCount > 0 ? (gradedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Student rows */}
          {hw.submissions.length === 0 ? (
            <div className="p-6">
              <EmptyState icon="inbox" title="No submissions yet" size="sm" />
            </div>
          ) : (
            hw.submissions.map(sub => {
              const sendStatus = hw.sendByStudent[sub.student.id]?.activeStatus
              const grade      = gradesMap[sub.id]
              const isSelected = selectedSubId === sub.id

              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubId(sub.id)}
                  className={`w-full flex items-center gap-3 p-3 border-b border-gray-100 text-left hover:bg-gray-50 transition-colors ${
                    isSelected ? 'bg-blue-50 border-l-[3px] border-l-blue-700' : 'border-l-[3px] border-l-transparent'
                  }`}
                >
                  <StudentAvatar
                    firstName={sub.student.firstName}
                    lastName={sub.student.lastName}
                    avatarUrl={sub.student.avatarUrl}
                    userId={sub.student.id}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-data truncate">
                      {sub.student.firstName} {sub.student.lastName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {sendStatus && sendStatus !== 'NONE' && (
                        <SendBadge status={sendStatus as 'EHCP' | 'SEN_SUPPORT'} />
                      )}
                    </div>
                  </div>
                  {grade
                    ? (
                      <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex-shrink-0">
                        {grade}
                      </span>
                    )
                    : <Icon name="schedule" size="sm" className="text-gray-300 flex-shrink-0" />
                  }
                </button>
              )
            })
          )}
        </div>

        {/* RIGHT PANEL — submission + marking form */}
        <div className="flex-1 overflow-hidden bg-gray-50">
          {selectedSub
            ? (
              <MarkingPanel
                key={selectedSub.id}
                sub={selectedSub}
                hw={hw}
                autoAdvance={autoAdvance}
                onAutoAdvanceChange={setAutoAdvance}
                onGraded={handleGraded}
                canGrade={canGrade}
                cachedSuggestion={suggestionsCache[selectedSub.id] ?? null}
              />
            )
            : (
              <div className="h-full flex items-center justify-center">
                <EmptyState
                  icon="assignment"
                  title="Select a student to mark"
                  description="Choose a student from the list on the left"
                />
              </div>
            )
          }
        </div>

      </div>
    </div>
  )
}
