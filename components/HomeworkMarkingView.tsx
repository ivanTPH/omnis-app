'use client'
import { useState, useMemo, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { markSubmission, resendHomeworkReminder, saveHomeworkTeacherNote, recordHomeworkAsIlpEvidence, classifyIlpEvidence, saveIlpEvidenceEntries } from '@/app/actions/homework'
import { addPassportRecommendation } from '@/app/actions/students'
import { percentToGcseGrade, normalizeScoreForForm, GCSE_LETTERS, gradeLabel as gcseGradeLabel } from '@/lib/grading'
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

// ── QuestionCard ───────────────────────────────────────────────────────────────

function QuestionCard({
  index, total, prompt, type, optionsJson, correctAnswerJson, rubricJson, explanationText,
  maxScore, studentAnswer, score, onScoreChange,
}: {
  index: number
  total: number
  prompt: string
  type: string
  optionsJson: unknown
  correctAnswerJson: unknown
  rubricJson: unknown
  explanationText: string | null | undefined
  maxScore: number
  studentAnswer: string | undefined
  score: string
  onScoreChange: (v: string) => void
}) {
  const [showModel, setShowModel] = useState(false)
  const [showScheme, setShowScheme] = useState(false)

  const modelAnswer = correctAnswerJson == null ? null
    : typeof correctAnswerJson === 'string' ? correctAnswerJson
    : typeof correctAnswerJson === 'object' ? JSON.stringify(correctAnswerJson)
    : String(correctAnswerJson)

  const options: string[] = !optionsJson ? [] : Array.isArray(optionsJson)
    ? (optionsJson as string[])
    : Object.values(optionsJson as Record<string, string>)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-500">Q{index} of {total}</span>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-gray-400">Marks:</label>
          <input
            type="number"
            min={0}
            max={maxScore}
            value={score}
            onChange={e => onScoreChange(e.target.value)}
            className="w-14 border border-gray-300 rounded px-2 py-1 text-[12px] font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={`/${maxScore}`}
          />
          <span className="text-[11px] text-gray-400">/{maxScore}</span>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2.5">
        {/* Question prompt */}
        <p className="text-[13px] font-medium text-gray-800">{prompt}</p>

        {/* MCQ options */}
        {type === 'MCQ_QUIZ' && options.length > 0 && (
          <div className="space-y-1 pl-1">
            {options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i)
              const selected = studentAnswer === letter || studentAnswer === opt
              return (
                <div key={i} className={`text-[12px] px-2 py-1 rounded flex items-center gap-1.5 ${
                  selected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600'
                }`}>
                  <span className="font-semibold w-4 shrink-0">{letter}.</span>
                  <span>{opt}</span>
                  {selected && <span className="ml-auto text-[10px] text-blue-500">selected</span>}
                </div>
              )
            })}
          </div>
        )}

        {/* Student answer */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Student&apos;s Answer</p>
          <div className={`border rounded-lg px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
            studentAnswer ? 'bg-blue-50 border-blue-100 text-gray-800' : 'bg-gray-50 border-gray-200'
          }`}>
            {studentAnswer || <span className="text-gray-400 italic">No answer recorded</span>}
          </div>
        </div>

        {/* Model answer toggle */}
        {modelAnswer != null && (
          <div>
            <button
              onClick={() => setShowModel(v => !v)}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-green-700 transition-colors"
            >
              {showModel ? <Icon name="expand_less" size="sm" /> : <Icon name="expand_more" size="sm" />}
              {showModel ? 'Hide' : 'Show'} model answer
            </button>
            {showModel && (
              <div className="mt-1.5 bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-[12px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                {modelAnswer}
              </div>
            )}
          </div>
        )}

        {/* Mark scheme rubric toggle */}
        {rubricJson != null && (
          <div>
            <button
              onClick={() => setShowScheme(v => !v)}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-amber-700 transition-colors"
            >
              {showScheme ? <Icon name="expand_less" size="sm" /> : <Icon name="expand_more" size="sm" />}
              {showScheme ? 'Hide' : 'Show'} mark scheme
            </button>
            {showScheme && (
              <div className="mt-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-[12px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                {typeof rubricJson === 'string' ? rubricJson : JSON.stringify(rubricJson, null, 2)}
              </div>
            )}
          </div>
        )}

        {explanationText != null && explanationText !== '' && (
          <p className="text-[11px] text-gray-400 italic">{explanationText}</p>
        )}
      </div>
    </div>
  )
}

// ── filter type ────────────────────────────────────────────────────────────────

type PupilFilter = 'all' | 'submitted' | 'returned' | 'missing' | 'send'

type IlpData = {
  studentId: string
  ilpId: string
  targets: Array<{ id: string; description: string; successCriteria: string; subject: string | null }>
}

