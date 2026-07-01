'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import type { LessonForHomework, ClassForHomework, LearningExtraction, GeneratedHomeworkContent } from '@/app/actions/homework'
import { extractLearningFromLesson, generateHomeworkContent, createHomework } from '@/app/actions/homework'
import { suggestSpacedRepetition, suggestNextHomework, getClassFormatInsights } from '@/app/actions/adaptive-learning'
import { getSoWTopicsForClass } from '@/app/actions/year-group-plans'
import type { ClassFormatInsight } from '@/app/actions/adaptive-learning'
import { HomeworkType } from '@prisma/client'
import IlpTargetHomeworkPanel from './IlpTargetHomeworkPanel'

type ObjectiveEntry = {
  id:              string
  text:            string
  fromLesson:      boolean   // true = extracted from lesson, false = added manually
  sourceMaterial?: string
  showSource?:     boolean
}

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
  const [spacingSuggestion,   setSpacingSuggestion]   = useState<string | null>(null)
  const [suggestedIlpTargets, setSuggestedIlpTargets] = useState<string[]>([])
  const [formatInsight,       setFormatInsight]        = useState<ClassFormatInsight | null>(null)
  const [loadingInsight,      setLoadingInsight]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [genElapsed, setGenElapsed] = useState(0)
  const [objectives, setObjectives] = useState<ObjectiveEntry[]>([])
  const [sowTopics, setSowTopics] = useState<string[]>([])
  const [sowExpanded, setSowExpanded] = useState(false)

  const classId = selectedLesson?.class?.id ?? selectedClassId

  async function handleExtract() {
    if (!selectedLesson) return
    setLoading(true); setError('')
    try {
      const ex = await extractLearningFromLesson(selectedLesson.id)
      setExtraction(ex)
      if (ex.suggestedHomeworkTypes[0]) setSelectedType(ex.suggestedHomeworkTypes[0])
      setObjectives(ex.learningObjectives.map((text, i) => ({
        id: `ex-${i}`,
        text,
        fromLesson: true,
      })))
      // Fetch SoW topics for curriculum context
      if (selectedLesson.class?.subject && selectedLesson.class?.yearGroup) {
        getSoWTopicsForClass(selectedLesson.class.subject, selectedLesson.class.yearGroup)
          .then(t => setSowTopics(t))
          .catch(() => {})
      }
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
    setObjectives([{
      id: 'manual-0',
      text: 'Enter your learning objective',
      fromLesson: false,
      showSource: true,
    }])
    const cls = classes.find(c => c.id === selectedClassId)
    if (cls) {
      getSoWTopicsForClass(cls.subject, cls.yearGroup)
        .then(t => setSowTopics(t))
        .catch(() => {})
    }
    setStep(2)
  }

  async function handleGenerate() {
    if (!extraction) return
    setLoading(true); setError(''); setGenElapsed(0)
    const startedAt = Date.now()
    const timer = setInterval(() => setGenElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    try {
      const cls = selectedLesson?.class ?? classes.find(c => c.id === selectedClassId)
      const editedObjectives = objectives.length > 0
        ? objectives.map(o => o.text).filter(Boolean)
        : extraction.learningObjectives
      const additionalContext = objectives
        .filter(o => !o.fromLesson && o.sourceMaterial?.trim())
        .map(o => `Objective: ${o.text}\n${o.sourceMaterial}`)
        .join('\n\n') || undefined
      const gen = await generateHomeworkContent({
        homeworkVariantType: selectedType,
        subject: cls?.subject ?? 'Unknown',
        yearGroup: cls?.yearGroup ?? 10,
        learningObjectives: editedObjectives,
        bloomsLevel: extraction.bloomsLevel,
        keyTopics: extraction.keyTopics,
        durationMins: extraction.suggestedDurationMins,
        ilpTargets: suggestedIlpTargets.length > 0 ? suggestedIlpTargets : undefined,
        additionalContext,
      })
      setGenerated(gen)
      setEditedTitle(gen.title)
      setEditedInstructions(gen.instructions)
      setStep(4)
    } catch (e) {
      const msg = (e as Error).message ?? ''
      if (msg.toLowerCase().includes('rate limit')) {
        setError(msg)
      } else if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('network') || msg.includes('fetch failed')) {
        setError('Generation timed out — the AI took too long to respond. Try simplifying your learning objectives or click Retry.')
      } else {
        setError('Content generation failed. Please try again — if this persists, reduce the number of learning objectives.')
      }
    }
    finally { clearInterval(timer); setLoading(false) }
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
      <div role="dialog" aria-modal="true" aria-label="Create homework" className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
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
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100"><Icon name="close" size="md" /></button>
        </div>

        {/* Generating banner — visible above the fold while AI runs */}
        {loading && (
          <div className="sticky top-[73px] z-10 bg-blue-50 border-b border-blue-100 px-6 py-2 flex items-center gap-2">
            <Icon name="refresh" size="sm" className="animate-spin text-blue-600 shrink-0" />
            <span className="text-[13px] text-blue-700 font-medium">
              {genElapsed < 10 ? 'Generating homework…'
               : genElapsed < 30 ? `Generating… (${genElapsed}s)`
               : genElapsed < 60 ? `Still working… (${genElapsed}s)`
               : `Almost there… (${genElapsed}s)`}
            </span>
          </div>
        )}

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
                  <Icon name="menu_book" size="md" className="text-blue-600 mb-2" />
                  <p className="font-medium text-sm">From a lesson</p>
                  <p className="text-xs text-gray-500 mt-0.5">AI extracts objectives from lesson content</p>
                </button>
                <button
                  onClick={() => setSource('manual')}
                  className={`p-4 rounded-xl border-2 text-left transition-colors ${source === 'manual' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <Icon name="edit" size="md" className="text-blue-600 mb-2" />
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
                    <Icon name="auto_awesome" size="sm" />
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

          {/* Step 2: Review & edit objectives */}
          {step === 2 && extraction && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Step 2 — Learning objectives</h3>

              {/* Meta row */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Bloom&apos;s: <span className="text-gray-800 capitalize font-bold">{extraction.bloomsLevel}</span>
                </span>
                <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                  {extraction.suggestedDurationMins} mins
                </span>
              </div>

              {/* Editable objectives */}
              <div className="space-y-2">
                {objectives.map((obj, idx) => (
                  <div
                    key={obj.id}
                    className={`border rounded-xl overflow-hidden ${obj.fromLesson ? 'border-gray-200' : 'border-amber-200'}`}
                  >
                    <div className={`flex items-center gap-2 px-3 py-2 ${obj.fromLesson ? 'bg-white' : 'bg-amber-50'}`}>
                      <Icon
                        name={obj.fromLesson ? 'menu_book' : 'add_circle'}
                        size="sm"
                        className={`shrink-0 ${obj.fromLesson ? 'text-blue-400' : 'text-amber-500'}`}
                      />
                      <input
                        type="text"
                        value={obj.text}
                        onChange={e => setObjectives(prev => prev.map((o, i) => i === idx ? { ...o, text: e.target.value } : o))}
                        className="flex-1 text-sm text-gray-800 bg-transparent border-0 focus:outline-none"
                        placeholder="Objective…"
                      />
                      {!obj.fromLesson && (
                        <button
                          onClick={() => setObjectives(prev => prev.map((o, i) => i === idx ? { ...o, showSource: !o.showSource } : o))}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 transition-colors ${
                            obj.sourceMaterial?.trim() ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          }`}
                        >
                          {obj.sourceMaterial?.trim() ? 'Source ✓' : 'Add source'}
                        </button>
                      )}
                      <button
                        onClick={() => setObjectives(prev => prev.filter((_, i) => i !== idx))}
                        className="text-gray-300 hover:text-rose-500 shrink-0 transition-colors"
                        title="Remove objective"
                      >
                        <Icon name="close" size="sm" />
                      </button>
                    </div>
                    {obj.showSource && !obj.fromLesson && (
                      <div className="px-3 pb-3 pt-2 border-t border-amber-100 bg-amber-50 space-y-1.5">
                        <p className="text-[10px] text-amber-700 font-semibold">
                          No lesson covers this objective — paste source material so the AI generates accurate content:
                        </p>
                        <textarea
                          rows={3}
                          value={obj.sourceMaterial ?? ''}
                          onChange={e => setObjectives(prev => prev.map((o, i) => i === idx ? { ...o, sourceMaterial: e.target.value } : o))}
                          placeholder="Paste notes, textbook extracts, key facts…"
                          className="w-full text-xs border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white resize-none"
                        />
                      </div>
                    )}
                  </div>
                ))}
                {objectives.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">No objectives yet — add one below.</p>
                )}
              </div>

              {/* Add objective row */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add an objective…"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      const text = e.currentTarget.value.trim()
                      const fromLesson = source === 'lesson' && (extraction?.learningObjectives ?? []).includes(text)
                      setObjectives(prev => [...prev, {
                        id: `add-${Date.now()}`,
                        text,
                        fromLesson,
                        showSource: !fromLesson,
                      }])
                      e.currentTarget.value = ''
                    }
                  }}
                />
                <button
                  onClick={e => {
                    const input = (e.currentTarget.previousSibling as HTMLInputElement)
                    const text = input.value.trim()
                    if (!text) return
                    const fromLesson = source === 'lesson' && (extraction?.learningObjectives ?? []).includes(text)
                    setObjectives(prev => [...prev, {
                      id: `add-${Date.now()}`,
                      text,
                      fromLesson,
                      showSource: !fromLesson,
                    }])
                    input.value = ''
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
              </div>

              {/* Warning for objectives without source */}
              {objectives.some(o => !o.fromLesson && !o.sourceMaterial?.trim()) && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <Icon name="info" size="sm" className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    Some added objectives have no source material — questions will draw on general curriculum knowledge.
                    Add source material for more accurate content.
                  </p>
                </div>
              )}

              {/* Curriculum context — SoW topic chips */}
              {sowTopics.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setSowExpanded(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Icon name="library_books" size="sm" className="text-blue-500" />
                      <span className="text-xs font-semibold text-gray-700">Curriculum context</span>
                      <span className="text-[10px] text-gray-400">({sowTopics.length} SoW topics)</span>
                    </div>
                    <Icon name={sowExpanded ? 'expand_less' : 'expand_more'} size="sm" className="text-gray-400 shrink-0" />
                  </button>
                  {sowExpanded && (
                    <div className="px-3 py-3 bg-white space-y-2">
                      <p className="text-[10px] text-gray-500">Click a topic to add it as a learning objective:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {sowTopics.map(topic => {
                          const alreadyAdded = objectives.some(o => o.text.toLowerCase() === topic.toLowerCase())
                          return (
                            <button
                              key={topic}
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => {
                                if (alreadyAdded) return
                                setObjectives(prev => [...prev, {
                                  id: `sow-${Date.now()}-${topic}`,
                                  text: topic,
                                  fromLesson: false,
                                  showSource: false,
                                }])
                              }}
                              className={`text-[10px] font-medium px-2 py-0.5 rounded border transition-colors ${
                                alreadyAdded
                                  ? 'bg-green-50 text-green-700 border-green-200 cursor-default'
                                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                              }`}
                            >
                              {alreadyAdded ? '✓ ' : '+ '}{topic}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {spacingSuggestion && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-start gap-2">
                  <Icon name="event" size="sm" className="shrink-0 mt-0.5 text-amber-600" />
                  <span>Spacing: {spacingSuggestion}</span>
                </div>
              )}
              {suggestedIlpTargets.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-1.5">
                  <p className="text-sm font-medium text-purple-800 flex items-center gap-1.5">
                    <Icon name="flag" size="sm" className="text-purple-600 shrink-0" />
                    {suggestedIlpTargets.length} ILP target{suggestedIlpTargets.length !== 1 ? 's' : ''} due within 28 days for students in this class
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
                  <Icon name="chevron_left" size="sm" /> Back
                </button>
                <button
                  onClick={async () => {
                    setStep(3)
                    setFormatInsight(null)
                    if (classId) {
                      setLoadingInsight(true)
                      try {
                        const insight = await getClassFormatInsights(classId, selectedType)
                        setFormatInsight(insight)
                      } catch { /* ignore */ }
                      finally { setLoadingInsight(false) }
                    }
                  }}
                  disabled={objectives.length === 0}
                  className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Next <Icon name="chevron_right" size="sm" />
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
                    onClick={async () => {
                      setSelectedType(t.id)
                      if (classId) {
                        setLoadingInsight(true)
                        setFormatInsight(null)
                        try {
                          const insight = await getClassFormatInsights(classId, t.id)
                          setFormatInsight(insight)
                        } catch { /* ignore */ }
                        finally { setLoadingInsight(false) }
                      }
                    }}
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

              {/* SEND format insight */}
              {loadingInsight && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Icon name="refresh" size="sm" className="animate-spin" /> Checking SEND format preferences…
                </div>
              )}
              {formatInsight && !loadingInsight && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Icon name="psychology" size="sm" className="text-violet-600 shrink-0" />
                    <p className="text-[13px] font-semibold text-violet-900">
                      SEND format insight — {formatInsight.studentCount} student{formatInsight.studentCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="text-[12px] text-violet-800 leading-relaxed">{formatInsight.rationale}</p>
                  {formatInsight.recommendedType && formatInsight.recommendedType !== selectedType && (
                    <button
                      onClick={async () => {
                        const t = formatInsight.recommendedType!
                        setSelectedType(t)
                        setFormatInsight(null)
                      }}
                      className="flex items-center gap-1 text-[11px] font-medium text-violet-700 hover:text-violet-900 underline"
                    >
                      Switch to {formatInsight.recommendedTypeLabel} →
                    </button>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                  <Icon name="chevron_left" size="sm" /> Back
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  <Icon name={loading ? 'refresh' : 'auto_awesome'} size="sm" className={loading ? 'animate-spin' : ''} />
                  {loading
                    ? genElapsed < 10 ? 'Generating…'
                    : genElapsed < 30 ? `Generating… (${genElapsed}s)`
                    : genElapsed < 60 ? `Still working… (${genElapsed}s)`
                    : `This is taking a while… (${genElapsed}s)`
                    : 'Generate content'}
                </button>
              </div>
              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <Icon name="error_outline" size="sm" color="text-red-500" className="mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-red-700">{error}</p>
                    <button onClick={handleGenerate} className="mt-1 text-xs text-red-600 hover:text-red-800 underline">
                      Retry
                    </button>
                  </div>
                </div>
              )}
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
                  <Icon name="chevron_left" size="sm" /> Back
                </button>
                <button onClick={() => setStep(5)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  Next <Icon name="chevron_right" size="sm" />
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
                  <Icon name="chevron_left" size="sm" /> Back
                </button>
                <button onClick={() => setStep(6)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  Next <Icon name="chevron_right" size="sm" />
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
                  <Icon name="chevron_left" size="sm" /> Back
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
