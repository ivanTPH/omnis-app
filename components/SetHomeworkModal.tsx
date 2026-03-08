'use client'
import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Sparkles, CheckCircle, BookOpen, AlertCircle } from 'lucide-react'
import type { HomeworkType } from '@prisma/client'
import {
  getTeacherLessons,
  getTeacherClasses,
  generateHomeworkFromResources,
  createHomework,
} from '@/app/actions/homework'
import type { LessonForHomework, ClassForHomework } from '@/app/actions/homework'

const HW_TYPES: { value: HomeworkType; label: string; desc: string }[] = [
  { value: 'MCQ_QUIZ',         label: 'MCQ Quiz',         desc: '8 multiple-choice questions auto-generated from lesson objectives' },
  { value: 'SHORT_ANSWER',     label: 'Short Answer',     desc: '4 short-answer questions with model answers' },
  { value: 'EXTENDED_WRITING', label: 'Extended Writing', desc: 'One analytical essay question with structured model answer' },
  { value: 'MIXED',            label: 'Mixed',            desc: 'Knowledge questions + extended response (combined)' },
  { value: 'UPLOAD',           label: 'Upload Task',      desc: 'Paper task students complete and photograph to upload' },
]

export default function SetHomeworkModal({ onClose, onCreated }: {
  onClose:   () => void
  onCreated: () => void
}) {
  const router = useRouter()

  const [lessons,  setLessons]  = useState<LessonForHomework[]>([])
  const [classes,  setClasses]  = useState<ClassForHomework[]>([])
  const [loading,  setLoading]  = useState(true)

  // Form fields
  const [lessonId,      setLessonId]      = useState('')
  const [hwType,        setHwType]        = useState<HomeworkType>('SHORT_ANSWER')
  const [classId,       setClassId]       = useState('')
  const [dueDate,       setDueDate]       = useState('')
  const [title,         setTitle]         = useState('')
  const [instructions,  setInstructions]  = useState('')
  const [modelAnswer,   setModelAnswer]   = useState('')

  // AI generation
  const [isGenerating, startGen] = useTransition()
  const [genError,     setGenError]    = useState('')
  const [generated,    setGenerated]   = useState(false)

  // Publish
  const [isPublishing, startPub] = useTransition()
  const [pubError,     setPubError]    = useState('')

  const selectedLesson = lessons.find(l => l.id === lessonId)

  // Load lessons + classes on mount; pre-fill due date to +7 days
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const next7 = new Date()
    next7.setDate(next7.getDate() + 7)
    setDueDate(next7.toISOString().slice(0, 10))

    Promise.all([getTeacherLessons(), getTeacherClasses()]).then(([ls, cs]) => {
      setLessons(ls)
      setClasses(cs)
      setLoading(false)
    })
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleLessonChange(id: string) {
    setLessonId(id)
    setGenerated(false)
    setInstructions('')
    setModelAnswer('')
    setGenError('')
    const lesson = lessons.find(l => l.id === id)
    if (lesson) {
      setTitle(`Homework: ${lesson.title}`)
      if (lesson.class) setClassId(lesson.class.id)
    }
  }

  function handleTypeChange(t: HomeworkType) {
    setHwType(t)
    setGenerated(false)
    setInstructions('')
    setModelAnswer('')
    setGenError('')
  }

  function handleGenerate() {
    if (!lessonId) return
    setGenError('')
    startGen(async () => {
      try {
        const result = await generateHomeworkFromResources(lessonId, hwType)
        setInstructions(result.instructions)
        setModelAnswer(result.modelAnswer)
        setGenerated(true)
      } catch (e: unknown) {
        setGenError(e instanceof Error ? e.message : 'Generation failed. Please try again.')
      }
    })
  }

  function handlePublish() {
    if (!lessonId || !classId || !dueDate || !title || !instructions) return
    setPubError('')
    startPub(async () => {
      try {
        await createHomework({
          lessonId,
          classId,
          title,
          instructions,
          type:        hwType,
          modelAnswer: modelAnswer || undefined,
          setAt:       new Date().toISOString(),
          dueAt:       new Date(dueDate + 'T17:00:00').toISOString(),
        })
        onCreated()
        router.refresh()
      } catch (e: unknown) {
        setPubError(e instanceof Error ? e.message : 'Failed to publish homework.')
      }
    })
  }

  const canPublish = !!lessonId && !!classId && !!dueDate && !!title && !!instructions && !isPublishing

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl max-h-[95dvh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4 shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Set Homework</h2>
            <p className="text-sm text-gray-400">Link to a lesson, generate questions with AI, then publish</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ── Lesson ── */}
              <section>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Lesson
                </label>
                {lessons.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl p-3">
                    <BookOpen size={15} className="text-gray-400 shrink-0" />
                    No lessons found. Create a lesson in the calendar first.
                  </div>
                ) : (
                  <select
                    value={lessonId}
                    onChange={e => handleLessonChange(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a lesson…</option>
                    {lessons.map(l => (
                      <option key={l.id} value={l.id}>
                        {new Date(l.scheduledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {l.class?.name ?? 'No class'} · {l.title}
                      </option>
                    ))}
                  </select>
                )}

                {selectedLesson && (
                  <div className="mt-2 bg-gray-50 rounded-xl px-4 py-3 space-y-2.5">
                    {selectedLesson.objectives.length > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Learning Objectives</div>
                        <ul className="space-y-0.5">
                          {selectedLesson.objectives.map((o, i) => (
                            <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                              <span className="text-blue-400 mt-0.5 shrink-0">•</span>{o}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedLesson.resources.length > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Resources</div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedLesson.resources.map((r, i) => (
                            <span key={i} className="text-[10px] font-medium px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                              {r.type} · {r.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedLesson.objectives.length === 0 && selectedLesson.resources.length === 0 && (
                      <p className="text-xs text-gray-400">No objectives or resources attached to this lesson. AI will generate based on the lesson title.</p>
                    )}
                  </div>
                )}
              </section>

              {/* ── Homework type ── */}
              <section>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Homework Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {HW_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => handleTypeChange(t.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        hwType === t.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">{HW_TYPES.find(t => t.value === hwType)?.desc}</p>
              </section>

              {/* ── Class + Due date ── */}
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Assign to Class</label>
                  <select
                    value={classId}
                    onChange={e => setClassId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select class…</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} · Year {c.yearGroup}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </section>

              {/* ── Title ── */}
              <section>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Chapter 5 Comprehension Quiz"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </section>

              {/* ── Content + AI ── */}
              <section>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Content</label>
                  <button
                    onClick={handleGenerate}
                    disabled={!lessonId || isGenerating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGenerating
                      ? <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                      : <Sparkles size={13} />}
                    {isGenerating ? 'Generating…' : generated ? 'Re-generate with AI' : 'Generate with AI'}
                  </button>
                </div>

                {genError && (
                  <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2 mb-3">
                    <AlertCircle size={14} className="shrink-0" />{genError}
                  </div>
                )}

                {generated && !genError && (
                  <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5 mb-3">
                    <CheckCircle size={12} />AI generated — review and edit below before publishing
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Instructions <span className="text-gray-400">(shown to students)</span></div>
                    <textarea
                      value={instructions}
                      onChange={e => setInstructions(e.target.value)}
                      rows={7}
                      placeholder={'Select a lesson and click "Generate with AI" — or type instructions manually'}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Model Answer / Mark Scheme <span className="text-gray-400">(teacher-only)</span></div>
                    <textarea
                      value={modelAnswer}
                      onChange={e => setModelAnswer(e.target.value)}
                      rows={4}
                      placeholder="Model answer or marking guidance…"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Cancel
          </button>
          {pubError && <p className="text-xs text-rose-600 flex-1 text-center">{pubError}</p>}
          <button
            onClick={handlePublish}
            disabled={!canPublish}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isPublishing
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <CheckCircle size={15} />}
            Publish Homework
          </button>
        </div>
      </div>
    </div>
  )
}