type IlpClassification = {
  targetId: string
  description: string
  evidenceType: 'PROGRESS' | 'CONCERN' | 'NEUTRAL'
  aiSummary: string
}

// ── main component ─────────────────────────────────────────────────────────────

export default function HomeworkMarkingView({ hw }: { hw: HWData }) {
  const enrolled       = hw.class?.enrolments ?? []
  const maxScore       = maxFromBands(hw.gradingBands)
  const sendByStudent  = hw.sendByStudent
  const kPlanByStudent = (hw as any).kPlanByStudent as Record<string, { teacherActions: string[] }> | undefined ?? {}
  const ilpByStudent   = (hw as any).ilpByStudent   as Record<string, { id: string; needsSummary: string; targets: Array<{ id: string; description: string; successCriteria: string; subject: string | null }> }> | undefined ?? {}
  const notesBySubmission = (hw as any).notesBySubmission as Record<string, Array<{ id: string; note: string; createdAt: string; teacherName: string }>> | undefined ?? {}

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
  // Per-question scores: studentId → array of score strings
  const [perQScores,      setPerQScores]      = useState<Record<string, string[]>>({})
  // Teacher notes
  const [newNote,         setNewNote]         = useState('')
  const [noteSaving,      setNoteSaving]      = useState(false)
  const [noteError,       setNoteError]       = useState<string | null>(null)
  // ILP evidence (existing per-target links)
  const [evidenceSaved,   setEvidenceSaved]   = useState<Record<string, boolean>>({}) // targetId → saved
  const [evidenceLoading, setEvidenceLoading] = useState<Record<string, boolean>>({})
  const [showAllTargets,  setShowAllTargets]  = useState(false)
  // ILP evidence capture (new AI-classified modal flow)
  const [ilpPromptData,     setIlpPromptData]     = useState<IlpData | null>(null)
  const [ilpCountdown,      setIlpCountdown]      = useState<number | null>(null)
  const [ilpModalOpen,      setIlpModalOpen]      = useState(false)
  const [ilpClassifying,    setIlpClassifying]    = useState(false)
  const [ilpClassifications, setIlpClassifications] = useState<IlpClassification[] | null>(null)
  const [ilpSaving,         setIlpSaving]         = useState(false)
  const [ilpSaved,          setIlpSaved]          = useState(false)
  // Grade-drop AI recommendation
  type GradeDrop = { studentId: string; studentName: string; previousGrade: number; newGrade: number; drop: number; suggestion: string }
  const [gradeDrop,         setGradeDrop]         = useState<GradeDrop | null>(null)
  const [passportAdded,     setPassportAdded]     = useState(false)

  const router = useRouter()

  // Per-student form state
  const [formState, setFormState] = useState<Record<string, { score: string; grade: string; feedback: string }>>(() => {
    const init: Record<string, { score: string; grade: string; feedback: string }> = {}
    for (const s of hw.submissions) {
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

  const listSubmitted = filteredPupils.filter(p => !!p.submission)
  const listMissing   = filteredPupils.filter(p => !p.submission)

  const selectedSub     = selectedId ? subByStudent[selectedId] ?? null : null
  const selectedStudent = selectedId ? pupils.find(p => p.id === selectedId) ?? null : null
  const form            = selectedId ? (formState[selectedId] ?? { score: '', grade: '', feedback: '' }) : null
  const sendInfo        = selectedId ? sendByStudent[selectedId] : null
  const selectedKPlan   = selectedId ? kPlanByStudent[selectedId] : null
  const selectedIlp     = selectedId ? ilpByStudent[selectedId] : null
  const selectedNotes   = selectedSub ? (notesBySubmission[selectedSub.id] ?? []) : []

  // Reset checklist when selected student changes
  if (selectedId !== kPlanStudentId && selectedKPlan) {
    setKPlanStudentId(selectedId)
    setKPlanChecked(new Array(selectedKPlan.teacherActions.length).fill(false))
    setKPlanOpen(false)
  }

  // Structured questions
  const questions = (hw.questions ?? []) as Array<{
    id: string; orderIndex: number; type: string; prompt: string
    optionsJson: unknown; correctAnswerJson: unknown; rubricJson: unknown
    explanationText: string | null; maxScore: number
  }>
  // Use structuredContent if available; fall back to questionsJson for LessonFolder-created homework
  const rawQuestionsJson = (hw as any).questionsJson as { questions?: Array<{ q?: string; question?: string; modelAnswer?: string; markScheme?: string; marks?: number; ehcp_adaptation?: string; scaffolding_hint?: string }> } | null
  const structuredContent = ((hw as any).structuredContent as {
    questions?: Array<{ question: string; answer?: string; modelAnswer?: string; marks?: number }>
  } | null) ?? (rawQuestionsJson?.questions ? {
    questions: rawQuestionsJson.questions.map(q => ({
      question:    q.q ?? q.question ?? '',
      modelAnswer: q.modelAnswer ?? q.markScheme ?? undefined,
      marks:       q.marks,
    })),
  } : null)
  // Student answers: prefer structuredResponse (adaptive homework), fall back to parsing content JSON,
  // then fall back to treating plain-text content as the answer for question 0.
  const [structuredAnswers, contentUsedAsAnswer]: [string[], boolean] = (() => {
    const fromResponse = (selectedSub?.structuredResponse as { answers?: string[] } | null)?.answers
    if (fromResponse?.length) return [fromResponse, false]
    const rawContent = selectedSub?.content ?? ''
    try {
      const parsed = rawContent ? JSON.parse(rawContent) : null
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return [Object.values(parsed) as string[], false]
      }
      if (Array.isArray(parsed)) return [parsed.map(String), false]
    } catch {
      // Plain-text submission — use as answer for first question
      if (rawContent.trim()) return [[rawContent], true]
    }
    return [[], false]
  })()

  const hasStructuredQuestions = questions.length > 0 || (structuredContent?.questions?.length ?? 0) > 0

  // Per-question score helpers
  function handlePerQScore(questionIndex: number, value: string) {
    if (!selectedId) return
    setPerQScores(prev => {
      const current = prev[selectedId] ?? []
      const next = [...current]
      next[questionIndex] = value
      return { ...prev, [selectedId]: next }
    })
  }

  const qCount = questions.length > 0 ? questions.length : (structuredContent?.questions?.length ?? 0)
  const perQScoreArr = selectedId ? (perQScores[selectedId] ?? []) : []
  const perQFilledCount = perQScoreArr.filter(s => s !== '' && s !== undefined).length
  const perQRunningTotal = perQFilledCount > 0
    ? perQScoreArr.reduce((sum, s) => sum + (Number(s) || 0), 0)
    : null

  function setField(field: 'score' | 'grade' | 'feedback', value: string) {
    if (!selectedId) return
    setFormState(prev => {
      const current = prev[selectedId] ?? { score: '', grade: '', feedback: '' }
      const next    = { ...current, [field]: value }
      if (field === 'score' && value !== '') {
        const n = Number(value)
        if (!isNaN(n)) {
          // Always auto-suggest as a single GCSE digit (1-9), never a band range
          next.grade = String(percentToGcseGrade(Math.round((n / maxScore) * 100)))
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
        const result = await markSubmission(selectedSub.id, {
          teacherScore: scoreNum,
          feedback:     form.feedback,
          grade:        form.grade || undefined,
        })
        setSavedId(selectedId)
        router.refresh()
        setTimeout(() => setSavedId(null), 2500)
        if (result?.ilpData) {
          setIlpPromptData(result.ilpData)
          setIlpCountdown(10)
          setIlpSaved(false)
          setIlpClassifications(null)
          setIlpModalOpen(false)
        }
        if (result?.gradeDrop) {
          setGradeDrop(result.gradeDrop)
          setPassportAdded(false)
        }
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
        const result = await markSubmission(selectedSub.id, {
          teacherScore: gradeNum,
          feedback:     autoFeedback,
          grade:        gradeStr || undefined,
        })
        setSavedId(selectedId)
        router.refresh()
        setTimeout(() => setSavedId(null), 2500)
        if (result?.ilpData) {
          setIlpPromptData(result.ilpData)
          setIlpCountdown(10)
          setIlpSaved(false)
          setIlpClassifications(null)
          setIlpModalOpen(false)
        }
        if (result?.gradeDrop) {
          setGradeDrop(result.gradeDrop)
          setPassportAdded(false)
        }
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

  async function handleAddNote() {
    if (!selectedSub || !newNote.trim()) return
    setNoteSaving(true)
    setNoteError(null)
    try {
      await saveHomeworkTeacherNote(selectedSub.id, newNote.trim())
      setNewNote('')
      router.refresh()
    } catch {
      setNoteError('Failed to save note. Please try again.')
    } finally {
      setNoteSaving(false)
    }
  }

  async function handleRecordEvidence(targetId: string) {
    if (!selectedIlp) return
    setEvidenceLoading(prev => ({ ...prev, [targetId]: true }))
    try {
      const result = await recordHomeworkAsIlpEvidence(hw.id, targetId)
      setEvidenceSaved(prev => ({ ...prev, [targetId]: true }))
      if (result.alreadyLinked) {
        // Already linked — just mark as saved
      }
    } catch {
      // silently fail
    } finally {
      setEvidenceLoading(prev => ({ ...prev, [targetId]: false }))
    }
  }

  // ILP countdown effect
  useEffect(() => {
    if (ilpCountdown === null) return
    if (ilpCountdown <= 0) {
      setIlpPromptData(null)
      setIlpCountdown(null)
      return
    }
    const t = setTimeout(() => setIlpCountdown(c => (c ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [ilpCountdown])

  async function handleOpenIlpModal() {
    if (!ilpPromptData || !selectedSub) return
    setIlpCountdown(null) // stop countdown
    setIlpModalOpen(true)
    setIlpClassifying(true)
    try {
      const raw = await classifyIlpEvidence({
        homeworkTitle: (selectedSub as any).homework?.title ?? hw.title ?? 'this homework',
        subject: (sendInfo?.needArea ?? ''),
        score: Number(form?.score ?? 0),
        maxScore,
        ilpTargets: ilpPromptData.targets,
      })
      const mapped: IlpClassification[] = ilpPromptData.targets.map(t => {
        const found = raw.find(r => r.targetId === t.id)
        return {
          targetId: t.id,
          description: t.description,
          evidenceType: (found?.evidenceType ?? 'NEUTRAL') as 'PROGRESS' | 'CONCERN' | 'NEUTRAL',
          aiSummary: found?.aiSummary ?? '',
        }
      })
      setIlpClassifications(mapped)
    } catch {
      setIlpClassifications(ilpPromptData.targets.map(t => ({
        targetId: t.id,
        description: t.description,
        evidenceType: 'NEUTRAL' as const,
        aiSummary: '',
      })))
    } finally {
      setIlpClassifying(false)
    }
  }

  function updateClassification(targetId: string, field: 'evidenceType' | 'aiSummary', value: string) {
    setIlpClassifications(prev => prev ? prev.map(c =>
      c.targetId === targetId ? { ...c, [field]: value } : c
    ) : null)
  }

  async function handleSaveIlpEvidence() {
    if (!ilpClassifications || !selectedSub) return
    setIlpSaving(true)
    try {
      await saveIlpEvidenceEntries(selectedSub.id, ilpClassifications.map(c => ({
        ilpTargetId: c.targetId,
        evidenceType: c.evidenceType,
        aiSummary: c.aiSummary,
      })))
      setIlpSaved(true)
      setIlpModalOpen(false)
      setIlpPromptData(null)
      setTimeout(() => setIlpSaved(false), 3000)
    } catch {
      // silently fail
    } finally {
      setIlpSaving(false)
    }
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
    // Always show as GCSE grade 1–9, never raw/percentage
    const displayScore: number | null = rawFinalScore != null
      ? (rawFinalScore > maxScore && maxScore <= 20
        ? percentToGcseGrade(rawFinalScore)                                    // auto-mark %
        : percentToGcseGrade(Math.round((rawFinalScore / maxScore) * 100)))    // raw score
      : (fState?.score ? percentToGcseGrade(Math.round((Number(fState.score) / maxScore) * 100)) : null)

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
            userId={pupil.id}
            size="xs"
            sendStatus={(sendByStudent[pupil.id]?.activeStatus as 'NONE' | 'SEN_SUPPORT' | 'EHCP') ?? 'NONE'}
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
                const pct   = isLegPct ? Math.round(autoScore) : Math.round((autoScore / maxScore) * 100)
                const grade = percentToGcseGrade(pct)
                return (
                  <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                    AI: Gr {grade} ({GCSE_LETTERS[grade]}) ↗
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
          {!missing && isDone && <Icon name="check_circle" size="sm" className="text-green-500 shrink-0" />}
          {!missing && !isDone && sub && <Icon name="schedule" size="sm" className="text-amber-400 shrink-0" />}
          {missing && !isSend && <Icon name="error" size="sm" className="text-gray-300 shrink-0" />}
          {missing && isSend  && <Icon name="error" size="sm" className="text-amber-400 shrink-0" />}
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
              <Icon name="open_in_new" size="sm" />
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
                ? <Icon name="refresh" size="sm" className="animate-spin" />
                : <Icon name="notifications" size="sm" />
              }
              {reminded ? 'Sent' : 'Remind'}
            </button>
            <Link
              href={`/messages?new=1&recipient=${pupil.id}&context=${encodeURIComponent(`Re: ${hw.title}`)}`}
              title={isSend ? 'Message student (SEND — please use sensitive language)' : 'Message student'}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-700 transition-colors"
            >
              <Icon name="chat" size="sm" />
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

  // ILP targets to display in sidebar
  const ilpTargets = selectedIlp?.targets ?? []
  const visibleTargets = showAllTargets ? ilpTargets : ilpTargets.slice(0, 3)

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white shrink-0">

        {/* Left: back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/homework" className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <Icon name="chevron_left" size="md" />
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
            title="Returned — homework marked and sent back to students"
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
            title="Missing — students who have not submitted yet"
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
              title="SEND — students with an active SEN Support or EHCP plan"
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

      {/* ── Right: marking area (main content + optional SEND sidebar) ─────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Main marking content */}
        <div className="flex-1 overflow-auto">
          {!selectedSub || !selectedStudent || !form ? (
            /* ── No student selected — show homework questions preview ── */
            <div className="max-w-2xl mx-auto px-8 py-6 space-y-5">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <Icon name="quiz" size="sm" className="text-gray-400" />
                <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
                  Homework Questions Preview
                </p>
                {qCount > 0 && (
                  <span className="text-[10px] text-gray-400">{qCount} question{qCount !== 1 ? 's' : ''}</span>
                )}
              </div>
              {hasStructuredQuestions ? (
                <div className="space-y-4">
                  {questions.length > 0
                    ? questions.map((q, i) => (
                        <QuestionCard
                          key={q.id}
                          index={i + 1}
                          total={questions.length}
                          prompt={q.prompt}
                          type={q.type}
                          optionsJson={q.optionsJson}
                          correctAnswerJson={q.correctAnswerJson}
                          rubricJson={q.rubricJson}
                          explanationText={q.explanationText}
                          maxScore={q.maxScore}
                          studentAnswer={undefined}
                          score=""
                          onScoreChange={() => {}}
                        />
                      ))
                    : structuredContent!.questions!.map((q, i) => (
                        <QuestionCard
                          key={i}
                          index={i + 1}
                          total={structuredContent!.questions!.length}
                          prompt={q.question}
                          type="SHORT_ANSWER"
                          optionsJson={null}
                          correctAnswerJson={q.modelAnswer ?? null}
                          rubricJson={null}
                          explanationText={null}
                          maxScore={q.marks ?? 1}
                          studentAnswer={undefined}
                          score=""
                          onScoreChange={() => {}}
                        />
                      ))
                  }
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Icon name="quiz" size="lg" className="mb-3 text-gray-300" />
                  <p className="text-[13px]">
                    {pupils.some(p => p.submission) ? 'Select a student on the left to view their submission.' : 'No questions available for this homework.'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-8 py-6 space-y-5">

              {/* student header */}
              <div className="flex items-center gap-3">
                <StudentAvatar
                  firstName={selectedStudent.firstName}
                  lastName={selectedStudent.lastName}
                  avatarUrl={(selectedStudent as any).avatarUrl ?? null}
                  userId={selectedStudent.id}
                  size="md"
                  sendStatus={(sendInfo?.activeStatus as 'NONE' | 'SEN_SUPPORT' | 'EHCP') ?? 'NONE'}
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

              {/* SEND adaptation indicator */}
              {sendInfo && sendInfo.activeStatus !== 'NONE' && rawQuestionsJson?.questions?.some(q => q.ehcp_adaptation || q.scaffolding_hint) && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                  sendInfo.activeStatus === 'EHCP'
                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  <span className="text-[10px]">{sendInfo.activeStatus === 'EHCP' ? '♿' : '⭐'}</span>
                  {sendInfo.activeStatus === 'EHCP'
                    ? 'This student saw a simplified question with vocab glossary'
                    : 'This student saw the standard question with a scaffolding hint'}
                </div>
              )}

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
                      <Icon name="menu_book" size="sm" className={sendInfo?.activeStatus === 'EHCP' ? 'text-purple-600' : 'text-blue-600'} />
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
                    {kPlanOpen ? <Icon name="expand_less" size="sm" className="text-gray-400" /> : <Icon name="expand_more" size="sm" className="text-gray-400" />}
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
                        <Icon name="open_in_new" size="sm" /> Full SEND record
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* ── Q&A Cards (structured questions) ─── */}
              {hasStructuredQuestions ? (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Icon name="description" size="sm" /> Questions &amp; Answers
                  </p>
                  <div className="space-y-3">
                    {questions.length > 0
                      ? questions.map((q, i) => (
                          <QuestionCard
                            key={q.id}
                            index={i + 1}
                            total={questions.length}
                            prompt={q.prompt}
                            type={q.type}
                            optionsJson={q.optionsJson}
                            correctAnswerJson={q.correctAnswerJson}
                            rubricJson={q.rubricJson}
                            explanationText={q.explanationText}
                            maxScore={q.maxScore}
                            studentAnswer={structuredAnswers[q.orderIndex] ?? structuredAnswers[i]}
                            score={perQScores[selectedId!]?.[i] ?? ''}
                            onScoreChange={v => handlePerQScore(i, v)}
                          />
                        ))
                      : structuredContent!.questions!.map((q, i) => (
                          <QuestionCard
                            key={i}
                            index={i + 1}
                            total={structuredContent!.questions!.length}
                            prompt={q.question}
                            type="SHORT_ANSWER"
                            optionsJson={null}
                            correctAnswerJson={(q as any).answer ?? q.modelAnswer ?? null}
                            rubricJson={null}
                            explanationText={null}
                            maxScore={q.marks ?? 1}
                            studentAnswer={structuredAnswers[i]}
                            score={perQScores[selectedId!]?.[i] ?? ''}
                            onScoreChange={v => handlePerQScore(i, v)}
                          />
                        ))
                    }
                  </div>
                  {/* Per-question running total */}
                  {perQRunningTotal !== null && (
                    <div className="mt-3 flex items-center gap-3 px-1">
                      <span className="text-[12px] text-gray-600 font-medium">
                        Running total: <span className="font-bold text-blue-700">{perQRunningTotal}/{maxScore}</span>
                        {qCount > 0 && perQFilledCount < qCount && (
                          <span className="text-gray-400 font-normal ml-1">({perQFilledCount}/{qCount} questions marked)</span>
                        )}
                      </span>
                      {perQFilledCount === qCount && (
                        <button
                          onClick={() => setField('score', String(perQRunningTotal))}
                          className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          Copy to total ↓
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Flat submission content (extended writing / upload) */
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Submission</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {selectedSub.content || <span className="text-gray-400 italic">No content recorded</span>}
                  </div>
                </div>
              )}

              {/* If structured questions + also a free-text content block that wasn't already shown in a QuestionCard, show it */}
              {hasStructuredQuestions && selectedSub.content && !contentUsedAsAnswer && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Student&apos;s written response</p>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-4 text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {selectedSub.content}
                  </div>
                </div>
              )}

              {/* model answer (collapsible) — for non-structured or overall model answer */}
              {hw.modelAnswer && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowModelAnswer(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <span className="text-[12px] font-semibold text-gray-700">Overall Model Answer</span>
                    {showModelAnswer ? <Icon name="expand_less" size="sm" className="text-gray-400" /> : <Icon name="expand_more" size="sm" className="text-gray-400" />}
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
                    {showBands ? <Icon name="expand_less" size="sm" className="text-gray-400" /> : <Icon name="expand_more" size="sm" className="text-gray-400" />}
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
                    <Icon name="smart_toy" size="sm" className="text-amber-600 shrink-0" />
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
                          AI score: <strong>{gcseGradeLabel(percentToGcseGrade(pct))}</strong>
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
                          ? <Icon name="refresh" size="sm" className="animate-spin" />
                          : <Icon name="check_circle" size="sm" />
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
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">
                        GCSE Grade
                      </label>
                      <div className="flex gap-1 flex-wrap">
                        {(['9','8','7','6','5','4','3','2','1'] as const).map(g => {
                          const gNum = Number(g)
                          const isSelected = form.grade === g
                          const colorCls = isSelected
                            ? (gNum >= 8 ? 'bg-green-700 text-white border-green-700' :
                               gNum >= 6 ? 'bg-green-500 text-white border-green-500' :
                               gNum >= 4 ? 'bg-amber-400 text-white border-amber-400' :
                                           'bg-red-500 text-white border-red-500')
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                          return (
                            <button
                              key={g}
                              type="button"
                              title={`Grade ${g} (${GCSE_LETTERS[gNum]})`}
                              onClick={() => setField('grade', isSelected ? '' : g)}
                              className={`w-8 h-8 rounded-lg text-[12px] font-bold border transition-colors ${colorCls}`}
                            >
                              {g}
                            </button>
                          )
                        })}
                      </div>
                      <p className={`text-[10px] mt-1 ${
                        gradeState === 'auto'      ? 'text-amber-600' :
                        gradeState === 'confirmed' ? 'text-green-600' :
                        gradeHasValue              ? 'text-amber-500' :
                        'text-gray-400'
                      }`}>
                        {form.grade && GCSE_LETTERS[Number(form.grade)]
                          ? `Grade ${form.grade} (${GCSE_LETTERS[Number(form.grade)]}) — ${gradeLabel}`
                          : gradeLabel}
                      </p>
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
                        <Icon name="check_circle" size="sm" /> Returned to student
                      </span>
                    ) : <span />}
                    <button
                      onClick={handleSave}
                      disabled={isPending || form.score === ''}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors"
                    >
                      {isPending && <Icon name="refresh" size="sm" className="animate-spin" />}
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

              {/* ── Teacher Notes ─── */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <Icon name="sticky_note_2" size="sm" className="text-gray-400" />
                  <p className="text-[12px] font-semibold text-gray-700">Teacher Notes</p>
                  <span className="text-[10px] text-gray-400 ml-auto">Internal only — students never see these</span>
                </div>
                <div className="px-4 py-4 space-y-3">
                  {/* Existing notes */}
                  {selectedNotes.length > 0 && (
                    <div className="space-y-2">
                      {selectedNotes.map(n => (
                        <div key={n.id} className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2.5">
                          <p className="text-[12px] text-gray-800 leading-relaxed whitespace-pre-wrap">{n.note}</p>
                          <p className="text-[10px] text-gray-400 mt-1.5">
                            {n.teacherName} · {new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Add note */}
                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      placeholder="Add a private note about this submission…"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-[12px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={noteSaving || !newNote.trim()}
                      className="flex items-center gap-1 self-end bg-gray-700 hover:bg-gray-800 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-[12px] font-medium transition-colors"
                    >
                      {noteSaving ? <Icon name="refresh" size="sm" className="animate-spin" /> : <Icon name="add" size="sm" />}
                      Add
                    </button>
                  </div>
                  {noteError && <p className="text-[11px] text-rose-600">{noteError}</p>}
                </div>
              </div>

              {/* ILP Evidence prompt — non-blocking banner */}
              {ilpPromptData && !ilpSaved && (
                <div className="border border-blue-200 bg-blue-50 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-blue-800">This student has an active ILP</p>
                    <p className="text-[11px] text-blue-600 mt-0.5">Record this homework as ILP evidence?</p>
                  </div>
                  <button
                    onClick={handleOpenIlpModal}
                    className="shrink-0 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
                  >
                    Yes{ilpCountdown !== null ? ` (${ilpCountdown}s)` : ''}
                  </button>
                  <button
                    onClick={() => { setIlpPromptData(null); setIlpCountdown(null) }}
                    className="shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
                  >
                    <Icon name="close" size="sm" />
                  </button>
                </div>
              )}
              {ilpSaved && (
                <div className="border border-green-200 bg-green-50 rounded-xl px-4 py-3">
                  <p className="text-[12px] text-green-700 font-medium flex items-center gap-1.5">
                    <Icon name="check_circle" size="sm" /> ILP evidence recorded
                  </p>
                </div>
              )}

              {/* Grade-drop recommendation banner */}
              {gradeDrop && !passportAdded && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Icon name="trending_down" size="sm" className="text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-amber-900">
                        Grade drop detected — {gradeDrop.studentName}
                      </p>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Grade {gradeDrop.previousGrade} → Grade {gradeDrop.newGrade} (↓{gradeDrop.drop}). Add a strategy to their Learning Passport?
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={async () => {
                          await addPassportRecommendation(gradeDrop.studentId, gradeDrop.suggestion)
                          setPassportAdded(true)
                        }}
                        className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                      >
                        <Icon name="add" size="sm" />
                        Add to Passport
                      </button>
                      <button
                        onClick={() => setGradeDrop(null)}
                        className="text-amber-400 hover:text-amber-600 transition-colors"
                      >
                        <Icon name="close" size="sm" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {passportAdded && gradeDrop && (
                <div className="border border-green-200 bg-green-50 rounded-xl px-4 py-3">
                  <p className="text-[12px] text-green-700 font-medium flex items-center gap-1.5">
                    <Icon name="check_circle" size="sm" />
                    Strategy added to {gradeDrop.studentName}&apos;s Learning Passport
                  </p>
                </div>
              )}

            </div>
          )}
        </div>

        {/* ── SEND Sidebar — only when selected student has an active ILP ── */}
        {selectedSub && selectedId && selectedIlp && (
          <div className="w-72 shrink-0 border-l border-gray-200 overflow-auto bg-white">
            <div className={`px-4 py-3 border-b sticky top-0 bg-white ${
              sendInfo?.activeStatus === 'EHCP' ? 'border-purple-100' : 'border-blue-100'
            }`}>
              <div className="flex items-center gap-2">
                <Icon name="track_changes" size="sm" className={sendInfo?.activeStatus === 'EHCP' ? 'text-purple-600' : 'text-blue-600'} />
                <span className={`text-[12px] font-bold ${
                  sendInfo?.activeStatus === 'EHCP' ? 'text-purple-800' : 'text-blue-800'
                }`}>SEND Support</span>
              </div>
              <p className="text-[11px] text-gray-600 mt-1 leading-snug">{selectedStudent?.firstName} {selectedStudent?.lastName}</p>
              {sendInfo && sendInfo.activeStatus !== 'NONE' && (
                <span className={`mt-1.5 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  sendInfo.activeStatus === 'EHCP'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {sendInfo.activeStatus === 'EHCP' ? 'EHCP' : 'SEN Support'}
                  {sendInfo.needArea ? ` · ${sendInfo.needArea}` : ''}
                </span>
              )}
            </div>

            <div className="px-4 py-4 space-y-4">

              {/* ILP needs summary */}
              {selectedIlp.needsSummary && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Area of Need</p>
                  <p className="text-[12px] text-gray-700 leading-snug">{selectedIlp.needsSummary}</p>
                </div>
              )}

              {/* ILP SMART goals */}
              {ilpTargets.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">ILP Goals</p>
                  <div className="space-y-2.5">
                    {visibleTargets.map(target => (
                      <div key={target.id} className={`border rounded-lg p-3 ${
                        sendInfo?.activeStatus === 'EHCP' ? 'border-purple-100 bg-purple-50/40' : 'border-blue-100 bg-blue-50/40'
                      }`}>
                        <p className="text-[12px] text-gray-800 font-medium leading-snug">{target.description}</p>
                        {target.successCriteria && (
                          <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                            <span className="font-medium">Success:</span> {target.successCriteria}
                          </p>
                        )}
                        {target.subject && (
                          <span className="inline-block mt-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            {target.subject}
                          </span>
                        )}
                        {/* Record as ILP evidence button */}
                        <div className="mt-2">
                          {evidenceSaved[target.id] ? (
                            <span className="flex items-center gap-1 text-[11px] text-green-600 font-medium">
                              <Icon name="check_circle" size="sm" /> Linked as evidence
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRecordEvidence(target.id)}
                              disabled={evidenceLoading[target.id]}
                              className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors ${
                                sendInfo?.activeStatus === 'EHCP'
                                  ? 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                                  : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                              } disabled:opacity-40`}
                            >
                              {evidenceLoading[target.id]
                                ? <Icon name="refresh" size="sm" className="animate-spin" />
                                : <Icon name="add" size="sm" />
                              }
                              Record as ILP evidence
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {ilpTargets.length > 3 && (
                    <button
                      onClick={() => setShowAllTargets(v => !v)}
                      className="mt-2 text-[11px] text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
                    >
                      {showAllTargets
                        ? <><Icon name="expand_less" size="sm" /> Show fewer</>
                        : <><Icon name="expand_more" size="sm" /> Show all {ilpTargets.length} goals</>
                      }
                    </button>
                  )}
                </div>
              )}

              {ilpTargets.length === 0 && (
                <p className="text-[12px] text-gray-400 italic">No active ILP goals recorded.</p>
              )}

              {/* Full SEND record link */}
              <a
                href={`/student/${selectedId}/send`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Icon name="open_in_new" size="sm" /> Full SEND record
              </a>
            </div>
          </div>
        )}

      </div>{/* end right: marking area */}

      </div>{/* end two-panel layout */}

      {/* ILP Evidence Modal */}
      {ilpModalOpen && ilpPromptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2 shrink-0">
              <Icon name="track_changes" size="sm" className="text-blue-600" />
              <h2 className="text-[15px] font-bold text-gray-900 flex-1">Record ILP Evidence</h2>
              <button
                onClick={() => { setIlpModalOpen(false); setIlpPromptData(null) }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Icon name="close" size="md" />
              </button>
            </div>

            {ilpClassifying ? (
              <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                <Icon name="refresh" size="md" className="animate-spin" />
                <span className="text-[13px]">Classifying against ILP goals…</span>
              </div>
            ) : (
              <div className="overflow-auto flex-1 px-5 py-4 space-y-4">
                <p className="text-[12px] text-gray-500">AI has classified each ILP goal based on the homework score. Adjust if needed, then confirm.</p>
                {(ilpClassifications ?? []).map(c => (
                  <div key={c.targetId} className="border border-gray-200 rounded-xl p-4 space-y-2.5">
                    <p className="text-[13px] font-medium text-gray-800 leading-snug">{c.description}</p>
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-20 shrink-0">Classification</label>
                      <select
                        value={c.evidenceType}
                        onChange={e => updateClassification(c.targetId, 'evidenceType', e.target.value)}
                        className={`flex-1 border rounded-lg px-2.5 py-1.5 text-[12px] font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          c.evidenceType === 'PROGRESS' ? 'border-green-300 bg-green-50 text-green-700' :
                          c.evidenceType === 'CONCERN'  ? 'border-rose-300 bg-rose-50 text-rose-700' :
                          'border-gray-300 bg-white text-gray-700'
                        }`}
                      >
                        <option value="PROGRESS">PROGRESS — on track</option>
                        <option value="NEUTRAL">NEUTRAL — no clear signal</option>
                        <option value="CONCERN">CONCERN — at risk</option>
                      </select>
                    </div>
                    <div className="flex items-start gap-3">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-20 shrink-0 mt-1.5">AI note</label>
                      <input
                        type="text"
                        value={c.aiSummary}
                        onChange={e => updateClassification(c.targetId, 'aiSummary', e.target.value)}
                        placeholder="Optional note…"
                        className="flex-1 border border-gray-300 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!ilpClassifying && (
              <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between shrink-0">
                <button
                  onClick={() => { setIlpModalOpen(false); setIlpPromptData(null) }}
                  className="text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveIlpEvidence}
                  disabled={ilpSaving || !ilpClassifications}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors"
                >
                  {ilpSaving && <Icon name="refresh" size="sm" className="animate-spin" />}
                  Confirm &amp; Save Evidence
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
