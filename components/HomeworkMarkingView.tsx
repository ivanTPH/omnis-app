'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, ChevronUp, CheckCircle2, Clock, AlertCircle, Loader2, ExternalLink, BotMessageSquare, Bell, MessageSquare } from 'lucide-react'
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
  if (!send) return null
  if (send.activeStatus === 'EHCP') {
    return (
      <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded bg-purple-100 text-purple-700 leading-none">EHCP</span>
    )
  }
  return (
    <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-700 leading-none">SEN</span>
  )
}

// ── filter type ────────────────────────────────────────────────────────────────

type PupilFilter = 'all' | 'submitted' | 'returned' | 'missing' | 'send'

// ── main component ─────────────────────────────────────────────────────────────

export default function HomeworkMarkingView({ hw }: { hw: HWData }) {
  const enrolled   = hw.class?.enrolments ?? []
  const maxScore   = maxFromBands(hw.gradingBands)
  const subByStudent = Object.fromEntries(hw.submissions.map(s => [s.student.id, s]))

  const allSubmitted = enrolled
    .filter(e => subByStudent[e.user.id])
    .sort((a, b) => a.user.lastName.localeCompare(b.user.lastName))
  const allMissing = enrolled.filter(e => !subByStudent[e.user.id])
  const allReturned = allSubmitted.filter(e => {
    const s = subByStudent[e.user.id]
    return s?.status === 'RETURNED' || s?.status === 'MARKED'
  })
  const allSend = enrolled.filter(e => hw.sendByStudent[e.user.id])

  const [pupilFilter,     setPupilFilter]     = useState<PupilFilter>('all')
  const [selectedId,      setSelectedId]      = useState<string | null>(
    allSubmitted[0]?.user.id ?? null
  )
  const [showModelAnswer, setShowModelAnswer] = useState(false)
  const [showBands,       setShowBands]       = useState(false)
  const [isPending,       startTransition]    = useTransition()
  const [savedId,         setSavedId]         = useState<string | null>(null)
  const [error,           setError]           = useState<string | null>(null)
  const [remindingId,     setRemindingId]     = useState<string | null>(null)
  const [remindedIds,     setRemindedIds]     = useState<Set<string>>(new Set())
  const router = useRouter()

  // Per-student form state
  const [formState, setFormState] = useState<Record<string, { score: string; grade: string; feedback: string }>>(() => {
    const init: Record<string, { score: string; grade: string; feedback: string }> = {}
    for (const s of hw.submissions) {
      const normScore = normalizeScoreForForm(s.finalScore, maxScore)
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

  const selectedSub     = selectedId ? subByStudent[selectedId] : null
  const selectedStudent = selectedId ? enrolled.find(e => e.user.id === selectedId)?.user : null
  const form            = selectedId ? (formState[selectedId] ?? { score: '', grade: '', feedback: '' }) : null
  const sendInfo        = selectedId ? hw.sendByStudent[selectedId] : null

  // ── filter counts ────────────────────────────────────────────────────────────
  const filterCounts: Record<PupilFilter, number> = {
    all:       enrolled.length,
    submitted: allSubmitted.length,
    returned:  allReturned.length,
    missing:   allMissing.length,
    send:      allSend.length,
  }

  // ── filtered student lists ───────────────────────────────────────────────────
  const visibleSubmitted = pupilFilter === 'all'       ? allSubmitted
    : pupilFilter === 'submitted' ? allSubmitted
    : pupilFilter === 'returned'  ? allReturned
    : pupilFilter === 'send'      ? allSubmitted.filter(e => hw.sendByStudent[e.user.id])
    : [] // missing filter shows no submitted

  const visibleMissing = pupilFilter === 'all'     ? allMissing
    : pupilFilter === 'missing' ? allMissing
    : pupilFilter === 'send'    ? allMissing.filter(e => hw.sendByStudent[e.user.id])
    : []

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
    const autoScore = (selectedSub as any).autoScore ?? 0
    const autoFeedback = (selectedSub as any).autoFeedback ?? ''
    const isLegacyPct = autoScore > maxScore && maxScore <= 20
    const gradeNum = isLegacyPct ? Math.round((autoScore / 100) * maxScore) : autoScore
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

  // ── student list item ────────────────────────────────────────────────────────
  function StudentRow({ studentId, missing = false }: { studentId: string; missing?: boolean }) {
    const user    = enrolled.find(e => e.user.id === studentId)?.user
    const sub     = subByStudent[studentId]
    const fState  = formState[studentId]
    const active  = selectedId === studentId
    const send    = hw.sendByStudent[studentId]
    const isDone  = sub?.status === 'RETURNED' || sub?.status === 'MARKED'
    const isSend  = !!send
    const reminded = remindedIds.has(studentId)

    const rawFinalScore = sub?.finalScore
    const displayScore  = rawFinalScore != null
      ? (rawFinalScore > maxScore && maxScore <= 20
        ? percentToGcseGrade(rawFinalScore)
        : fState?.score ? Number(fState.score) : rawFinalScore)
      : (fState?.score ? Number(fState.score) : null)

    if (!user) return null

    // Amber left-border for missing SEND students
    const rowBorder = missing && isSend ? 'border-l-2 border-amber-400' : ''

    return (
      <div className={`rounded-lg transition-colors ${rowBorder} ${
        active  ? 'bg-blue-50' :
        missing ? (isSend ? 'bg-amber-50/40' : 'opacity-50') :
        'hover:bg-gray-50'
      }`}>
        <button
          onClick={() => !missing && setSelectedId(studentId)}
          className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 ${missing ? 'cursor-default' : ''}`}
        >
          <StudentAvatar
            firstName={user.firstName}
            lastName={user.lastName}
            avatarUrl={user.avatarUrl ?? null}
            size="xs"
          />
          <div className="flex-1 min-w-0">
            <p className={`text-[12px] font-medium truncate ${active ? 'text-blue-700' : 'text-gray-800'}`}>
              {user.firstName} {user.lastName}
              <SendBadge send={send} />
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-gray-400">
                {missing ? 'Not submitted' : statusLabel(sub.status)}
              </span>
              {sub?.autoMarked && !sub?.teacherReviewed && sub?.autoScore != null && (() => {
                const as_ = sub.autoScore as number
                const isLegPct = as_ > maxScore && maxScore <= 20
                const pct = isLegPct ? Math.round(as_) : Math.round((as_ / maxScore) * 100)
                return (
                  <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
                    AI: {pct}% ↗
                  </span>
                )
              })()}
            </div>
          </div>
          {!missing && displayScore != null && (
            <span className={`text-[11px] font-semibold shrink-0 ${isDone ? 'text-green-700' : 'text-gray-500'}`}>
              {rawFinalScore != null && rawFinalScore > maxScore && maxScore <= 20
                ? `Grade ${displayScore}`
                : `${displayScore}/${maxScore}`
              }
            </span>
          )}
          {!missing && isDone && <CheckCircle2 size={13} className="text-green-500 shrink-0" />}
          {!missing && !isDone && sub && <Clock size={13} className="text-amber-400 shrink-0" />}
          {missing && !isSend && <AlertCircle size={13} className="text-gray-300 shrink-0" />}
          {missing && isSend && <AlertCircle size={13} className="text-amber-400 shrink-0" />}
        </button>

        {/* Action buttons row for submission */}
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

        {/* Resend + Message buttons for missing students */}
        {missing && (
          <div className="flex items-center gap-1 px-3 pb-2 -mt-1">
            <button
              onClick={() => handleRemind(studentId)}
              disabled={reminded || remindingId === studentId}
              title={reminded ? 'Reminder sent' : 'Send reminder notification'}
              className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors ${
                reminded
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : 'bg-gray-100 hover:bg-amber-100 text-gray-500 hover:text-amber-700'
              }`}
            >
              {remindingId === studentId
                ? <Loader2 size={9} className="animate-spin" />
                : <Bell size={9} />
              }
              {reminded ? 'Sent' : 'Remind'}
            </button>
            <Link
              href={`/messages?new=1&recipient=${studentId}&context=${encodeURIComponent(`Re: ${hw.title}`)}`}
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
  const isAutoMarkedPending = selectedSub?.autoMarked && !selectedSub?.teacherReviewed

  const gradeState: 'auto' | 'confirmed' | 'final' | 'empty' =
    isReturned ? 'final' :
    selectedSub?.teacherReviewed ? 'confirmed' :
    isAutoMarkedPending ? 'auto' :
    'empty'
  const gradeBoxClass =
    gradeState === 'auto'      ? 'bg-amber-50 border-amber-300 text-amber-700' :
    gradeState === 'confirmed' ? 'bg-green-50 border-green-300 text-green-700' :
    'bg-white border-gray-300 text-gray-900'
  const gradeLabel =
    gradeState === 'auto'      ? 'Auto-suggested — confirm' :
    gradeState === 'confirmed' ? 'Confirmed ✓' :
    'Auto-suggested'

  // ── filter chips config ──────────────────────────────────────────────────────
  const chips: { key: PupilFilter; label: string; activeClass: string }[] = [
    { key: 'all',       label: 'All',       activeClass: 'bg-gray-700 text-white' },
    { key: 'submitted', label: 'Submitted', activeClass: 'bg-blue-600 text-white' },
    { key: 'returned',  label: 'Returned',  activeClass: 'bg-green-600 text-white' },
    { key: 'missing',   label: 'Missing',   activeClass: 'bg-rose-500 text-white' },
    { key: 'send',      label: 'SEND',      activeClass: 'bg-purple-600 text-white' },
  ]

  return (
    <div className="flex h-full min-h-0">

      {/* ── Left: student list ─────────────────────────────────────────────── */}
      <div className="w-56 shrink-0 border-r border-gray-200 flex flex-col">

        {/* Filter chips */}
        <div className="px-3 pt-3 pb-2 border-b border-gray-100 space-y-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pupils</p>
          <div className="flex flex-wrap gap-1">
            {chips.map(chip => (
              <button
                key={chip.key}
                onClick={() => {
                  setPupilFilter(prev => prev === chip.key ? 'all' : chip.key)
                  // When switching to submitted/returned, select first in that group
                  if (chip.key === 'submitted') setSelectedId(allSubmitted[0]?.user.id ?? null)
                  if (chip.key === 'returned')  setSelectedId(allReturned[0]?.user.id ?? null)
                  if (chip.key === 'all')       setSelectedId(allSubmitted[0]?.user.id ?? null)
                }}
                className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border transition-colors ${
                  pupilFilter === chip.key
                    ? chip.activeClass + ' border-transparent'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                {chip.label}
                <span className={`text-[9px] font-bold ${
                  pupilFilter === chip.key ? 'opacity-80' : 'text-gray-400'
                }`}>{filterCounts[chip.key]}</span>
              </button>
            ))}
          </div>
          {(() => {
            const needsReview = hw.submissions.filter(s => s.autoMarked && !s.teacherReviewed).length
            return needsReview > 0 ? (
              <p className="text-[10px] text-amber-600 font-medium">
                ⚠ {needsReview} awaiting your review
              </p>
            ) : null
          })()}
        </div>

        <div className="flex-1 overflow-auto py-2 px-2 space-y-0.5">
          {visibleSubmitted.map(e => (
            <StudentRow key={e.user.id} studentId={e.user.id} />
          ))}
          {visibleMissing.length > 0 && (
            <>
              {pupilFilter !== 'missing' && (
                <div className="px-2 pt-3 pb-1">
                  <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Not submitted</span>
                </div>
              )}
              {visibleMissing.map(e => (
                <StudentRow key={e.user.id} studentId={e.user.id} missing />
              ))}
            </>
          )}
          {visibleSubmitted.length === 0 && visibleMissing.length === 0 && (
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
                avatarUrl={selectedStudent.avatarUrl ?? null}
                size="md"
              />
              <div>
                <p className="text-[16px] font-semibold text-gray-900">
                  {selectedStudent.firstName} {selectedStudent.lastName}
                  {sendInfo && (
                    <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      sendInfo.activeStatus === 'EHCP'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {sendInfo.activeStatus === 'EHCP' ? 'EHCP' : 'SEN Support'}
                      {sendInfo.needArea ? ` · ${sendInfo.needArea}` : ''}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Submitted {new Date(selectedSub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {isReturned && selectedSub.markedAt &&
                    new Date(selectedSub.markedAt) >= new Date(selectedSub.submittedAt) &&
                    ` · Returned ${new Date(selectedSub.markedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                  }
                  {' · '}
                  {selectedSub.status === 'MARKED'
                    ? <span className="font-medium text-amber-600">Awaiting review</span>
                    : <span className={`font-medium ${isReturned ? 'text-green-600' : 'text-gray-500'}`}>{statusLabel(selectedSub.status)}</span>
                  }
                </p>
              </div>
            </div>

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
            {hw.gradingBands && typeof hw.gradingBands === 'object' && !Array.isArray(hw.gradingBands) && (
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
                    Auto-marked
                  </span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {(selectedSub as any).autoScore != null && (() => {
                    const as_ = (selectedSub as any).autoScore
                    const isLegacyPct = as_ > maxScore && maxScore <= 20
                    const rawScore = isLegacyPct ? Math.round((as_ / 100) * maxScore) : as_
                    const pct = isLegacyPct ? as_ : Math.round((as_ / maxScore) * 100)
                    return (
                      <p className="text-sm text-amber-900">
                        Score: <strong>{rawScore}/{maxScore} ({pct}% · Grade {percentToGcseGrade(pct)})</strong>
                      </p>
                    )
                  })()}
                  {(selectedSub as any).autoFeedback && (
                    <p className="text-xs text-amber-800 leading-relaxed line-clamp-3">
                      {(selectedSub as any).autoFeedback}
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
                      placeholder="0"
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
                      : isAlreadyMarked ? 'Update & Return' : 'Mark & Return'
                    }
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
