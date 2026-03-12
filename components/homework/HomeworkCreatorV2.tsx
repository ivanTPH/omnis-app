'use client'

import { useState } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles, BookOpen, Upload, PenLine } from 'lucide-react'
import type { LessonForHomework, ClassForHomework, LearningExtraction, GeneratedHomeworkContent } from '@/app/actions/homework'
import { extractLearningFromLesson, generateHomeworkContent, createHomework } from '@/app/actions/homework'
import { suggestSpacedRepetition, suggestNextHomework } from '@/app/actions/adaptive-learning'
import { HomeworkType } from '@prisma/client'
import IlpTargetHomeworkPanel from './IlpTargetHomeworkPanel'

const VARIANT_TYPES = [
  { id: 'retrieval_practice', label: 'Retrieval Practice', blooms: 'remember' },
  { id: 'quiz',               label: 'Quiz',               blooms: 'understand' },
  { id: 'multiple_choice',    label: 'Multiple Choice',    blooms: 'apply' },
  { id: 'short_answer',       label: 'Short Answer',       blooms: 'analyse' },
  { id: 'essay',              label: 'Essay',              blooms: 'evaluate' },
  { id: 'mind_map',           label: 'Mind Map',           blooms: 'create' },
  { id: 'reading_response',   label: 'Reading Response',   blooms: 'analyse' },
  { id: 'research_task',      label: 'Research Task',      blooms: 'evaluate' },
  { id: 'creative',           label: 'Creative Task',      blooms: 'create' },
  { id: 'practical',          label: 'Practical Task',     blooms: 'apply' },
  { id: 'free_text',          label: 'Free Text',          blooms: 'understand' },
]

type Props = {
  lessons: LessonForHomework[]
  classes: ClassForHomework[]
  onClose: () => void
  onCreated?: () => void
}

