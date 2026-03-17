'use client'
import { useState, useEffect, useTransition, useCallback } from 'react'
import { X, Plus, Trash2, Upload, BookOpen, ClipboardList, Heart, BarChart2, Loader2, ExternalLink, Pencil, Sparkles, ChevronRight, Check, Calendar, Library, RotateCcw, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getLessonDetails, updateLessonOverview, removeResource, updateResource, deleteLesson, rescheduleLesson } from '@/app/actions/lessons'
import { createHomework, generateHomeworkFromResources } from '@/app/actions/homework'
import type { MCQQuestion, SAQuestion } from '@/app/actions/homework'
import { HomeworkType } from '@prisma/client'
import dynamic from 'next/dynamic'
import AddResourcePanel       from '@/components/AddResourcePanel'
import OakResourcePanel       from '@/components/OakResourcePanel'
import UnifiedResourceSearch  from '@/components/UnifiedResourceSearch'
const RevisionAnalysisPanel = dynamic(() => import('@/components/revision-program/RevisionAnalysisPanel'), { ssr: false })
const ClassRosterTab = dynamic(() => import('@/components/ClassRosterTab'), { ssr: false })
import ExportPdfButton   from '@/components/ExportPdfButton'
import { addUploadedResource } from '@/app/actions/lessons'

type LessonData = Awaited<ReturnType<typeof getLessonDetails>>

// Maps school subject names to Oak National Academy subject slugs
function toOakSubjectSlug(subject: string): string {
  const s = subject.toLowerCase().trim()
  const MAP: Record<string, string> = {
    'mathematics': 'maths', 'math': 'maths',
    'english language': 'english', 'english literature': 'english',
    'english lang': 'english', 'english lit': 'english',
    'eng lang': 'english', 'eng lit': 'english',
    'combined science': 'science', 'triple science': 'science',
    'physical education': 'physical-education', 'pe': 'physical-education',
    'p.e.': 'physical-education', 'p.e': 'physical-education',
    'art & design': 'art', 'art and design': 'art',
    'design & technology': 'design-and-technology',
    'design and technology': 'design-and-technology',
    'd&t': 'design-and-technology', 'dt': 'design-and-technology',
    'religious education': 'religious-education', 're': 'religious-education',
    'r.e.': 'religious-education', 'religious studies': 'religious-education',
    'rs': 'religious-education', 'pshe': 'rshe-and-pshe',
    'modern foreign languages': 'modern-foreign-languages', 'mfl': 'modern-foreign-languages',
  }
  return MAP[s] ?? s.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

const TABS = ['Overview', 'Resources', 'Oak Resources', 'Homework', 'Class', 'SEND & Inclusion', 'Class Insights', 'Revision'] as const
export type FolderTab = typeof TABS[number]
type Tab = FolderTab
type TypeState = { instructions: string; modelAnswer: string; gradingBands: Record<string, string>; targetWordCount: number }

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  PLAN: 'Plan', SLIDES: 'Slides', WORKSHEET: 'Worksheet',
  VIDEO: 'Video', LINK: 'Link', OTHER: 'Other',
}
const RESOURCE_TYPE_COLORS: Record<string, string> = {
  PLAN: 'bg-green-100 text-green-700', SLIDES: 'bg-blue-100 text-blue-700',
  WORKSHEET: 'bg-purple-100 text-purple-700', VIDEO: 'bg-rose-100 text-rose-700',
  LINK: 'bg-amber-100 text-amber-700', OTHER: 'bg-gray-100 text-gray-600',
}

