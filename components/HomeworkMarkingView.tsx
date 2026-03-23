'use client'
import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, ChevronUp, ChevronLeft, CheckCircle2, Clock, AlertCircle, Loader2, ExternalLink, BotMessageSquare, Bell, MessageSquare, BookOpen } from 'lucide-react'
import { markSubmission, resendHomeworkReminder } from '@/app/actions/homework'
import { percentToGcseGrade, normalizeScoreForForm } from '@/lib/grading'
import StudentAvatar from '@/components/StudentAvatar'

type HWData = NonNullable<Awaited<ReturnType<typeof import('@/app/actions/homework').getHomeworkForMarking>>>

// ── helpers ────────────────────────────────────────────────────────────────────

function maxFromBands(bands: unknown): number {
  if (!bands || typeof bands !== 'object' || Array.isArray(bands)) return 9
  return Math.max(
    ...Object.keys(bands as Record<string, string>)
      .flatMap(k => k.split(/[-–]/).map(Number).filter(n => !isNaN(n))),
    1,
  )
}

function suggestGrade(score: number, bands: unknown): string {
  if (!bands || typeof bands !== 'object' || Array.isArray(bands)) return ''
  for (const range of Object.keys(bands as Record<string, string>)) {
    const parts = range.split(/[-–]/).map(Number)
    const [lo, hi] = parts.length === 1 ? [parts[0], parts[0]] : [parts[0], parts[1]]
    if (score >= lo && score <= hi) return range
  }
  return String(score)
}

// ── status helpers ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  RETURNED:         'bg-green-100 text-green-700',
  MARKED:           'bg-blue-100  text-blue-700',
  UNDER_REVIEW:     'bg-amber-100 text-amber-700',
  RESUBMISSION_REQ: 'bg-rose-100  text-rose-700',
  SUBMITTED:        'bg-gray-100  text-gray-600',
}

function statusLabel(s: string) {
  if (s === 'RESUBMISSION_REQ') return 'Resubmit'
  return s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ')
}

// ── SEND badge ─────────────────────────────────────────────────────────────────

function SendBadge({ send }: { send: { activeStatus: string; needArea: string | null } | undefined }) {
  if (!send || send.activeStatus === 'NONE') return null
  return send.activeStatus === 'EHCP' ? (
    <span
      title={`EHCP${send.needArea ? ` · ${send.needArea}` : ''}`}
      className="text-[9px] font-bold px-1 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 leading-none shrink-0"
    >
      EHCP
    </span>
  ) : (
    <span
      title={`SEN Support${send.needArea ? ` · ${send.needArea}` : ''}`}
      className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 leading-none shrink-0"
    >
      SEN
    </span>
  )
}

// ── submission status badge ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'RETURNED') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
      ✓ Returned
    </span>
  )
  if (status === 'MARKED') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
      ⚡ Awaiting Review
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
      ● Submitted
    </span>
  )
}

// ── filter type ────────────────────────────────────────────────────────────────

type PupilFilter = 'all' | 'submitted' | 'returned' | 'missing' | 'send'

// ── main component ─────────────────────────────────────────────────────────────