export default function HomeworkCreatorV2({ lessons, classes, onClose, onCreated }: Props) {
  const [step, setStep] = useState(1)
  const [source, setSource] = useState<'lesson' | 'manual'>('lesson')
  const [selectedLesson, setSelectedLesson] = useState<LessonForHomework | null>(null)
  const [selectedClassId, setSelectedClassId] = useState('')
  const [extraction, setExtraction] = useState<LearningExtraction | null>(null)
  const [selectedType, setSelectedType] = useState('quiz')
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10)
  })
  const [generated, setGenerated] = useState<GeneratedHomeworkContent | null>(null)
  const [editedInstructions, setEditedInstructions] = useState('')
  const [editedTitle, setEditedTitle] = useState('')
  const [linkedIlpTargetIds, setLinkedIlpTargetIds] = useState<string[]>([])
  const [spacingSuggestion, setSpacingSuggestion] = useState<string | null>(null)
  const [suggestedIlpTargets, setSuggestedIlpTargets] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')

  const classId = selectedLesson?.class?.id ?? selectedClassId

  async function handleExtract() {
    if (!selectedLesson) return
    setLoading(true); setError('')
    try {
      const ex = await extractLearningFromLesson(selectedLesson.id)
      setExtraction(ex)
      if (ex.suggestedHomeworkTypes[0]) setSelectedType(ex.suggestedHomeworkTypes[0])
      // Fetch spacing suggestion
      if (classId && selectedLesson.class?.subject) {
        try {
          const sug = await suggestSpacedRepetition(classId, selectedLesson.class.subject, ex.keyTopics[0] ?? '')
          setSpacingSuggestion(sug.rationale)
        } catch { /* ignore */ }
      }
      try {
        const suggestion = await suggestNextHomework(classId, selectedLesson.id)
        if (suggestion.ilpTargetsToAddress.length > 0) {
          setSuggestedIlpTargets(suggestion.ilpTargetsToAddress)
        }
      } catch { /* ignore — teacher may not have access */ }
      setStep(2)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  function handleManualContinue() {
    setExtraction({
      learningObjectives: ['Enter your learning objectives'],
      bloomsLevel: 'understand',
      keyTopics: ['Enter key topic'],
      suggestedHomeworkTypes: ['free_text'],
      suggestedDurationMins: 20,
      rationale: 'Manual entry',
    })
    setStep(2)
  }

  async function handleGenerate() {
    if (!extraction) return
    setLoading(true); setError('')
    try {
      const cls = selectedLesson?.class ?? classes.find(c => c.id === selectedClassId)
      const gen = await generateHomeworkContent({
        homeworkVariantType: selectedType,
        subject: cls?.subject ?? 'Unknown',
        yearGroup: cls?.yearGroup ?? 10,
        learningObjectives: extraction.learningObjectives,
        bloomsLevel: extraction.bloomsLevel,
        keyTopics: extraction.keyTopics,
        durationMins: extraction.suggestedDurationMins,
        ilpTargets: suggestedIlpTargets.length > 0 ? suggestedIlpTargets : undefined,
      })
      setGenerated(gen)
      setEditedTitle(gen.title)
      setEditedInstructions(gen.instructions)
      setStep(4)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  async function handlePublish() {
    if (!extraction || !generated || !classId) return
    setPublishing(true); setError('')
    try {
      await createHomework({
        lessonId:  selectedLesson?.id ?? '',
        classId,
        title:     editedTitle,
        instructions: editedInstructions,
        type:      HomeworkType.SHORT_ANSWER,
        setAt:     new Date().toISOString(),
        dueAt:     new Date(dueDate).toISOString(),
        homeworkVariantType: selectedType,
        structuredContent:   generated.structuredContent,
        learningObjectives:  extraction.learningObjectives,
        bloomsLevel:         extraction.bloomsLevel,
        ilpTargetIds:        linkedIlpTargetIds,
        differentiationNotes: generated.differentiationNotes,
        estimatedMins: extraction.suggestedDurationMins,
      })
      onCreated?.()
      onClose()
    } catch (e) { setError((e as Error).message) }
    finally { setPublishing(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100 z-10">
          <div>
            <h2 className="font-semibold text-gray-900">Create Homework</h2>
            <div className="flex gap-1 mt-1">
              {[1,2,3,4,5,6].map(s => (
                <div key={s} className={`h-1 w-8 rounded-full ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Step 1: Choose source */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Step 1 — Choose source</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSource('lesson')}
                  className={`p-4 rounded-xl border-2 text-left transition-colors ${source === 'lesson' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <BookOpen size={20} className="text-blue-600 mb-2" />
                  <p className="font-medium text-sm">From a lesson</p>
                  <p className="text-xs text-gray-500 mt-0.5">AI extracts objectives from lesson content</p>
                </button>
                <button
                  onClick={() => setSource('manual')}
                  className={`p-4 rounded-xl border-2 text-left transition-colors ${source === 'manual' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <PenLine size={20} className="text-blue-600 mb-2" />
                  <p className="font-medium text-sm">Manual entry</p>
                  <p className="text-xs text-gray-500 mt-0.5">Set your own objectives and content</p>
                </button>
              </div>

              {source === 'lesson' && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">Select lesson</label>
                  <select
                    value={selectedLesson?.id ?? ''}
                    onChange={e => setSelectedLesson(lessons.find(l => l.id === e.target.value) ?? null)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Choose a lesson…</option>
                    {lessons.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.title} — {l.class?.name ?? 'No class'} ({new Date(l.scheduledAt).toLocaleDateString('en-GB')})
                      </option>
                    ))}
                  </select>
                  {selectedLesson && (
                    <div className="bg-blue-50 rounded-xl p-3 text-sm">
                      <p className="font-medium text-blue-900">{selectedLesson.title}</p>
                      {selectedLesson.objectives.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {selectedLesson.objectives.slice(0, 3).map((o, i) => <li key={i} className="text-blue-700 text-xs">• {o}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleExtract}
                    disabled={!selectedLesson || loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Sparkles size={15} />
                    {loading ? 'Extracting…' : 'Extract learning objectives'}
                  </button>
                </div>
              )}

              {source === 'manual' && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">Class</label>
                  <select
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Choose class…</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.subject} Y{c.yearGroup}</option>)}
                  </select>
                  <button
                    onClick={handleManualContinue}
                    disabled={!selectedClassId}
                    className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          {/* Step 2: Review objectives */}
          {step === 2 && extraction && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Step 2 — Learning objectives</h3>
              <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-blue-900">Bloom&apos;s level: <span className="capitalize">{extraction.bloomsLevel}</span></p>
                  <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">{extraction.suggestedDurationMins} mins</span>
                </div>
                <ul className="space-y-1">
                  {extraction.learningObjectives.map((o, i) => <li key={i} className="text-sm text-blue-800">• {o}</li>)}
                </ul>
              </div>
              {spacingSuggestion && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                  📅 Spacing: {spacingSuggestion}
                </div>
              )}
              {suggestedIlpTargets.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-1.5">
                  <p className="text-sm font-medium text-purple-800">
                    ⚡ {suggestedIlpTargets.length} ILP target{suggestedIlpTargets.length !== 1 ? 's' : ''} due within 28 days for students in this class
                  </p>
                  <ul className="space-y-0.5">
                    {suggestedIlpTargets.map((t, i) => (
                      <li key={i} className="text-xs text-purple-700">• {t}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-purple-600">These will be incorporated into the AI-generated content. You can link specific targets in Step 5.</p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                  <ChevronLeft size={15} /> Back
                </button>
                <button onClick={() => setStep(3)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  Next <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Choose type */}
          {step === 3 && extraction && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Step 3 — Choose homework type</h3>
              <p className="text-xs text-gray-500">AI suggests: {extraction.suggestedHomeworkTypes.slice(0, 3).join(', ')}</p>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {VARIANT_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedType(t.id)}
                    className={`p-3 rounded-xl border-2 text-left text-sm transition-colors ${selectedType === t.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <p className="font-medium">{t.label}</p>
                    <p className="text-xs text-gray-500 capitalize">Bloom&apos;s: {t.blooms}</p>
                    {extraction.suggestedHomeworkTypes.includes(t.id) && (
                      <span className="text-xs text-green-600 font-medium">✓ Suggested</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                  <ChevronLeft size={15} /> Back
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  <Sparkles size={15} />
                  {loading ? 'Generating…' : 'Generate content'}
                </button>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          {/* Step 4: Review generated content */}
          {step === 4 && generated && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Step 4 — Review content</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Title</label>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={e => setEditedTitle(e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Student instructions</label>
                  <textarea
                    value={editedInstructions}
                    onChange={e => setEditedInstructions(e.target.value)}
                    rows={5}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y"
                  />
                </div>
                {generated.differentiationNotes && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                    <p className="text-xs font-medium text-purple-800 mb-1">SEND / Differentiation notes</p>
                    <p className="text-sm text-purple-700">{generated.differentiationNotes}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                  <ChevronLeft size={15} /> Back
                </button>
                <button onClick={() => setStep(5)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  Next <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Step 5: ILP targets */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Step 5 — Link ILP targets (optional)</h3>
              <IlpTargetHomeworkPanel
                classId={classId}
                linkedIds={linkedIlpTargetIds}
                onToggle={id => setLinkedIlpTargetIds(prev =>
                  prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                )}
              />
              <div className="flex gap-3">
                <button onClick={() => setStep(4)} className="flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                  <ChevronLeft size={15} /> Back
                </button>
                <button onClick={() => setStep(6)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  Next <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Review + Set */}
          {step === 6 && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Step 6 — Review &amp; set</h3>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <p><span className="text-gray-500">Title:</span> <span className="font-medium">{editedTitle}</span></p>
                <p><span className="text-gray-500">Type:</span> <span className="font-medium capitalize">{selectedType.replace(/_/g, ' ')}</span></p>
                <p><span className="text-gray-500">Bloom&apos;s:</span> <span className="font-medium capitalize">{extraction?.bloomsLevel}</span></p>
                {linkedIlpTargetIds.length > 0 && (
                  <p><span className="text-gray-500">ILP targets linked:</span> <span className="font-medium">{linkedIlpTargetIds.length}</span></p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Due date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(5)} className="flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                  <ChevronLeft size={15} /> Back
                </button>
                <button
                  onClick={handlePublish}
                  disabled={publishing || !classId}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {publishing ? 'Publishing…' : 'Publish homework'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