function scoreColor(score: number) {
  if (score >= 8) return 'bg-green-100 text-green-700'
  if (score >= 5) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

interface Props {
  lessonId:    string | null
  onClose:     () => void
  defaultTab?: FolderTab
  wizardMode?: boolean
  inline?:     boolean
}

const HW_TYPES: { value: HomeworkType; label: string }[] = [
  { value: 'MCQ_QUIZ',         label: 'MCQ Quiz'        },
  { value: 'SHORT_ANSWER',     label: 'Short Answer'    },
  { value: 'EXTENDED_WRITING', label: 'Essay / Extended Writing' },
  { value: 'MIXED',            label: 'Mixed Format'    },
  { value: 'UPLOAD',           label: 'Upload (photo/scan)' },
]

export default function LessonFolder({ lessonId, onClose, defaultTab, wizardMode, inline = false }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab]   = useState<Tab>('Overview')
  const [lesson,    setLesson]      = useState<LessonData | null>(null)
  const [loading,   setLoading]     = useState(false)
  const [removing,  startRemove]    = useTransition()

  // Delete + reschedule
  const [deleting,    startDelete]    = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [rescheduling,  startReschedule] = useTransition()
  const [editDate,    setEditDate]    = useState('')
  const [editStart,   setEditStart]   = useState('')
  const [editEnd,     setEditEnd]     = useState('')

  // Wizard state (4=Resources, 5=Homework, null=normal tabs)
  const [wizardStep, setWizardStep] = useState<4 | 5 | null>(null)

  // File-drop state
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropPending, startDrop]    = useTransition()

  // Inline resource editing
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null)
  const [editLabel,         setEditLabel]         = useState('')
  const [editUrl,           setEditUrl]           = useState('')
  const [editSaving,        startEditSave]        = useTransition()

  // Homework wizard state
  const [typeStore,       setTypeStore]       = useState<Partial<Record<HomeworkType, TypeState>>>({})
  const [hwType,          setHwType]          = useState<HomeworkType>('SHORT_ANSWER')
  const [hwSetDate,       setHwSetDate]       = useState('')
  const [hwDueDate,       setHwDueDate]       = useState('')
  const [hwSaving,        startHwSave]        = useTransition()
  const [hwYesNo,         setHwYesNo]         = useState<'yes' | 'no' | null>(null)
  const [aiDecision,      setAiDecision]      = useState<string | null>(null)
  // Structured question editors
  const [mcqQuestions,    setMcqQuestions]    = useState<MCQQuestion[]>([])
  const [saQuestions,     setSaQuestions]     = useState<SAQuestion[]>([])
  const [generatingHw,    setGeneratingHw]    = useState(false)
  const [genSource,       setGenSource]       = useState<string | null>(null)
  const [headerEditDate,  setHeaderEditDate]  = useState(false)

  // Editable overview state
  const [title,      setTitle]      = useState('')
  const [objectives, setObjectives] = useState<string[]>([])
  const [saving,     startSave]     = useTransition()

  const refreshLesson = useCallback(async () => {
    if (!lessonId) return
    const l = await getLessonDetails(lessonId)
    setLesson(l)
  }, [lessonId])

  useEffect(() => {
    if (!lessonId) { setLesson(null); return }
    setLoading(true)
    getLessonDetails(lessonId).then(l => {
      setLesson(l)
      setTitle(l?.title ?? '')
      setObjectives(l?.objectives ?? [])
      if (l?.scheduledAt) {
        const s = new Date(l.scheduledAt)
        setEditDate(s.toISOString().split('T')[0])
        setEditStart(s.toTimeString().slice(0, 5))
      }
      if (l?.endsAt) {
        setEditEnd(new Date(l.endsAt).toTimeString().slice(0, 5))
      }
      setLoading(false)
    })
    setActiveTab(defaultTab ?? 'Overview')
    if (wizardMode) {
      setWizardStep(4)
      setHwYesNo(null)
      setHwType('SHORT_ANSWER')
      setTypeStore({})
      setMcqQuestions([])
      setSaQuestions([])
      setGenSource(null)
      setAiDecision(null)
    } else {
      setWizardStep(null)
    }
  }, [lessonId])  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate homework when wizard reaches step 5
  useEffect(() => {
    if (wizardStep !== 5 || !lessonId) return
    // Don't re-generate if this type already has content
    if (typeStore[hwType]?.instructions) return
    setHwYesNo('yes')
    runHwGeneration(lessonId, hwType) // eslint-disable-line react-hooks/immutability
  }, [wizardStep])  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-regenerate when homework type changes mid-wizard
  useEffect(() => {
    if (wizardStep !== 5 || !lessonId || hwYesNo !== 'yes') return
    if (typeStore[hwType]?.instructions) return   // already have content for this type
    runHwGeneration(lessonId, hwType) // eslint-disable-line react-hooks/immutability
  }, [hwType])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!lessonId) return null

  // Init homework dates when wizard opens step 5
  function initHwDates() {
    const lessonDate = lesson?.scheduledAt ? new Date(lesson.scheduledAt) : new Date()
    setHwSetDate(lessonDate.toISOString().split('T')[0])
    const due = new Date(lessonDate)
    due.setDate(due.getDate() + 7)
    setHwDueDate(due.toISOString().split('T')[0])
  }

  // typeStore helper — update field(s) for the currently active hw type
  function updateActive(patch: Partial<TypeState>) {
    setTypeStore(s => {
      const cur = s[hwType] ?? { instructions: '', modelAnswer: '', gradingBands: {}, targetWordCount: 300 }
      return { ...s, [hwType]: { ...cur, ...patch } }
    })
  }

  // MCQ question card helpers
  function updateMcqQ(idx: number, patch: Partial<MCQQuestion>) {
    setMcqQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q))
  }
  function removeMcqQ(idx: number) { setMcqQuestions(prev => prev.filter((_, i) => i !== idx)) }
  function addMcqQ() {
    setMcqQuestions(prev => [...prev, { q: '', options: ['', '', '', ''], correct: 0, explanation: '' }])
  }

  // Short-answer Q+A helpers
  function updateSaQ(idx: number, patch: Partial<SAQuestion>) {
    setSaQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q))
  }
  function removeSaQ(idx: number) { setSaQuestions(prev => prev.filter((_, i) => i !== idx)) }
  function addSaQ() { setSaQuestions(prev => [...prev, { q: '', modelAnswer: '' }]) }

  // Serialise question cards → flat text for save / textarea preview
  function serializeMCQ(): { instructions: string; modelAnswer: string } {
    const L = ['A', 'B', 'C', 'D']
    const instructions = mcqQuestions.map((q, i) =>
      `${i + 1}. ${q.q}\n${q.options.map((o, j) => `${L[j]}. ${o}`).join('\n')}`,
    ).join('\n\n')
    const modelAnswer = mcqQuestions.map((q, i) =>
      `${i + 1}. ${L[q.correct]} – ${q.explanation}`,
    ).join('\n')
    return { instructions, modelAnswer }
  }
  function serializeSA(): { instructions: string; modelAnswer: string } {
    const instructions = saQuestions.map((q, i) => `${i + 1}. ${q.q}`).join('\n\n')
    const modelAnswer  = saQuestions.map((q, i) => `Q${i + 1}: ${q.modelAnswer}`).join('\n\n')
    return { instructions, modelAnswer }
  }

  // Core generation function — populates editing fields directly (no Accept/Reject step)
  function runHwGeneration(lid: string, type: HomeworkType) {
    setGeneratingHw(true)
    setMcqQuestions([])
    setSaQuestions([])
    generateHomeworkFromResources(lid, type).then(result => {
      updateActive({
        instructions:    result.instructions,
        modelAnswer:     result.modelAnswer,
        gradingBands:    result.gradingBands,
        targetWordCount: result.targetWordCount,
      })
      setAiDecision('ACCEPTED')
      // Populate structured editors
      const qs = result.questionsJson?.questions ?? []
      if (type === 'MCQ_QUIZ' && qs.length > 0) {
        setMcqQuestions((qs as any[]).map(q => ({
          q:           q.q           ?? '',
          options:     q.options     ?? ['', '', '', ''],
          correct:     q.correct     ?? 0,
          explanation: q.explanation ?? '',
        })))
      } else if (type === 'SHORT_ANSWER' && qs.length > 0) {
        setSaQuestions((qs as any[]).map(q => ({
          q:           q.q           ?? '',
          modelAnswer: q.modelAnswer ?? '',
        })))
      }
      // Build "generated from" label
      const objCount = lesson?.objectives?.length ?? 0
      const resCount = (lesson?.resources ?? []).filter(r => ['PLAN','SLIDES','WORKSHEET'].includes(r.type)).length
      const parts: string[] = []
      if (objCount > 0) parts.push(`${objCount} learning objective${objCount !== 1 ? 's' : ''}`)
      if (resCount > 0) parts.push(`${resCount} resource${resCount !== 1 ? 's' : ''}`)
      setGenSource(parts.length > 0 ? parts.join(' + ') : 'lesson title')
    }).catch(() => {
      setGenSource(null)
    }).finally(() => {
      setGeneratingHw(false)
    })
  }

  // Manual regenerate button
  function handleRegenerateHw() {
    if (!lessonId) return
    runHwGeneration(lessonId, hwType)
  }

  // Save lesson overview and close the folder (returns user to calendar)
  function handleSaveAndClose() {
    if (!lessonId) { onClose(); return }
    startSave(async () => {
      await updateLessonOverview(lessonId, { title, objectives })
      router.refresh()
      onClose()
    })
  }

  // Save lesson reschedule from header inline edit
  function handleHeaderSave() {
    startReschedule(async () => {
      await rescheduleLesson(
        lessonId!,
        new Date(`${editDate}T${editStart}`).toISOString(),
        new Date(`${editDate}T${editEnd}`).toISOString(),
      )
      router.refresh()
      await refreshLesson()
      setHeaderEditDate(false)
    })
  }

  // File-drop handlers
  function handleDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      setIsDragOver(true)
    }
  }
  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (!files.length) return
    startDrop(async () => {
      for (const f of files) {
        const label = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
        const ext   = f.name.split('.').pop()?.toLowerCase() ?? ''
        const type  = ext === 'pptx' || ext === 'ppt' ? 'SLIDES' :
                      ext === 'pdf'                    ? 'PLAN'   : 'OTHER'
        await addUploadedResource(lessonId!, { label, type: type as any, fileName: f.name })
      }
      await refreshLesson()
    })
  }

  // Inline resource edit save
  function saveResourceEdit(resourceId: string) {
    startEditSave(async () => {
      await updateResource(resourceId, {
        label: editLabel || undefined,
        url:   editUrl   || undefined,
      })
      setEditingResourceId(null)
      await refreshLesson()
    })
  }

  function saveOverview() {
    if (!lessonId) return
    startSave(async () => {
      await updateLessonOverview(lessonId, { title, objectives })
    })
  }

  const TAB_ICONS: Record<Tab, React.ReactNode> = {
    'Overview':         <BookOpen      size={13} />,
    'Resources':        <Upload        size={13} />,
    'Oak Resources':    <Library       size={13} />,
    'Homework':         <ClipboardList size={13} />,
    'Class':            <Users         size={13} />,
    'SEND & Inclusion': <Heart         size={13} />,
    'Class Insights':   <BarChart2     size={13} />,
    'Revision':         <RotateCcw     size={13} />,
  }

  return (
    <div
      className={inline ? '' : 'fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6'}
      style={inline ? { height: '100%', display: 'flex', flexDirection: 'column' } : {}}
    >
      <div
        className={`${inline ? '' : 'bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-4xl h-[92dvh] sm:h-auto sm:max-h-[90vh]'} flex flex-col relative transition-all ${isDragOver ? 'ring-4 ring-blue-400 ring-offset-2' : ''}`}
        style={inline ? { flex: 1, minHeight: 0, backgroundColor: 'white' } : {}}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* File-drop overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-10 bg-blue-50/90 rounded-2xl flex flex-col items-center justify-center pointer-events-none">
            <Upload size={32} className="text-blue-400 mb-3" />
            <p className="text-[15px] font-semibold text-blue-700">Drop files to add as resources</p>
            <p className="text-[12px] text-blue-500 mt-1">PDF, PPTX, DOCX supported</p>
          </div>
        )}
        {dropPending && (
          <div className="absolute inset-0 z-10 bg-white/80 rounded-2xl flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between px-7 pt-6 pb-4 border-b border-gray-200 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            {loading ? (
              <div className="h-6 w-48 bg-gray-100 rounded animate-pulse" />
            ) : (
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={saveOverview}
                className="text-xl font-semibold text-gray-900 w-full border-0 outline-none bg-transparent focus:ring-0 p-0"
                placeholder="Lesson title"
              />
            )}
            {lesson && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {lesson.class && (
                  <span className="text-[11px] font-medium px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                    {lesson.class.name}
                  </span>
                )}
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  lesson.lessonType === 'NORMAL'       ? 'bg-gray-100 text-gray-600' :
                  lesson.lessonType === 'COVER'        ? 'bg-amber-100 text-amber-700' :
                  lesson.lessonType === 'INTERVENTION' ? 'bg-purple-100 text-purple-700' :
                  'bg-teal-100 text-teal-700'
                }`}>
                  {lesson.lessonType.charAt(0) + lesson.lessonType.slice(1).toLowerCase()}
                </span>
                {headerEditDate ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                    <input type="time" value={editStart} onChange={e => setEditStart(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                    <span className="text-gray-300 text-[11px]">–</span>
                    <input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                    <button
                      onClick={handleHeaderSave}
                      disabled={rescheduling || !editDate || !editStart || !editEnd}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-[11px] font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
                    >
                      {rescheduling ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                      Save
                    </button>
                    <button onClick={() => setHeaderEditDate(false)} className="text-[11px] text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                ) : (
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    {new Date(lesson.scheduledAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {lesson.endsAt && ` · ${new Date(lesson.scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}–${new Date(lesson.endsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                    <button
                      onClick={() => setHeaderEditDate(true)}
                      title="Edit date & time"
                      className="ml-0.5 w-4 h-4 flex items-center justify-center rounded hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors"
                    >
                      <Pencil size={9} />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {lessonId && !confirmDelete && (
              <ExportPdfButton
                href={`/api/export/lesson-plan/${lessonId}`}
                filename="lesson-plan.pdf"
                label="Export"
              />
            )}
            {confirmDelete ? (
              <>
                <span className="text-[11px] text-red-600 font-medium mr-1">Delete this lesson?</span>
                <button
                  onClick={() => startDelete(async () => {
                    await deleteLesson(lessonId!)
                    router.refresh()
                    onClose()
                  })}
                  disabled={deleting}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40"
                >
                  {deleting ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 text-[11px] font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Delete lesson"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Tab bar — hidden during wizard */}
        {wizardStep === null && (
          <div className="flex border-b border-gray-200 px-2 sm:px-7 shrink-0 overflow-x-auto scrollbar-none">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-4 py-3 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {TAB_ICONS[tab]}
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Wizard progress bar */}
        {wizardStep !== null && (
          <div className="flex items-center gap-3 px-7 py-3 border-b border-gray-200 shrink-0 bg-blue-50">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${wizardStep === 4 ? 'bg-blue-600 text-white' : 'bg-blue-200 text-blue-700'}`}>1</div>
              <span className={`text-[12px] font-medium ${wizardStep === 4 ? 'text-blue-700' : 'text-blue-400'}`}>Add Resources</span>
            </div>
            <ChevronRight size={13} className="text-blue-300" />
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${wizardStep === 5 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>2</div>
              <span className={`text-[12px] font-medium ${wizardStep === 5 ? 'text-blue-700' : 'text-gray-400'}`}>Set Homework</span>
            </div>
            <div className="ml-auto">
              <button
                onClick={() => setWizardStep(null)}
                className="text-[11px] text-gray-400 hover:text-gray-600 underline"
              >
                Skip setup
              </button>
            </div>
          </div>
        )}

        {/* Tab content / Wizard content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : wizardStep === 4 ? (
            /* ── Wizard Step 4: Resources ───────────────────────── */
            <div className="p-7 space-y-5">
              <div>
                <h3 className="text-[14px] font-semibold text-gray-900 mb-1">Add resources to this lesson</h3>
                <p className="text-[12px] text-gray-500">Pick from the school library, add a link, or upload a file. Files are scanned for SEND accessibility.</p>
              </div>

              {/* Resources added so far */}
              {(lesson?.resources?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Resources added</p>
                  {lesson!.resources.map(r => (
                    <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${RESOURCE_TYPE_COLORS[r.type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {RESOURCE_TYPE_LABELS[r.type] ?? r.type}
                      </span>
                      {editingResourceId === r.id ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            value={editLabel}
                            onChange={e => setEditLabel(e.target.value)}
                            className="flex-1 text-[12px] border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <input
                            value={editUrl}
                            onChange={e => setEditUrl(e.target.value)}
                            placeholder={r.fileKey ? 'Add link to file…' : 'URL'}
                            className="w-40 text-[12px] border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => saveResourceEdit(r.id)}
                            disabled={editSaving}
                            className="w-6 h-6 flex items-center justify-center bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40"
                          >
                            <Check size={11} />
                          </button>
                          <button
                            onClick={() => setEditingResourceId(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <>
                          {r.url ? (
                            <a href={r.url} target="_blank" rel="noreferrer" className="flex-1 text-[13px] text-blue-600 hover:underline truncate">{r.label}</a>
                          ) : (
                            <span className="flex-1 text-[13px] text-gray-800 truncate">{r.label}</span>
                          )}
                          {r.review && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${scoreColor(r.review.sendScore)}`}>
                              SEND {r.review.sendScore}/10
                            </span>
                          )}
                          <button
                            title="Edit"
                            onClick={() => { setEditingResourceId(r.id); setEditLabel(r.label); setEditUrl(r.url ?? '') }}
                            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-300 hover:text-gray-600 transition-colors"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            disabled={removing}
                            onClick={() => startRemove(async () => { await removeResource(r.id); await refreshLesson() })}
                            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-100 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Unified Oak + school library search */}
              <UnifiedResourceSearch
                lessonId={lessonId}
                subjectSlug={lesson?.class?.subject ? toOakSubjectSlug(lesson.class.subject) : undefined}
                yearGroup={lesson?.class?.yearGroup ?? undefined}
                onAdded={refreshLesson}
              />
            </div>

          ) : wizardStep === 5 ? (
            /* ── Wizard Step 5: Homework ────────────────────────── */
            (() => {
              const activeHw = typeStore[hwType] ?? { instructions: '', modelAnswer: '', gradingBands: {}, targetWordCount: 300 }
              return (
            <div className="p-7 space-y-5">
              <div>
                <h3 className="text-[14px] font-semibold text-gray-900 mb-1">Set homework for this lesson?</h3>
              </div>

              {hwYesNo === null && !generatingHw && (
                <div className="flex gap-3">
                  <button
                    onClick={() => { setHwYesNo('yes'); if (lessonId) runHwGeneration(lessonId, hwType) }}
                    className="flex-1 py-3 border-2 border-blue-600 text-blue-700 font-semibold rounded-xl text-[13px] hover:bg-blue-50 transition-colors"
                  >
                    Yes, set homework
                  </button>
                  <button
                    onClick={() => { router.refresh(); onClose() }}
                    className="flex-1 py-3 border-2 border-gray-200 text-gray-500 font-semibold rounded-xl text-[13px] hover:bg-gray-50 transition-colors"
                  >
                    No — save &amp; done
                  </button>
                </div>
              )}

              {hwYesNo === 'yes' && (
                <div className="space-y-5">

                  {/* ── Type selector + AI controls ─────────────────── */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Assessment type</label>
                      <div className="flex flex-wrap gap-2">
                        {HW_TYPES.map(t => (
                          <button
                            key={t.value}
                            type="button"
                            disabled={generatingHw}
                            onClick={() => {
                              setHwType(t.value)
                              setMcqQuestions([])
                              setSaQuestions([])
                              setGenSource(null)
                            }}
                            className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors disabled:opacity-40 ${
                              hwType === t.value
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                            }`}
                          >{t.label}</button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={generatingHw}
                      onClick={handleRegenerateHw}
                      className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-semibold hover:bg-purple-100 disabled:opacity-40 transition-colors shrink-0"
                    >
                      {generatingHw
                        ? <><Loader2 size={11} className="animate-spin" /> Generating…</>
                        : <><Sparkles size={11} /> {genSource ? 'Regenerate' : 'Generate with AI'}</>}
                    </button>
                  </div>

                  {/* AI source indicator */}
                  {genSource && !generatingHw && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg">
                      <Sparkles size={11} className="text-purple-500 shrink-0" />
                      <p className="text-[11px] text-purple-700">Generated from {genSource} — edit any question below</p>
                    </div>
                  )}

                  {/* Loading state */}
                  {generatingHw && (
                    <div className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                      <Loader2 size={16} className="animate-spin text-purple-600 shrink-0" />
                      <div>
                        <p className="text-[13px] font-semibold text-purple-800">
                          ⚡ {genSource ? `Regenerating for ${hwType === 'MCQ_QUIZ' ? 'MCQ' : hwType === 'SHORT_ANSWER' ? 'Short Answer' : hwType === 'EXTENDED_WRITING' ? 'Essay' : 'Mixed'} format…` : 'Generating homework from your lesson content…'}
                        </p>
                        <p className="text-[11px] text-purple-600 mt-0.5">Creating {hwType === 'MCQ_QUIZ' ? 'quiz questions' : hwType === 'SHORT_ANSWER' ? 'questions and model answers' : 'homework content'} based on what was taught.</p>
                      </div>
                    </div>
                  )}

                  {/* ── MCQ question card editor ─────────────────────── */}
                  {hwType === 'MCQ_QUIZ' && !generatingHw && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[12px] font-semibold text-gray-700">
                          Questions <span className="text-gray-400 font-normal">({mcqQuestions.length})</span>
                        </label>
                        <button
                          type="button"
                          onClick={addMcqQ}
                          className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <Plus size={11} /> Add question
                        </button>
                      </div>
                      {mcqQuestions.length === 0 ? (
                        <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                          <p className="text-[12px] text-gray-400">No questions yet — click &quot;Generate with AI&quot; or add manually</p>
                        </div>
                      ) : (
                        mcqQuestions.map((q, qi) => (
                          <div key={qi} className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
                            <div className="flex items-start gap-2">
                              <span className="text-[11px] font-bold text-gray-400 shrink-0 mt-2.5">Q{qi + 1}</span>
                              <textarea
                                rows={2}
                                value={q.q}
                                onChange={e => updateMcqQ(qi, { q: e.target.value })}
                                placeholder="Question text…"
                                className="flex-1 text-[13px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 resize-none"
                              />
                              <button onClick={() => removeMcqQ(qi)} className="text-gray-300 hover:text-red-400 shrink-0 mt-2">
                                <X size={13} />
                              </button>
                            </div>
                            <div className="space-y-1.5 pl-8">
                              {(['A', 'B', 'C', 'D'] as const).map((letter, oi) => (
                                <div key={letter} className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`mcq-correct-${qi}`}
                                    checked={q.correct === oi}
                                    onChange={() => updateMcqQ(qi, { correct: oi })}
                                    title="Mark as correct answer"
                                    className="text-green-600 focus:ring-green-500 shrink-0"
                                  />
                                  <span className="text-[11px] font-bold text-gray-500 w-4 shrink-0">{letter}.</span>
                                  <input
                                    value={q.options[oi]}
                                    onChange={e => {
                                      const opts = [...q.options] as [string, string, string, string]
                                      opts[oi] = e.target.value
                                      updateMcqQ(qi, { options: opts })
                                    }}
                                    className={`flex-1 text-[12px] border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                      q.correct === oi ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
                                    }`}
                                    placeholder={`Option ${letter}`}
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="pl-8">
                              <input
                                value={q.explanation}
                                onChange={e => updateMcqQ(qi, { explanation: e.target.value })}
                                className="w-full text-[11px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50 text-gray-600"
                                placeholder="Explanation for correct answer (shown in answer key)…"
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* ── Short answer Q+A pair editor ─────────────────── */}
                  {hwType === 'SHORT_ANSWER' && !generatingHw && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[12px] font-semibold text-gray-700">
                          Questions &amp; Model Answers <span className="text-gray-400 font-normal">({saQuestions.length})</span>
                        </label>
                        <button
                          type="button"
                          onClick={addSaQ}
                          className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <Plus size={11} /> Add question
                        </button>
                      </div>
                      {saQuestions.length === 0 ? (
                        <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                          <p className="text-[12px] text-gray-400">No questions yet — click &quot;Generate with AI&quot; or add manually</p>
                        </div>
                      ) : (
                        saQuestions.map((q, qi) => (
                          <div key={qi} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                            <div className="flex items-start gap-2 px-4 pt-4 pb-2">
                              <span className="text-[11px] font-bold text-gray-400 shrink-0 mt-2.5">Q{qi + 1}</span>
                              <textarea
                                rows={2}
                                value={q.q}
                                onChange={e => updateSaQ(qi, { q: e.target.value })}
                                placeholder="Question for pupils…"
                                className="flex-1 text-[13px] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 resize-none"
                              />
                              <button onClick={() => removeSaQ(qi)} className="text-gray-300 hover:text-red-400 shrink-0 mt-2">
                                <X size={13} />
                              </button>
                            </div>
                            <div className="px-4 pb-4 pl-10">
                              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide block mb-1">Model answer</label>
                              <textarea
                                rows={3}
                                value={q.modelAnswer}
                                onChange={e => updateSaQ(qi, { modelAnswer: e.target.value })}
                                placeholder="Model answer / mark scheme for this question…"
                                className={`w-full text-[12px] border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-green-500 text-gray-700 resize-none ${
                                  !q.modelAnswer.trim()
                                    ? 'border-amber-300 bg-amber-50/40 placeholder-amber-400'
                                    : 'border-green-200 bg-green-50/40'
                                }`}
                              />
                              {!q.modelAnswer.trim() && (
                                <p className="text-[10px] text-amber-600 mt-1">Model answer not generated — add manually before saving</p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                      {/* Grading bands */}
                      {saQuestions.length > 0 && (
                        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-2">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Mark scheme bands</p>
                          {['Low (1–3)', 'Mid (4–6)', 'High (7–9)'].map(band => (
                            <div key={band} className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold text-gray-600 shrink-0 w-20">{band}:</span>
                              <input
                                value={activeHw.gradingBands[band] ?? ''}
                                onChange={e => updateActive({ gradingBands: { ...activeHw.gradingBands, [band]: e.target.value } })}
                                placeholder={band === 'Low (1–3)' ? 'Limited understanding…' : band === 'Mid (4–6)' ? 'Developing understanding…' : 'Secure understanding…'}
                                className="flex-1 text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Essay / Mixed / Upload — textarea editors ──────── */}
                  {(hwType === 'EXTENDED_WRITING' || hwType === 'MIXED' || hwType === 'UPLOAD') && !generatingHw && (
                    <>
                      <div>
                        <label className="block text-[12px] font-medium text-gray-500 mb-1.5">
                          {hwType === 'EXTENDED_WRITING' ? 'Essay question' :
                           hwType === 'MIXED'            ? 'Instructions for pupils' :
                           'Task instructions'} <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          rows={hwType === 'EXTENDED_WRITING' ? 4 : 5}
                          value={activeHw.instructions}
                          onChange={e => updateActive({ instructions: e.target.value })}
                          placeholder={
                            hwType === 'EXTENDED_WRITING'
                              ? 'e.g. "Analyse the causes of…" or "To what extent do you agree that…"'
                              : hwType === 'MIXED'
                              ? 'Part A – Knowledge Questions\n1. …\n\nPart B – Extended Response\n…'
                              : 'e.g. Complete the task below and upload a clear photograph of your work.'
                          }
                          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 resize-y"
                        />
                      </div>

                      {hwType === 'EXTENDED_WRITING' && (
                        <div className="flex items-center gap-3">
                          <label className="text-[12px] font-medium text-gray-500 shrink-0">Target word count</label>
                          <input
                            type="number" min={50} max={2000} step={50}
                            value={activeHw.targetWordCount || 300}
                            onChange={e => updateActive({ targetWordCount: parseInt(e.target.value) || 300 })}
                            className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                          />
                        </div>
                      )}

                      {hwType !== 'UPLOAD' && (
                        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                          <label className="block text-[12px] font-semibold text-gray-700">Model answer</label>
                          <textarea
                            rows={hwType === 'EXTENDED_WRITING' ? 7 : 5}
                            value={activeHw.modelAnswer}
                            onChange={e => updateActive({ modelAnswer: e.target.value })}
                            placeholder={hwType === 'EXTENDED_WRITING' ? '250–350 word model response or structured essay plan…' : 'Part A mark scheme:\n1. …\n\nPart B model answer:\n…'}
                            className={`w-full border rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y ${
                              !activeHw.modelAnswer?.trim()
                                ? 'border-amber-300 bg-amber-50 placeholder-amber-400'
                                : 'border-gray-200 bg-white'
                            }`}
                          />
                          {!activeHw.modelAnswer?.trim() && (
                            <p className="text-[11px] text-amber-600">Model answer not generated — add manually before saving</p>
                          )}
                          <div className="space-y-2 border-t border-gray-200 pt-3">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Mark scheme bands</p>
                            {['Low (1–3)', 'Mid (4–6)', 'High (7–9)'].map(band => (
                              <div key={band} className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-gray-600 shrink-0 w-20">{band}:</span>
                                <input
                                  value={activeHw.gradingBands[band] ?? ''}
                                  onChange={e => updateActive({ gradingBands: { ...activeHw.gradingBands, [band]: e.target.value } })}
                                  placeholder={band === 'Low (1–3)' ? 'Limited understanding…' : band === 'Mid (4–6)' ? 'Developing understanding…' : 'Secure understanding…'}
                                  className="flex-1 text-[12px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {hwType === 'UPLOAD' && (
                        <div className="space-y-3">
                          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-2">
                            <p className="text-[12px] font-semibold text-gray-700 mb-2">Submission requirements</p>
                            {['Clear photograph', 'All working shown', 'Labelled with name', 'Both sides of the page'].map(req => (
                              <label key={req} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!activeHw.gradingBands[req]}
                                  onChange={e => {
                                    const updated = { ...activeHw.gradingBands }
                                    if (e.target.checked) updated[req] = 'required'
                                    else delete updated[req]
                                    updateActive({ gradingBands: updated })
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-[13px] text-gray-700">{req}</span>
                              </label>
                            ))}
                          </div>
                          <div>
                            <label className="block text-[12px] font-medium text-gray-500 mb-1.5">
                              Teacher marking notes <span className="text-gray-400 font-normal">(private)</span>
                            </label>
                            <textarea
                              rows={3}
                              value={activeHw.modelAnswer}
                              onChange={e => updateActive({ modelAnswer: e.target.value })}
                              placeholder="Key points to look for when marking…"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 resize-y"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Dates ──────────────────────────────────────────── */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Set date</label>
                      <input type="date" value={hwSetDate} onChange={e => setHwSetDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Due date <span className="text-red-400">*</span></label>
                      <input type="date" value={hwDueDate} onChange={e => setHwDueDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                    </div>
                  </div>
                </div>
              )}
            </div>
              )
            })()

          ) : (
            <>
              {/* ── Overview ── */}
              {activeTab === 'Overview' && (
                <div className="p-7 space-y-6">

                  {/* Class info */}
                  {lesson?.class && (
                    <div>
                      <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Class Information</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Class</p>
                          <p className="text-[14px] font-semibold text-gray-900">{lesson.class.name}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Subject</p>
                          <p className="text-[14px] font-semibold text-gray-900">{lesson.class.subject}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Year Group</p>
                          <p className="text-[14px] font-semibold text-gray-900">Year {lesson.class.yearGroup}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Department</p>
                          <p className="text-[14px] font-semibold text-gray-900">{lesson.class.department}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Pupils Enrolled</p>
                          <p className="text-[14px] font-semibold text-gray-900">{lesson.class._count.enrolments}</p>
                        </div>
                        {lesson.class.teachers.length > 0 && (
                          <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Teacher{lesson.class.teachers.length > 1 ? 's' : ''}</p>
                            <p className="text-[14px] font-semibold text-gray-900 truncate">
                              {lesson.class.teachers.map(t => `${t.user.firstName} ${t.user.lastName}`).join(', ')}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Enrolled pupils */}
                      {lesson.class.enrolments.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Enrolled Pupils</p>
                          <div className="flex flex-wrap gap-2">
                            {lesson.class.enrolments.map(e => (
                              <div key={e.user.id} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full pl-1 pr-3 py-1">
                                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                                  {e.user.firstName[0]}{e.user.lastName[0]}
                                </div>
                                <span className="text-[12px] text-gray-800">{e.user.firstName} {e.user.lastName}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Learning Objectives</h3>
                      <button
                        type="button"
                        onClick={() => setObjectives(prev => [...prev, ''])}
                        className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700"
                      >
                        <Plus size={11} />Add objective
                      </button>
                    </div>
                    <div className="space-y-2">
                      {objectives.length === 0 && (
                        <p className="text-[12px] text-gray-400 italic">No objectives yet — add one above.</p>
                      )}
                      {objectives.map((obj, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400 font-medium w-5 text-right shrink-0">{i + 1}.</span>
                          <input
                            value={obj}
                            onChange={e => setObjectives(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                            onBlur={saveOverview}
                            className="flex-1 text-[13px] text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Pupils will be able to…"
                          />
                          <button
                            type="button"
                            onClick={() => { setObjectives(prev => prev.filter((_, j) => j !== i)); saveOverview() }}
                            className="text-gray-300 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  {saving && <p className="text-[11px] text-gray-400">Saving…</p>}

                  {/* Date & time */}
                  <div>
                    <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Date & Time</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Date</label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={e => setEditDate(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-[12px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Start</label>
                        <input
                          type="time"
                          value={editStart}
                          onChange={e => setEditStart(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-[12px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">End</label>
                        <input
                          type="time"
                          value={editEnd}
                          onChange={e => setEditEnd(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 text-[12px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <button
                      disabled={rescheduling || !editDate || !editStart || !editEnd}
                      onClick={() => startReschedule(async () => {
                        await rescheduleLesson(
                          lessonId!,
                          new Date(`${editDate}T${editStart}`).toISOString(),
                          new Date(`${editDate}T${editEnd}`).toISOString(),
                        )
                        router.refresh()
                        await refreshLesson()
                      })}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-[12px] font-medium hover:bg-blue-100 disabled:opacity-40 transition-colors"
                    >
                      {rescheduling
                        ? <><Loader2 size={12} className="animate-spin" /> Saving…</>
                        : <><Calendar size={12} /> Save new date & time</>
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* ── Resources ── */}
              {activeTab === 'Resources' && (
                <div className="p-7 space-y-4">

                  {/* Resource list */}
                  {lesson?.resources && lesson.resources.length > 0 ? (
                    <div className="space-y-2">
                      {lesson.resources.map(r => (
                        <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${RESOURCE_TYPE_COLORS[r.type] ?? 'bg-gray-100 text-gray-600'}`}>
                            {RESOURCE_TYPE_LABELS[r.type] ?? r.type}
                          </span>
                          {editingResourceId === r.id ? (
                            <div className="flex-1 flex items-center gap-2 flex-wrap">
                              <input
                                value={editLabel}
                                onChange={e => setEditLabel(e.target.value)}
                                className="flex-1 min-w-[120px] text-[12px] border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <input
                                value={editUrl}
                                onChange={e => setEditUrl(e.target.value)}
                                placeholder={r.fileKey ? 'Add link to file…' : 'URL'}
                                className="w-44 text-[12px] border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <button
                                onClick={() => saveResourceEdit(r.id)}
                                disabled={editSaving}
                                className="w-6 h-6 flex items-center justify-center bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40"
                              >
                                <Check size={11} />
                              </button>
                              <button
                                onClick={() => setEditingResourceId(null)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <>
                              {r.url ? (
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex-1 text-[13px] text-blue-600 hover:underline truncate flex items-center gap-1"
                                >
                                  {r.label}
                                  <ExternalLink size={10} className="shrink-0 opacity-60" />
                                </a>
                              ) : (
                                <span className="flex-1 text-[13px] text-gray-800 truncate">{r.label}</span>
                              )}
                              {r.fileKey && !r.url && (
                                <span className="text-[10px] text-gray-400 shrink-0">
                                  {r.fileKey.startsWith('stub:') ? r.fileKey.slice(5) : r.fileKey}
                                </span>
                              )}
                              {r.review && (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${scoreColor(r.review.sendScore)}`}>
                                  SEND {r.review.sendScore}/10
                                </span>
                              )}
                              <button
                                title="Edit"
                                onClick={() => { setEditingResourceId(r.id); setEditLabel(r.label); setEditUrl(r.url ?? '') }}
                                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-300 hover:text-gray-600 transition-colors"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                disabled={removing}
                                onClick={() => startRemove(async () => {
                                  await removeResource(r.id)
                                  await refreshLesson()
                                })}
                                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-100 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                              >
                                <X size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center">
                      <Upload size={20} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-[12px] text-gray-400">No resources yet. Add from the school library, paste a link, or upload a file.</p>
                    </div>
                  )}

                  {/* Unified Oak + school library search */}
                  {lessonId && (
                    <UnifiedResourceSearch
                      lessonId={lessonId}
                      subjectSlug={lesson?.class?.subject ? toOakSubjectSlug(lesson.class.subject) : undefined}
                      yearGroup={lesson?.class?.yearGroup ?? undefined}
                      onAdded={refreshLesson}
                    />
                  )}
                </div>
              )}

              {/* ── Oak Resources ── */}
              {activeTab === 'Oak Resources' && (
                <div className="p-7 space-y-4">
                  <div>
                    <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Oak National Academy</h3>
                    <p className="text-[12px] text-gray-400 mt-1">
                      Browse Oak&apos;s free lesson library and add lessons as resources.
                    </p>
                  </div>
                  {lessonId && (
                    <OakResourcePanel
                      lessonId={lessonId}
                      presetSubjectSlug={
                        lesson?.class?.subject
                          ? toOakSubjectSlug(lesson.class.subject)
                          : undefined
                      }
                      presetYearGroup={lesson?.class?.yearGroup ?? undefined}
                      onAdded={refreshLesson}
                    />
                  )}
                </div>
              )}

              {/* ── Homework ── */}
              {activeTab === 'Homework' && (
                <div className="p-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">Homework</h3>
                    <button
                      onClick={() => {
                        setHwYesNo('yes')
                        setHwType('SHORT_ANSWER')
                        setTypeStore({})
                        setMcqQuestions([])
                        setSaQuestions([])
                        setGenSource(null)
                        setAiDecision(null)
                        initHwDates()
                        setWizardStep(5)
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[12px] font-medium hover:bg-blue-100 transition-colors"
                    >
                      <Plus size={12} />Set homework
                    </button>
                  </div>
                  {lesson?.homework && lesson.homework.length > 0 ? (
                    <div className="space-y-4">
                      {lesson.homework.map(hw => {
                        const submitted = hw.submissions.filter(s => s.status !== 'RETURNED' && s.status !== 'MARKED')
                        const marked    = hw.submissions.filter(s => s.status === 'RETURNED' || s.status === 'MARKED')
                        return (
                          <div key={hw.id} className="border border-gray-200 rounded-xl overflow-hidden">
                            {/* Homework header */}
                            <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                              <div>
                                <p className="text-[13px] font-semibold text-gray-900">{hw.title}</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  Due {new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                  {' · '}{hw.submissions.length} submission{hw.submissions.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/homework/${hw.id}`}
                                  className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                  <ExternalLink size={11} />Mark
                                </Link>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                hw.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' :
                                hw.status === 'CLOSED'    ? 'bg-gray-200 text-gray-500'   :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {hw.status}
                              </span>
                              </div>
                            </div>

                            {/* Submissions list */}
                            {hw.submissions.length > 0 ? (
                              <div className="divide-y divide-gray-100">
                                {hw.submissions.map(s => (
                                  <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                                      {s.student.firstName[0]}{s.student.lastName[0]}
                                    </div>
                                    <span className="flex-1 text-[12px] text-gray-800">
                                      {s.student.firstName} {s.student.lastName}
                                    </span>
                                    {s.finalScore != null && (
                                      <span className="text-[11px] font-semibold text-gray-700">{s.finalScore}/9</span>
                                    )}
                                    {s.grade && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded">
                                        Grade {s.grade}
                                      </span>
                                    )}
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                      s.status === 'RETURNED'          ? 'bg-green-100 text-green-700'  :
                                      s.status === 'MARKED'            ? 'bg-blue-100 text-blue-700'    :
                                      s.status === 'UNDER_REVIEW'      ? 'bg-amber-100 text-amber-700'  :
                                      s.status === 'RESUBMISSION_REQ'  ? 'bg-rose-100 text-rose-700'    :
                                      'bg-gray-100 text-gray-600'
                                    }`}>
                                      {s.status === 'RESUBMISSION_REQ' ? 'Resubmit' : s.status.charAt(0) + s.status.slice(1).toLowerCase().replace('_', ' ')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="px-4 py-3 text-[12px] text-gray-400 italic">No submissions yet.</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center">
                      <ClipboardList size={20} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-[12px] text-gray-400">No homework linked. Set homework from this lesson.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Class roster ── */}
              {activeTab === 'Class' && (
                <div className="p-7">
                  {lesson?.class?.id ? (
                    <ClassRosterTab classId={lesson.class.id} />
                  ) : (
                    <div className="border border-dashed border-gray-200 rounded-2xl p-10 text-center">
                      <Users size={24} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-[12px] text-gray-400">No class assigned to this lesson.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── SEND & Inclusion ── */}
              {activeTab === 'SEND & Inclusion' && (
                <div className="p-7 space-y-5">
                  {(() => {
                    const sendStudents  = lesson?.sendStatuses ?? []
                    const planByStudent = lesson?.planByStudent ?? {}
                    const allEnrolled   = lesson?.class?.enrolments ?? []
                    const sendIds       = new Set(sendStudents.map(s => s.studentId))
                    const noSendPupils  = allEnrolled.filter(e => !sendIds.has(e.user.id))

                    if (sendStudents.length === 0 && allEnrolled.length === 0) {
                      return (
                        <div className="border border-dashed border-gray-200 rounded-2xl p-12 text-center">
                          <Heart size={28} className="mx-auto text-gray-300 mb-3" />
                          <p className="text-[13px] font-medium text-gray-500 mb-1">No class assigned</p>
                          <p className="text-[12px] text-gray-400">Assign this lesson to a class to see SEND profiles.</p>
                        </div>
                      )
                    }

                    return (
                      <>
                        {/* Summary bar */}
                        <div className="flex items-center gap-3">
                          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                            sendStudents.length > 0 ? 'bg-rose-50 text-rose-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {sendStudents.length} pupil{sendStudents.length !== 1 ? 's' : ''} with SEND needs
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {allEnrolled.length} enrolled total
                          </span>
                        </div>

                        {/* SEND pupil cards */}
                        {sendStudents.map(ss => {
                          const plan = planByStudent[ss.studentId]
                          const classStrategies  = plan?.strategies.filter(s => s.appliesTo === 'CLASSROOM' || s.appliesTo === 'BOTH') ?? []
                          const hwStrategies     = plan?.strategies.filter(s => s.appliesTo === 'HOMEWORK'  || s.appliesTo === 'BOTH') ?? []

                          return (
                            <div key={ss.id} className="border border-gray-200 rounded-2xl overflow-hidden">

                              {/* Card header */}
                              <div className="flex items-center gap-3 px-5 py-4 bg-rose-50/60 border-b border-rose-100">
                                <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                                  {ss.student.firstName[0]}{ss.student.lastName[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-semibold text-gray-900">{ss.student.firstName} {ss.student.lastName}</p>
                                  {ss.needArea && (
                                    <p className="text-[11px] text-rose-600 font-medium mt-0.5">{ss.needArea}</p>
                                  )}
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
                                  ss.activeStatus === 'EHCP'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}>
                                  {ss.activeStatus === 'EHCP' ? 'EHCP' : 'SEN Support'}
                                </span>
                              </div>

                              <div className="px-5 py-4 space-y-4">

                                {/* ILP Targets */}
                                {plan && plan.targets.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                      ILP Targets
                                      {plan.reviewDate && (
                                        <span className="ml-2 text-amber-600 normal-case font-medium">
                                          · Review {new Date(plan.reviewDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                      )}
                                    </p>
                                    <div className="space-y-2">
                                      {plan.targets.map((t, i) => (
                                        <div key={i} className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                                          <div className="flex items-start justify-between gap-2">
                                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{t.needCategory} · {t.metricKey.replace(/_/g, ' ')}</p>
                                            <span className="text-[10px] text-gray-400 shrink-0">{t.measurementWindow}</span>
                                          </div>
                                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            <span className="text-[11px] text-gray-500 bg-white border border-gray-200 rounded px-1.5 py-0.5">{t.baselineValue}</span>
                                            <span className="text-[10px] text-gray-400">→</span>
                                            <span className="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">{t.targetValue}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Classroom strategies */}
                                {classStrategies.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">In-lesson Strategies</p>
                                    <ul className="space-y-1.5">
                                      {classStrategies.map((s, i) => (
                                        <li key={i} className="flex items-start gap-2 text-[12px] text-gray-700">
                                          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                          {s.strategyText}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Homework strategies */}
                                {hwStrategies.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Homework Strategies</p>
                                    <ul className="space-y-1.5">
                                      {hwStrategies.map((s, i) => (
                                        <li key={i} className="flex items-start gap-2 text-[12px] text-gray-700">
                                          <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                          {s.strategyText}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {!plan && (
                                  <p className="text-[12px] text-gray-400 italic">No active ILP on record. Contact the SENCo to create one.</p>
                                )}
                              </div>
                            </div>
                          )
                        })}

                        {/* No-SEND pupils */}
                        {noSendPupils.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                              No SEND needs on record ({noSendPupils.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {noSendPupils.map(e => (
                                <div key={e.user.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full pl-1 pr-3 py-1">
                                  <div className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-[9px] font-bold shrink-0">
                                    {e.user.firstName[0]}{e.user.lastName[0]}
                                  </div>
                                  <span className="text-[11px] text-gray-600">{e.user.firstName} {e.user.lastName}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}

              {/* ── Class Insights ── */}
              {/* ── Revision ── */}
              {activeTab === 'Revision' && (
                <div className="p-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[13px] font-semibold text-gray-900 flex items-center gap-2">
                        <RotateCcw size={14} className="text-blue-500" /> Class Revision Analysis
                      </h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">Based on homework performance over the past 4 weeks</p>
                    </div>
                    {lesson?.class?.id && (
                      <a
                        href={`/revision-program/new?classId=${lesson.class.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[12px] font-semibold transition-colors"
                      >
                        <Plus size={12} /> Create Program
                      </a>
                    )}
                  </div>
                  {lesson?.class?.id && lesson?.scheduledAt ? (
                    <RevisionAnalysisPanel
                      classId={lesson.class.id}
                      periodStart={new Date(new Date(lesson.scheduledAt).getTime() - 28 * 24 * 60 * 60 * 1000)}
                      periodEnd={new Date(lesson.scheduledAt)}
                      onCreateProgram={() => {
                        if (lesson?.class?.id) {
                          window.open(`/revision-program/new?classId=${lesson.class.id}`, '_blank')
                        }
                      }}
                    />
                  ) : (
                    <div className="border border-dashed border-gray-200 rounded-2xl p-10 text-center">
                      <RotateCcw size={24} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-[12px] text-gray-400">No class assigned to this lesson.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'Class Insights' && (
                <div className="p-7 space-y-6">
                  {(() => {
                    const enrolled    = lesson?.class?.enrolments ?? []
                    const totalPupils = enrolled.length
                    const homework    = lesson?.homework ?? []
                    const termAgg     = lesson?.termAgg
                    const medians     = lesson?.subjectMedian?.mediansJson as Record<string, number> | null ?? null

                    // ── helper: infer max score from gradingBands keys ────────
                    function maxFromBands(bands: unknown): number {
                      if (!bands || typeof bands !== 'object') return 9
                      return Math.max(...Object.keys(bands as Record<string, string>)
                        .flatMap(k => k.split(/[-–]/).map(Number).filter(n => !isNaN(n))))
                    }

                    // ── helper: aggregate misconception tags across submissions ─
                    function tallyMisconceptions(subs: typeof homework[0]['submissions']) {
                      const tally = new Map<string, number>()
                      for (const s of subs) {
                        const tags = s.misconceptionTags
                        if (Array.isArray(tags)) {
                          for (const t of tags as string[]) tally.set(t, (tally.get(t) ?? 0) + 1)
                        }
                      }
                      return [...tally.entries()].sort((a, b) => b[1] - a[1])
                    }

                    // ── delta badge ────────────────────────────────────────────
                    function DeltaBadge({ val, medianVal, unit = '' }: { val: number; medianVal: number; unit?: string }) {
                      const diff = val - medianVal
                      const up   = diff >= 0
                      return (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ml-1.5 ${up ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-700'}`}>
                          {up ? '↑' : '↓'} {Math.abs(diff).toFixed(1)}{unit} vs median
                        </span>
                      )
                    }

                    return (
                      <>
                        {/* ── Homework performance ── */}
                        {homework.length === 0 ? (
                          <div className="border border-dashed border-gray-200 rounded-2xl p-10 text-center">
                            <BarChart2 size={24} className="mx-auto text-gray-300 mb-2" />
                            <p className="text-[12px] text-gray-400">No homework set for this lesson yet.</p>
                          </div>
                        ) : (
                          homework.map(hw => {
                            const maxScore   = maxFromBands(hw.gradingBands)
                            const submitted  = hw.submissions.filter(s => s.status !== 'SUBMITTED' || s.finalScore != null)
                            const scored     = hw.submissions.filter(s => s.finalScore != null)
                            const avgScore   = scored.length ? scored.reduce((a, s) => a + s.finalScore!, 0) / scored.length : null
                            const missedIds  = new Set(hw.submissions.map(s => s.student.id))
                            const missing    = enrolled.filter(e => !missedIds.has(e.user.id))
                            const completion = totalPupils > 0 ? hw.submissions.length / totalPupils : 0
                            const misconceptions = tallyMisconceptions(hw.submissions)

                            return (
                              <div key={hw.id} className="border border-gray-200 rounded-2xl overflow-hidden">

                                {/* hw header */}
                                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                                  <div>
                                    <p className="text-[13px] font-semibold text-gray-900">{hw.title}</p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                      Due {new Date(hw.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                    </p>
                                  </div>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    hw.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                  }`}>{hw.status}</span>
                                </div>

                                <div className="px-5 py-4 space-y-5">

                                  {/* stat row */}
                                  <div className="grid grid-cols-3 gap-3">
                                    {/* completion */}
                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Submitted</p>
                                      <p className="text-[18px] font-bold text-gray-900">{hw.submissions.length}<span className="text-[12px] font-normal text-gray-400">/{totalPupils}</span></p>
                                      <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${completion * 100}%` }} />
                                      </div>
                                      <p className="text-[10px] text-gray-400 mt-1">{Math.round(completion * 100)}% completion</p>
                                    </div>

                                    {/* avg score */}
                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Avg Score</p>
                                      {avgScore != null ? (
                                        <>
                                          <p className="text-[18px] font-bold text-gray-900">
                                            {avgScore.toFixed(1)}<span className="text-[12px] font-normal text-gray-400">/{maxScore}</span>
                                          </p>
                                          <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${avgScore / maxScore >= 0.7 ? 'bg-green-500' : avgScore / maxScore >= 0.4 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                              style={{ width: `${(avgScore / maxScore) * 100}%` }} />
                                          </div>
                                          <p className="text-[10px] text-gray-400 mt-1">{Math.round((avgScore / maxScore) * 100)}% of marks</p>
                                        </>
                                      ) : (
                                        <p className="text-[12px] text-gray-400 mt-2">Not yet marked</p>
                                      )}
                                    </div>

                                    {/* missing */}
                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Missing</p>
                                      <p className={`text-[18px] font-bold ${missing.length > 0 ? 'text-rose-600' : 'text-green-600'}`}>{missing.length}</p>
                                      {missing.length > 0 ? (
                                        <div className="mt-1.5 space-y-0.5">
                                          {missing.map(e => (
                                            <p key={e.user.id} className="text-[10px] text-rose-500 truncate">⚠ {e.user.firstName} {e.user.lastName}</p>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-[10px] text-green-600 mt-1">All submitted ✓</p>
                                      )}
                                    </div>
                                  </div>

                                  {/* per-pupil score bars */}
                                  {scored.length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Pupil Scores</p>
                                      <div className="space-y-2">
                                        {[...hw.submissions]
                                          .sort((a, b) => (b.finalScore ?? -1) - (a.finalScore ?? -1))
                                          .map(s => {
                                            const pct = s.finalScore != null ? (s.finalScore / maxScore) * 100 : 0
                                            const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                                            return (
                                              <div key={s.id} className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[9px] font-bold shrink-0">
                                                  {s.student.firstName[0]}{s.student.lastName[0]}
                                                </div>
                                                <span className="text-[12px] text-gray-700 w-32 shrink-0 truncate">{s.student.firstName} {s.student.lastName}</span>
                                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                  <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                                                </div>
                                                <span className="text-[11px] font-semibold text-gray-700 w-10 text-right shrink-0">
                                                  {s.finalScore != null ? `${s.finalScore}/${maxScore}` : '—'}
                                                </span>
                                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full w-16 text-center shrink-0 ${
                                                  s.status === 'RETURNED' ? 'bg-green-100 text-green-700' :
                                                  s.status === 'MARKED'   ? 'bg-blue-100 text-blue-700'   :
                                                  'bg-gray-100 text-gray-500'
                                                }`}>{s.status.charAt(0) + s.status.slice(1).toLowerCase()}</span>
                                              </div>
                                            )
                                          })}
                                        {missing.map(e => (
                                          <div key={e.user.id} className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-rose-50 text-rose-400 flex items-center justify-center text-[9px] font-bold shrink-0">
                                              {e.user.firstName[0]}{e.user.lastName[0]}
                                            </div>
                                            <span className="text-[12px] text-gray-400 w-32 shrink-0 truncate">{e.user.firstName} {e.user.lastName}</span>
                                            <div className="flex-1 h-2 bg-gray-100 rounded-full" />
                                            <span className="text-[11px] text-gray-300 w-10 text-right shrink-0">—</span>
                                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full w-16 text-center shrink-0 bg-rose-50 text-rose-400">Missing</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* misconceptions */}
                                  {misconceptions.length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Common Misconceptions</p>
                                      <div className="space-y-1.5">
                                        {misconceptions.map(([tag, count]) => (
                                          <div key={tag} className="flex items-center gap-2">
                                            <div className="flex-1 flex items-center gap-2">
                                              <div className="h-1.5 bg-rose-400 rounded-full" style={{ width: `${Math.min(count * 40, 100)}%`, minWidth: 8 }} />
                                              <span className="text-[11px] text-gray-600 capitalize">{tag.replace(/_/g, ' ')}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-rose-500 shrink-0">×{count}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        )}

                        {/* ── Term overview ── */}
                        {termAgg && (
                          <div>
                            <h3 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
                              Term Overview — {lesson?.class?.name}
                            </h3>
                            <div className="grid grid-cols-2 gap-3">

                              <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Completion Rate</p>
                                <div className="flex items-baseline gap-1 flex-wrap">
                                  <span className="text-[20px] font-bold text-gray-900">{Math.round(termAgg.completionRate * 100)}%</span>
                                  {medians?.completionRate != null && (
                                    <DeltaBadge val={termAgg.completionRate * 100} medianVal={medians.completionRate * 100} unit="pp" />
                                  )}
                                </div>
                                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${termAgg.completionRate >= 0.8 ? 'bg-green-500' : termAgg.completionRate >= 0.6 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                    style={{ width: `${termAgg.completionRate * 100}%` }} />
                                </div>
                              </div>

                              <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Average Score</p>
                                <div className="flex items-baseline gap-1 flex-wrap">
                                  <span className="text-[20px] font-bold text-gray-900">{termAgg.avgScore.toFixed(1)}</span>
                                  {medians?.avgScore != null && (
                                    <DeltaBadge val={termAgg.avgScore} medianVal={medians.avgScore} />
                                  )}
                                </div>
                              </div>

                              <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Predicted Trend</p>
                                <span className={`text-[20px] font-bold ${termAgg.predictedDelta > 0 ? 'text-green-600' : termAgg.predictedDelta < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                                  {termAgg.predictedDelta > 0 ? '+' : ''}{termAgg.predictedDelta.toFixed(1)}
                                </span>
                                <p className="text-[10px] text-gray-400 mt-0.5">grade points vs last term</p>
                              </div>

                              <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Integrity Flags</p>
                                <span className={`text-[20px] font-bold ${termAgg.integrityFlagRate === 0 ? 'text-green-600' : termAgg.integrityFlagRate < 0.05 ? 'text-amber-600' : 'text-rose-600'}`}>
                                  {Math.round(termAgg.integrityFlagRate * 100)}%
                                </span>
                                <p className="text-[10px] text-gray-400 mt-0.5">of submissions flagged</p>
                              </div>

                            </div>
                          </div>
                        )}

                        {homework.length === 0 && !termAgg && (
                          <div className="border border-dashed border-gray-200 rounded-2xl p-10 text-center">
                            <BarChart2 size={24} className="mx-auto text-gray-300 mb-2" />
                            <p className="text-[12px] text-gray-400">No data yet for this lesson.</p>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Sticky resources wizard footer (step 4) ─────────── */}
        {wizardStep === 4 && (
          <div className="shrink-0 border-t border-gray-200 px-7 py-4 flex items-center justify-between bg-white">
            <button
              onClick={() => setWizardStep(null)}
              className="text-[12px] text-gray-400 hover:text-gray-600 underline"
            >
              Skip
            </button>
            <button
              onClick={() => { setWizardStep(5); initHwDates() }}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700 transition-colors"
            >
              Save &amp; Continue
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* ── Sticky homework wizard footer (step 5) ──────────── */}
        {wizardStep === 5 && hwYesNo === 'yes' && (() => {
          const activeHw = typeStore[hwType] ?? { instructions: '', modelAnswer: '', gradingBands: {}, targetWordCount: 300 }
          const hasContent =
            (hwType === 'MCQ_QUIZ'     && mcqQuestions.length > 0) ||
            (hwType === 'SHORT_ANSWER' && saQuestions.length  > 0) ||
            (hwType !== 'MCQ_QUIZ' && hwType !== 'SHORT_ANSWER' && !!activeHw.instructions)
          return (
          <div className="shrink-0 border-t border-gray-200 px-7 py-4 flex items-center justify-between bg-white">
            <button
              onClick={() => setWizardStep(4)}
              className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
            <button
              disabled={hwSaving || generatingHw || !hasContent || !hwDueDate}
              onClick={() => startHwSave(async () => {
                if (!lesson?.classId) { router.refresh(); onClose(); return }
                // Serialise question cards to flat text + questionsJson
                let finalInstructions = activeHw.instructions
                let finalModelAnswer  = activeHw.modelAnswer
                let finalQuestionsJson: object | undefined
                if (hwType === 'MCQ_QUIZ' && mcqQuestions.length > 0) {
                  const s = serializeMCQ()
                  finalInstructions  = s.instructions
                  finalModelAnswer   = s.modelAnswer
                  finalQuestionsJson = { questions: mcqQuestions }
                } else if (hwType === 'SHORT_ANSWER' && saQuestions.length > 0) {
                  const s = serializeSA()
                  finalInstructions  = s.instructions
                  finalModelAnswer   = s.modelAnswer
                  finalQuestionsJson = { questions: saQuestions }
                }
                await createHomework({
                  lessonId:        lessonId!,
                  classId:         lesson.classId,
                  title:           lesson.title,
                  instructions:    finalInstructions,
                  type:            hwType,
                  modelAnswer:     finalModelAnswer   || undefined,
                  gradingBands:    Object.keys(activeHw.gradingBands).length > 0 ? activeHw.gradingBands : undefined,
                  targetWordCount: activeHw.targetWordCount || undefined,
                  questionsJson:   finalQuestionsJson,
                  aiDecision:      aiDecision || undefined,
                  setAt:           hwSetDate ? new Date(hwSetDate).toISOString() : new Date().toISOString(),
                  dueAt:           new Date(hwDueDate).toISOString(),
                })
                router.refresh()
                onClose()
              })}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {hwSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Save &amp; done
            </button>
          </div>
          )
        })()}

        {/* ── Sticky save footer — normal edit mode ────────────── */}
        {wizardStep === null && (
          <div className="shrink-0 border-t border-gray-200 px-7 py-3 flex items-center justify-between bg-white">
            <span className="text-[11px] text-gray-400">
              {saving ? 'Saving…' : 'Changes to title and objectives are auto-saved.'}
            </span>
            <button
              onClick={handleSaveAndClose}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
