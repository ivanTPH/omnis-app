'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, CheckCircle2, Clock, AlertCircle, Loader2, ExternalLink } from 'lucide-react'
import { markSubmission } from '@/app/actions/homework'
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
  if (!bands || typeof bands !== 'object' || Array.isArray(bands)) return String(score)
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

// ── main component ─────────────────────────────────────────────────────────────

export default function HomeworkMarkingView({ hw }: { hw: HWData }) {
  const enrolled   = hw.class?.enrolments ?? []
  const maxScore   = maxFromBands(hw.gradingBands)
  const subByStudent = Object.fromEntries(hw.submissions.map(s => [s.student.id, s]))

  // split: submitted students first (sorted by lastName), then missing
  const submittedStudents = enrolled
    .filter(e => subByStudent[e.user.id])
    .sort((a, b) => a.user.lastName.localeCompare(b.user.lastName))
  const missingStudents = enrolled.filter(e => !subByStudent[e.user.id])

  const [selectedId, setSelectedId] = useState<string | null>(
    submittedStudents[0]?.user.id ?? null
  )
  const [showModelAnswer, setShowModelAnswer] = useState(false)
  const [showBands, setShowBands]             = useState(false)
  const [isPending, startTransition]          = useTransition()
  const [savedId, setSavedId]                 = useState<string | null>(null)

  // Per-student form state
  const [formState, setFormState] = useState<Record<string, { score: string; grade: string; feedback: string }>>(() => {
    const init: Record<string, { score: string; grade: string; feedback: string }> = {}
    for (const s of hw.submissions) {
      init[s.student.id] = {
        score:    s.finalScore != null ? String(s.finalScore) : '',
        grade:    s.grade ?? '',
        feedback: s.feedback ?? '',
      }
    }
    return init
  })

  const selectedSub     = selectedId ? subByStudent[selectedId] : null
  const selectedStudent = selectedId ? enrolled.find(e => e.user.id === selectedId)?.user : null
  const form            = selectedId ? (formState[selectedId] ?? { score: '', grade: '', feedback: '' }) : null
  const sendInfo        = selectedId ? hw.sendByStudent[selectedId] : null

  function setField(field: 'score' | 'grade' | 'feedback', value: string) {
    if (!selectedId) return
    setFormState(prev => {
      const current = prev[selectedId] ?? { score: '', grade: '', feedback: '' }
      const next    = { ...current, [field]: value }
      // Auto-suggest grade when score changes
      if (field === 'score' && value !== '') {
        const n = Number(value)
        if (!isNaN(n)) next.grade = suggestGrade(n, hw.gradingBands)
      }
      return { ...prev, [selectedId]: next }
    })
  }

  function handleSave() {
    if (!selectedId || !selectedSub || !form) return
    const scoreNum = Number(form.score)
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxScore) return
    startTransition(async () => {
      await markSubmission(selectedSub.id, {
        teacherScore: scoreNum,
        feedback:     form.feedback,
        grade:        form.grade || undefined,
      })
      setSavedId(selectedId)
      setTimeout(() => setSavedId(null), 2500)
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
    const score   = fState?.score ?? (sub?.finalScore != null ? String(sub.finalScore) : null)

    if (!user) return null
    return (
      <div className={`flex items-center rounded-lg transition-colors ${
        active  ? 'bg-blue-50' :
        missing ? 'opacity-50' :
        'hover:bg-gray-50'
      }`}>
      <button
        onClick={() => !missing && setSelectedId(studentId)}
        className={`flex-1 text-left flex items-center gap-2.5 px-3 py-2.5 ${missing ? 'cursor-default' : ''}`}
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
            {send && <span className="ml-1 text-[9px] font-bold text-rose-500">SEND</span>}
            {sub?.autoMarked && !sub?.teacherReviewed && (
              <span className="ml-0.5 text-[9px] font-bold text-amber-600">⚠</span>
            )}
          </p>
          <p className="text-[10px] text-gray-400">
            {missing ? 'Not submitted' : statusLabel(sub.status)}
          </p>
        </div>
        {!missing && score && (
          <span className={`text-[11px] font-semibold shrink-0 ${isDone ? 'text-green-700' : 'text-gray-500'}`}>
            {score}/{maxScore}
          </span>
        )}
        {!missing && isDone && <CheckCircle2 size={13} className="text-green-500 shrink-0" />}
        {!missing && !isDone && sub && <Clock size={13} className="text-amber-400 shrink-0" />}
        {missing && <AlertCircle size={13} className="text-gray-300 shrink-0" />}
      </button>
      {!missing && sub && (
        <Link
          href={`/homework/${hw.id}/mark/${sub.id}`}
          title="Open full marking view"
          className="px-2 py-2.5 text-gray-300 hover:text-blue-500 transition-colors shrink-0"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink size={11} />
        </Link>
      )}
      </div>
    )
  }

  const isAlreadyMarked = selectedSub?.status === 'RETURNED' || selectedSub?.status === 'MARKED'

  return (
    <div className="flex h-full min-h-0">

      {/* ── Left: student list ─────────────────────────────────────────────── */}
      <div className="w-56 shrink-0 border-r border-gray-200 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Pupils</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {hw.submissions.length} submitted · {missingStudents.length} missing
          </p>
          {(() => {
            const needsReview = hw.submissions.filter(s => s.autoMarked && !s.teacherReviewed).length
            return needsReview > 0 ? (
              <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                ⚠ {needsReview} awaiting your review
              </p>
            ) : null
          })()}
        </div>
        <div className="flex-1 overflow-auto py-2 px-2 space-y-0.5">
          {submittedStudents.map(e => (
            <StudentRow key={e.user.id} studentId={e.user.id} />
          ))}
          {missingStudents.length > 0 && (
            <>
              <div className="px-2 pt-3 pb-1">
                <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Not submitted</span>
              </div>
              {missingStudents.map(e => (
                <StudentRow key={e.user.id} studentId={e.user.id} missing />
              ))}
            </>
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
                    <span className="ml-2 text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-600 rounded-full">
                      SEND · {sendInfo.needArea}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Submitted {new Date(selectedSub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {selectedSub.markedAt && ` · Returned ${new Date(selectedSub.markedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                  {' · '}<span className={`font-medium ${STATUS_STYLES[selectedSub.status]?.includes('green') ? 'text-green-600' : 'text-gray-500'}`}>{statusLabel(selectedSub.status)}</span>
                </p>
              </div>
            </div>

            {/* submission content */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Submission</p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                {selectedSub.content}
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

            {/* AI auto-mark review banner */}
            {selectedSub?.autoMarked && !selectedSub?.teacherReviewed && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-amber-600 text-sm">⚠️</span>
                  <span className="text-sm font-semibold text-amber-800">AI Auto-marked — Please Review</span>
                </div>
                <p className="text-xs text-amber-700">
                  Score and feedback pre-filled by AI. Review and confirm before returning to student.
                </p>
                {selectedSub.autoScore != null && (
                  <p className="text-xs text-amber-600 mt-1">AI score: <strong>{selectedSub.autoScore}%</strong></p>
                )}
              </div>
            )}

            {/* marking form */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-[12px] font-semibold text-gray-700">
                  {isAlreadyMarked ? 'Update Mark' : 'Mark Submission'}
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
                      className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-[14px] font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="—"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Auto-suggested</p>
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
                    {selectedSub?.autoMarked && !selectedSub?.teacherReviewed
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