export default function HomeworkMarkingView({ hw }: { hw: HWData }) {
  const enrolled       = hw.class?.enrolments ?? []
  const maxScore       = maxFromBands(hw.gradingBands)
  const sendByStudent  = hw.sendByStudent
  const kPlanByStudent = (hw as any).kPlanByStudent as Record<string, { teacherActions: string[] }> | undefined ?? {}

  // Map student ID → submission
  const subByStudent = useMemo(
    () => Object.fromEntries(hw.submissions.map(s => [s.student.id, s])),
    [hw.submissions],
  )

  // Flat pupil list: every enrolled student with optional submission
  const pupils = useMemo(
    () => enrolled
      .map(e => ({ ...e.user, submission: subByStudent[e.user.id] ?? null }))
      .sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [enrolled, subByStudent],
  )

  // ── filter counts ─────────────────────────────────────────────────────────
  // "submitted" = received but not yet returned to student
  const submittedCount = pupils.filter(p =>
    p.submission && p.submission.status !== 'RETURNED'
  ).length

  const returnedCount = pupils.filter(p =>
    p.submission?.status === 'RETURNED'
  ).length

  const missingCount = pupils.filter(p => !p.submission).length

  const sendCount = pupils.filter(p =>
    sendByStudent[p.id]?.activeStatus && sendByStudent[p.id].activeStatus !== 'NONE'
  ).length

  const sendMissingCount = pupils.filter(p =>
    !p.submission &&
    sendByStudent[p.id]?.activeStatus &&
    sendByStudent[p.id].activeStatus !== 'NONE'
  ).length

  const needsReviewCount = hw.submissions.filter(s =>
    (s.autoMarked || (s as any).autoScore != null) &&
    !s.teacherReviewed &&
    s.status !== 'RETURNED'
  ).length

  // ── state ─────────────────────────────────────────────────────────────────
  const [pupilFilter,     setPupilFilter]     = useState<PupilFilter>('all')
  const [selectedId,      setSelectedId]      = useState<string | null>(
    () => pupils.find(p => p.submission)?.id ?? null
  )
  const [showModelAnswer, setShowModelAnswer] = useState(false)
  const [showBands,       setShowBands]       = useState(false)
  const [isPending,       startTransition]    = useTransition()
  const [savedId,         setSavedId]         = useState<string | null>(null)
  const [error,           setError]           = useState<string | null>(null)
  const [remindingId,     setRemindingId]     = useState<string | null>(null)
  const [remindedIds,     setRemindedIds]     = useState<Set<string>>(new Set())
  const [kPlanOpen,       setKPlanOpen]       = useState(false)
  const [kPlanChecked,    setKPlanChecked]    = useState<boolean[]>([])
  const [kPlanStudentId,  setKPlanStudentId]  = useState<string | null>(null)
  const router = useRouter()

  // Per-student form state
  const [formState, setFormState] = useState<Record<string, { score: string; grade: string; feedback: string }>>(() => {
    const init: Record<string, { score: string; grade: string; feedback: string }> = {}
    for (const s of hw.submissions) {
      // Pre-fill from finalScore; fall back to autoScore when not yet teacher-marked
      let normScore = normalizeScoreForForm(s.finalScore, maxScore)
      if (normScore === '') {
        const autoScore = (s as any).autoScore as number | null
        if (autoScore != null) {
          const isLegPct = autoScore > maxScore && maxScore <= 20
          const rawScore = isLegPct ? Math.round((autoScore / 100) * maxScore) : autoScore
          normScore = String(rawScore)
        }
      }
      const feedbackValue = s.feedback ?? (s as any).autoFeedback ?? ''
      const autoGrade = normScore !== ''
        ? (suggestGrade(Number(normScore), hw.gradingBands) ||
           String(percentToGcseGrade(Math.round((Number(normScore) / maxScore) * 100))))
        : ''
      init[s.student.id] = {
        score:    normScore,
        grade:    s.grade ?? autoGrade,
        feedback: feedbackValue,
      }
    }
    return init
  })

  // ── filtered pupil list ───────────────────────────────────────────────────
  const filteredPupils = useMemo(() => {
    switch (pupilFilter) {
      case 'submitted':
        return pupils.filter(p => p.submission && p.submission.status !== 'RETURNED')
      case 'returned':
        return pupils.filter(p => p.submission?.status === 'RETURNED')
      case 'missing':
        return pupils.filter(p => !p.submission)
      case 'send':
        return pupils.filter(p =>
          sendByStudent[p.id]?.activeStatus && sendByStudent[p.id].activeStatus !== 'NONE'
        )
      default:
        return pupils
    }
  }, [pupils, pupilFilter, sendByStudent])

  // Split for visual divider (submitted above, missing below)
  const listSubmitted = filteredPupils.filter(p => !!p.submission)
  const listMissing   = filteredPupils.filter(p => !p.submission)

  const selectedSub     = selectedId ? subByStudent[selectedId] ?? null : null
  const selectedStudent = selectedId ? pupils.find(p => p.id === selectedId) ?? null : null
  const form            = selectedId ? (formState[selectedId] ?? { score: '', grade: '', feedback: '' }) : null
  const sendInfo        = selectedId ? sendByStudent[selectedId] : null
  const selectedKPlan   = selectedId ? kPlanByStudent[selectedId] : null

  // Reset checklist when selected student changes
  if (selectedId !== kPlanStudentId && selectedKPlan) {
    setKPlanStudentId(selectedId)
    setKPlanChecked(new Array(selectedKPlan.teacherActions.length).fill(false))
    setKPlanOpen(false)
  }

  function setField(field: 'score' | 'grade' | 'feedback', value: string) {
    if (!selectedId) return
    setFormState(prev => {
      const current = prev[selectedId] ?? { score: '', grade: '', feedback: '' }
      const next    = { ...current, [field]: value }
      if (field === 'score' && value !== '') {
        const n = Number(value)
        if (!isNaN(n)) {
          const suggested = suggestGrade(n, hw.gradingBands)
          next.grade = suggested || String(percentToGcseGrade(Math.round((n / maxScore) * 100)))
        }
      }
      return { ...prev, [selectedId]: next }
    })
  }

  function handleSave() {
    if (!selectedId || !selectedSub || !form) return
    const scoreNum = Number(form.score)
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxScore) {
      setError(`Score must be between 0 and ${maxScore}`)
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await markSubmission(selectedSub.id, {
          teacherScore: scoreNum,
          feedback:     form.feedback,
          grade:        form.grade || undefined,
        })
        setSavedId(selectedId)
        router.refresh()
        setTimeout(() => setSavedId(null), 2500)
      } catch {
        setError('Failed to save. Please try again.')
      }
    })
  }

  function handleApprove() {
    if (!selectedId || !selectedSub) return
    const autoScore    = selectedAutoScore ?? 0
    const autoFeedback = selectedAutoFeedback ?? ''
    const isLegacyPct  = autoScore > maxScore && maxScore <= 20
    const gradeNum     = isLegacyPct ? Math.round((autoScore / 100) * maxScore) : autoScore
    const pctForGrade = isLegacyPct ? autoScore : Math.round((autoScore / maxScore) * 100)
    const gradeStr = suggestGrade(gradeNum, hw.gradingBands) ||
      String(percentToGcseGrade(pctForGrade))
    setError(null)
    startTransition(async () => {
      try {
        await markSubmission(selectedSub.id, {
          teacherScore: gradeNum,
          feedback:     autoFeedback,
          grade:        gradeStr || undefined,
        })
        setSavedId(selectedId)
        router.refresh()
        setTimeout(() => setSavedId(null), 2500)
      } catch {
        setError('Failed to save. Please try again.')
      }
    })
  }

  function handleRemind(studentId: string) {
    setRemindingId(studentId)
    startTransition(async () => {
      try {
        await resendHomeworkReminder(hw.id, studentId)
        setRemindedIds(prev => new Set([...prev, studentId]))
      } catch {
        // silently fail — reminder is best-effort
      } finally {
        setRemindingId(null)
      }
    })
  }

  // ── student list row ─────────────────────────────────────────────────────
  function StudentRow({ pupil, missing = false }: {
    pupil: typeof pupils[number]
    missing?: boolean
  }) {
    const sub     = pupil.submission
    const fState  = formState[pupil.id]
    const active  = selectedId === pupil.id
    const send    = sendByStudent[pupil.id]
    const isSend  = !!(send && send.activeStatus !== 'NONE')
    const isDone  = sub?.status === 'RETURNED' || sub?.status === 'MARKED'
    const reminded = remindedIds.has(pupil.id)

    const rawFinalScore = sub?.finalScore
    const displayScore  = rawFinalScore != null
      ? (rawFinalScore > maxScore && maxScore <= 20
        ? percentToGcseGrade(rawFinalScore)
        : fState?.score ? Number(fState.score) : rawFinalScore)
      : (fState?.score ? Number(fState.score) : null)

    const autoScore       = (sub as any)?.autoScore ?? null
    const autoMarked      = (sub as any)?.autoMarked ?? false
    const teacherReviewed = (sub as any)?.teacherReviewed ?? false

    const showAiBadge = !!(
      sub && !missing &&
      (autoMarked || autoScore != null) &&
      !teacherReviewed &&
      sub.status !== 'RETURNED'
    )

    const rowBorder = missing && isSend ? 'border-l-2 border-amber-400' : ''

    return (
      <div className={`rounded-lg transition-colors ${rowBorder} ${
        active  ? 'bg-blue-50' :
        missing ? (isSend ? 'bg-amber-50/40' : 'opacity-50') :
        'hover:bg-gray-50'
      }`}>
        <button
          onClick={() => !missing && setSelectedId(pupil.id)}
          className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 ${missing ? 'cursor-default' : ''}`}
        >
          <StudentAvatar
            firstName={pupil.firstName}
            lastName={pupil.lastName}
            avatarUrl={(pupil as any).avatarUrl ?? null}
            size="xs"
          />
          <div className="flex-1 min-w-0">
            <p className={`text-[12px] font-medium overflow-hidden whitespace-nowrap ${active ? 'text-blue-700' : 'text-gray-800'}`}>
              {pupil.firstName} {pupil.lastName}
            </p>
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              <SendBadge send={send} />
              <span className="text-[10px] text-gray-400">
                {missing ? 'Not submitted' : sub ? statusLabel(sub.status) : ''}
              </span>
              {showAiBadge && autoScore != null && (() => {
                const isLegPct = autoScore > maxScore && maxScore <= 20
                const pct = isLegPct ? Math.round(autoScore) : Math.round((autoScore / maxScore) * 100)
                return (
                  <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                    AI: {pct}% ↗
                  </span>
                )
              })()}
            </div>
          </div>
          {!missing && displayScore != null && (
            <span className={`text-[11px] font-semibold shrink-0 ${isDone ? 'text-green-700' : 'text-gray-500'}`}>
              Grade {displayScore}
            </span>
          )}
          {!missing && isDone && <CheckCircle2 size={13} className="text-green-500 shrink-0" />}
          {!missing && !isDone && sub && <Clock size={13} className="text-amber-400 shrink-0" />}
          {missing && !isSend && <AlertCircle size={13} className="text-gray-300 shrink-0" />}
          {missing && isSend  && <AlertCircle size={13} className="text-amber-400 shrink-0" />}
        </button>

        {/* Full-page marking link for submitted */}
        {!missing && sub && (
          <div className="flex justify-end px-2 pb-1 -mt-1">
            <Link
              href={`/homework/${hw.id}/mark/${sub.id}`}
              title="Open full marking view"
              className="px-2 py-1 text-gray-300 hover:text-blue-500 transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink size={11} />
            </Link>
          </div>
        )}

        {/* Remind + Message for missing students */}
        {missing && (
          <div className="flex items-center gap-1 px-3 pb-2 -mt-1">
            <button
              onClick={() => handleRemind(pupil.id)}
              disabled={reminded || remindingId === pupil.id}
              title={reminded ? 'Reminder sent' : 'Send reminder notification'}
              className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors ${
                reminded
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : 'bg-gray-100 hover:bg-amber-100 text-gray-500 hover:text-amber-700'
              }`}
            >
              {remindingId === pupil.id
                ? <Loader2 size={9} className="animate-spin" />
                : <Bell size={9} />
              }
              {reminded ? 'Sent' : 'Remind'}
            </button>
            <Link
              href={`/messages?new=1&recipient=${pupil.id}&context=${encodeURIComponent(`Re: ${hw.title}`)}`}
              title={isSend ? 'Message student (SEND — please use sensitive language)' : 'Message student'}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-700 transition-colors"
            >
              <MessageSquare size={9} />
              Message
              {isSend && <span className="ml-0.5 text-[8px] text-purple-500">SEND</span>}
            </Link>
          </div>
        )}
      </div>
    )
  }

  const isAlreadyMarked     = selectedSub?.status === 'RETURNED' || selectedSub?.status === 'MARKED'
  const isReturned          = selectedSub?.status === 'RETURNED'
  const selectedAutoScore       = (selectedSub as any)?.autoScore ?? null
  const selectedAutoMarked      = (selectedSub as any)?.autoMarked ?? false
  const selectedTeacherReviewed = (selectedSub as any)?.teacherReviewed ?? false
  const selectedAutoFeedback    = (selectedSub as any)?.autoFeedback ?? null

  const isAutoMarkedPending = !!(
    selectedSub &&
    (selectedAutoMarked || selectedAutoScore != null) &&
    !selectedTeacherReviewed &&
    selectedSub.status !== 'RETURNED'
  )

  const gradeState: 'auto' | 'confirmed' | 'final' | 'empty' =
    isReturned ? 'final' :
    selectedTeacherReviewed ? 'confirmed' :
    isAutoMarkedPending ? 'auto' :
    'empty'
  const gradeHasValue = !!(form?.grade && form.grade !== '')
  const gradeBoxClass =
    gradeState === 'auto'      ? 'bg-amber-50 border-amber-300 text-amber-700' :
    gradeState === 'confirmed' ? 'bg-green-50 border-green-300 text-green-700' :
    gradeState === 'final'     ? 'bg-white border-gray-300 text-gray-900 font-semibold' :
    gradeHasValue              ? 'bg-amber-50 border-amber-200 text-amber-700' :
    'bg-white border-gray-300 text-gray-900'
  const gradeLabel =
    gradeState === 'auto'      ? 'Auto-suggested — confirm' :
    gradeState === 'confirmed' ? 'Confirmed ✓' :
    gradeState === 'final'     ? 'Final grade' :
    gradeHasValue              ? 'Auto-suggested from score' :
    'Enter score first'

  // ── filter click helper ───────────────────────────────────────────────────
  function handleFilterClick(key: PupilFilter) {
    setPupilFilter(prev => prev === key ? 'all' : key)
    if (key === 'submitted') {
      const first = pupils.find(p => p.submission && p.submission.status !== 'RETURNED')
      setSelectedId(first?.id ?? null)
    } else if (key === 'returned') {
      const first = pupils.find(p => p.submission?.status === 'RETURNED')
      setSelectedId(first?.id ?? null)
    } else if (key === 'all' || key === 'send' || key === 'missing') {
      const first = pupils.find(p => p.submission)
      setSelectedId(first?.id ?? null)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white shrink-0">

        {/* Left: back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/homework" className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <ChevronLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-semibold text-gray-900 truncate text-sm">{hw.title}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {hw.class && (
                <span className="text-xs text-blue-700 font-medium">{hw.class.name}</span>
              )}
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                hw.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' :
                hw.status === 'CLOSED'    ? 'bg-gray-200 text-gray-500'   :
                'bg-amber-100 text-amber-700'
              }`}>{hw.status}</span>
              <span className="text-xs text-gray-400">
                Due {new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              {hw.lesson && (
                <span className="text-xs text-gray-400">↳ {hw.lesson.title}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: coloured clickable counter tiles */}
        <div className="flex items-center gap-2 shrink-0 ml-4">

          <button
            onClick={() => handleFilterClick('all')}
            style={{
              backgroundColor: pupilFilter === 'all' ? '#1f2937' : '#f9fafb',
              color:            pupilFilter === 'all' ? '#ffffff' : '#374151',
              border: '1px solid #e5e7eb',
            }}
            className="flex flex-col items-center w-16 py-2 rounded-xl"
          >
            <span className="text-2xl font-bold leading-none">{pupils.length}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide mt-1">All</span>
          </button>

          <button
            onClick={() => handleFilterClick('submitted')}
            style={{
              backgroundColor: pupilFilter === 'submitted' ? '#2563eb' : '#eff6ff',
              color:            pupilFilter === 'submitted' ? '#ffffff' : '#1d4ed8',
              border: '1px solid #bfdbfe',
            }}
            className="flex flex-col items-center w-16 py-2 rounded-xl"
          >
            <span className="text-2xl font-bold leading-none">{submittedCount}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide mt-1">Due</span>
          </button>

          <button
            onClick={() => handleFilterClick('returned')}
            style={{
              backgroundColor: pupilFilter === 'returned' ? '#16a34a' : '#f0fdf4',
              color:            pupilFilter === 'returned' ? '#ffffff' : '#15803d',
              border: '1px solid #bbf7d0',
            }}
            className="flex flex-col items-center w-16 py-2 rounded-xl"
          >
            <span className="text-2xl font-bold leading-none">{returnedCount}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide mt-1">Done</span>
          </button>

          <button
            onClick={() => handleFilterClick('missing')}
            style={{
              backgroundColor: pupilFilter === 'missing' ? '#dc2626' : '#fef2f2',
              color:            pupilFilter === 'missing' ? '#ffffff' : '#dc2626',
              border: '1px solid #fecaca',
            }}
            className="flex flex-col items-center w-16 py-2 rounded-xl"
          >
            <span className="text-2xl font-bold leading-none">{missingCount}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide mt-1">Missing</span>
          </button>

          {sendCount > 0 && (
            <button
              onClick={() => handleFilterClick('send')}
              style={{
                backgroundColor: pupilFilter === 'send' ? '#9333ea' : '#faf5ff',
                color:            pupilFilter === 'send' ? '#ffffff' : '#7c3aed',
                border: '1px solid #e9d5ff',
              }}
              className="flex flex-col items-center w-16 py-2 rounded-xl"
            >
              <span className="text-2xl font-bold leading-none">{sendCount}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide mt-1">SEND</span>
            </button>
          )}

        </div>
      </div>

      {/* ── Two-panel layout ───────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── Left: student list ─────────────────────────────────────────────── */}
      <div className="w-56 shrink-0 border-r border-gray-200 flex flex-col">

        {needsReviewCount > 0 && (
          <div className="px-3 py-2 border-b border-amber-100 bg-amber-50">
            <p className="text-[10px] text-amber-600 font-medium">⚡ {needsReviewCount} awaiting AI review</p>
          </div>
        )}

        <div className="flex-1 overflow-auto py-2 px-2 space-y-0.5">
          {listSubmitted.map(p => (
            <StudentRow key={p.id} pupil={p} />
          ))}
          {listMissing.length > 0 && (
            <>
              {pupilFilter !== 'missing' && (
                <div className="px-2 pt-3 pb-1">
                  <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Not submitted</span>
                </div>
              )}
              {listMissing.map(p => (
                <StudentRow key={p.id} pupil={p} missing />
              ))}
            </>
          )}
          {listSubmitted.length === 0 && listMissing.length === 0 && (
            <p className="text-[11px] text-gray-400 px-3 py-4 text-center">No pupils in this filter</p>
          )}
        </div>
      </div>

      {/* ── Right: marking panel ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {!selectedSub || !selectedStudent || !form ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-[13px]">Select a submission to mark</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-8 py-6 space-y-5">

            {/* student header */}
            <div className="flex items-center gap-3">
              <StudentAvatar
                firstName={selectedStudent.firstName}
                lastName={selectedStudent.lastName}
                avatarUrl={(selectedStudent as any).avatarUrl ?? null}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[16px] font-semibold text-gray-900">
                    {selectedStudent.firstName} {selectedStudent.lastName}
                  </p>
                  {sendInfo && sendInfo.activeStatus !== 'NONE' && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      sendInfo.activeStatus === 'EHCP'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {sendInfo.activeStatus === 'EHCP' ? 'EHCP' : 'SEN Support'}
                      {sendInfo.needArea ? ` · ${sendInfo.needArea}` : ''}
                    </span>
                  )}
                  <StatusBadge status={selectedSub.status} />
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Submitted {new Date(selectedSub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {isReturned && selectedSub.markedAt &&
                    new Date(selectedSub.markedAt) >= new Date(selectedSub.submittedAt) && (
                      <span className="text-green-600 ml-1">
                        · Returned {new Date(selectedSub.markedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )
                  }
                </p>
              </div>
            </div>

            {/* K Plan lesson actions */}
            {selectedKPlan && selectedKPlan.teacherActions.length > 0 && (
              <div className={`border rounded-xl overflow-hidden ${
                sendInfo?.activeStatus === 'EHCP' ? 'border-purple-200' : 'border-blue-200'
              }`}>
                <button
                  onClick={() => setKPlanOpen(v => !v)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left ${
                    sendInfo?.activeStatus === 'EHCP'
                      ? 'bg-purple-50 hover:bg-purple-100'
                      : 'bg-blue-50 hover:bg-blue-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen size={13} className={sendInfo?.activeStatus === 'EHCP' ? 'text-purple-600' : 'text-blue-600'} />
                    <span className={`text-[12px] font-semibold ${sendInfo?.activeStatus === 'EHCP' ? 'text-purple-800' : 'text-blue-800'}`}>
                      K Plan — Lesson actions for {selectedStudent?.firstName}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      sendInfo?.activeStatus === 'EHCP'
                        ? 'bg-purple-200 text-purple-700'
                        : 'bg-blue-200 text-blue-700'
                    }`}>
                      {selectedKPlan.teacherActions.length} actions
                    </span>
                  </div>
                  {kPlanOpen ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
                </button>
                {kPlanOpen && (
                  <div className="px-4 py-3 space-y-2 bg-white">
                    <p className="text-[10px] text-gray-400 italic mb-2">Tick off as reminders — not saved</p>
                    {selectedKPlan.teacherActions.map((action, i) => (
                      <label key={i} className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={kPlanChecked[i] ?? false}
                          onChange={() => {
                            setKPlanChecked(prev => {
                              const next = [...prev]
                              next[i] = !next[i]
                              return next
                            })
                          }}
                          className="mt-0.5 w-3.5 h-3.5 rounded border-gray-300 cursor-pointer"
                          style={{ accentColor: sendInfo?.activeStatus === 'EHCP' ? '#7c3aed' : '#2563eb' }}
                        />
                        <span className={`text-[12px] leading-snug ${kPlanChecked[i] ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {action}
                        </span>
                      </label>
                    ))}
                    <a
                      href={`/student/${selectedId}/send`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-600 mt-1 transition-colors"
                    >
                      <ExternalLink size={11} /> Full SEND record
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* submission content */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Submission</p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                {selectedSub.content || <span className="text-gray-400 italic">No content recorded</span>}
              </div>
            </div>

            {/* model answer (collapsible) */}
            {hw.modelAnswer && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowModelAnswer(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <span className="text-[12px] font-semibold text-gray-700">Model Answer</span>
                  {showModelAnswer ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </button>
                {showModelAnswer && (
                  <div className="px-4 py-4 text-[12px] text-gray-700 leading-relaxed bg-white whitespace-pre-wrap">
                    {hw.modelAnswer}
                  </div>
                )}
              </div>
            )}

            {/* grading bands (collapsible) */}
            {hw.gradingBands && typeof hw.gradingBands === 'object' && !Array.isArray(hw.gradingBands) && Object.keys(hw.gradingBands as object).length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowBands(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <span className="text-[12px] font-semibold text-gray-700">Mark Scheme</span>
                  {showBands ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </button>
                {showBands && (
                  <div className="divide-y divide-gray-100">
                    {Object.entries(hw.gradingBands as Record<string, string>).map(([band, desc]) => (
                      <div key={band} className="flex gap-3 px-4 py-3">
                        <span className="text-[11px] font-bold text-blue-700 w-10 shrink-0">{band}</span>
                        <span className="text-[12px] text-gray-600">{desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Suggested Mark section */}
            {isAutoMarkedPending && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
                  <BotMessageSquare size={15} className="text-amber-600 shrink-0" />
                  <span className="text-sm font-semibold text-amber-800">AI Suggested Mark</span>
                  <span className="ml-auto text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                    {selectedAutoMarked ? 'Auto-marked' : 'AI score available'}
                  </span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {selectedAutoScore != null && (() => {
                    const isLegacyPct = selectedAutoScore > maxScore && maxScore <= 20
                    const rawScore = isLegacyPct ? Math.round((selectedAutoScore / 100) * maxScore) : selectedAutoScore
                    const pct = isLegacyPct ? selectedAutoScore : Math.round((selectedAutoScore / maxScore) * 100)
                    return (
                      <p className="text-sm text-amber-900">
                        Score: <strong>{rawScore}/{maxScore} ({pct}% · Grade {percentToGcseGrade(pct)})</strong>
                      </p>
                    )
                  })()}
                  {selectedAutoFeedback && (
                    <p className="text-xs text-amber-800 leading-relaxed line-clamp-3">
                      {selectedAutoFeedback}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleApprove}
                      disabled={isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors"
                    >
                      {isPending
                        ? <Loader2 size={12} className="animate-spin" />
                        : <CheckCircle2 size={12} />
                      }
                      Approve &amp; Return
                    </button>
                    <p className="flex items-center text-[11px] text-amber-700 px-2">or edit below ↓</p>
                  </div>
                </div>
              </div>
            )}

            {/* marking form */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-[12px] font-semibold text-gray-700">
                  {isAlreadyMarked ? 'Update Mark' : isAutoMarkedPending ? 'Edit before returning' : 'Mark Submission'}
                </p>
              </div>
              <div className="px-4 py-4 space-y-4">

                {/* score + grade row */}
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">
                      Score (out of {maxScore})
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={maxScore}
                      value={form.score}
                      onChange={e => setField('score', e.target.value)}
                      className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-[14px] font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="—"
                    />
                    {form.score !== '' && Number(form.score) >= 0 && (
                      <div className="mt-2 h-1.5 w-48 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            Number(form.score) / maxScore >= 0.7 ? 'bg-green-500' :
                            Number(form.score) / maxScore >= 0.4 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min((Number(form.score) / maxScore) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Grade</label>
                    <input
                      type="text"
                      value={form.grade}
                      onChange={e => setField('grade', e.target.value)}
                      className={`w-20 border rounded-lg px-3 py-2 text-[14px] font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${gradeBoxClass}`}
                      placeholder="—"
                    />
                    <p className={`text-[10px] mt-1 ${
                      gradeState === 'auto'      ? 'text-amber-600' :
                      gradeState === 'confirmed' ? 'text-green-600' :
                      gradeHasValue              ? 'text-amber-500' :
                      'text-gray-400'
                    }`}>{gradeLabel}</p>
                  </div>
                </div>

                {/* feedback */}
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">
                    Feedback to Student
                  </label>
                  <textarea
                    rows={5}
                    value={form.feedback}
                    onChange={e => setField('feedback', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-[13px] text-gray-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Write constructive feedback for the student…"
                  />
                </div>

                {/* error */}
                {error && (
                  <p className="text-[12px] text-rose-600 font-medium">{error}</p>
                )}

                {/* submit */}
                <div className="flex items-center justify-between pt-1">
                  {savedId === selectedId ? (
                    <span className="flex items-center gap-1.5 text-[12px] text-green-600 font-medium">
                      <CheckCircle2 size={14} /> Returned to student
                    </span>
                  ) : <span />}
                  <button
                    onClick={handleSave}
                    disabled={isPending || form.score === ''}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors"
                  >
                    {isPending && <Loader2 size={13} className="animate-spin" />}
                    {isAutoMarkedPending
                      ? 'Confirm & Return'
                      : isReturned ? '✓ Returned — Edit & Resend'
                      : isAlreadyMarked ? 'Update & Return'
                      : 'Mark & Return'
                    }
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      </div>{/* end two-panel layout */}
    </div>
  )
}
