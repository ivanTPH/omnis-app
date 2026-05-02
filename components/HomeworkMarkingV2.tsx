'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import SendBadge from '@/components/ui/SendBadge'
import StudentAvatar from '@/components/StudentAvatar'
import { markSubmission } from '@/app/actions/homework'

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

type HW = {
  id:          string
  title:       string
  modelAnswer: string | null
  dueAt:       Date
  class:       { name: string; subject: string } | null
  lesson:      { id: string; title: string } | null
  submissions: Sub[]
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
}: {
  sub:                  Sub
  hw:                   HW
  autoAdvance:          boolean
  onAutoAdvanceChange:  (v: boolean) => void
  onGraded:             (subId: string, grade: string) => void
}) {
  const [grade, setGrade]               = useState(sub.grade ?? '')
  const [note, setNote]                 = useState(sub.feedback ?? '')
  const [markSchemeOpen, setMarkSchemeOpen] = useState(false)
  const [isPending, startTransition]    = useTransition()
  const [saved, setSaved]               = useState(false)
  const [error, setError]               = useState<string | null>(null)

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
        // Brief "Saved" flash before advancing
        setTimeout(() => {
          onGraded(sub.id, grade)
        }, 700)
      } catch {
        setError('Failed to save grade. Please try again.')
      }
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable submission + mark scheme */}
      <div className="flex-1 overflow-y-auto pb-48">

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

      {/* SECTION C — Grade input (sticky bottom) */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
        {error && (
          <p className="text-xs text-rose-600 mb-3">{error}</p>
        )}
        <div className="flex items-end gap-4">

          {/* GCSE grade selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-label">GCSE GRADE</label>
            <select
              value={grade}
              onChange={e => setGrade(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-data bg-white w-28 focus:outline-none focus:ring-2 focus:ring-blue-700"
            >
              <option value="">—</option>
              {GRADES.map(g => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
          </div>

          {/* Teacher feedback */}
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-label">TEACHER FEEDBACK</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional feedback for the student…"
              rows={2}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!grade || isPending}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm px-5 rounded-lg h-10 flex-shrink-0 self-end disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

        {/* Auto-advance toggle */}
        <label className="flex items-center gap-2 mt-3 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={autoAdvance}
            onChange={e => onAutoAdvanceChange(e.target.checked)}
            className="rounded border-gray-300 text-blue-700 focus:ring-blue-700"
          />
          <span className="text-meta">Auto-advance to next student after saving</span>
        </label>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HomeworkMarkingV2({ hw }: { hw: HW }) {
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
