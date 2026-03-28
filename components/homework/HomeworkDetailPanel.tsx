'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import { getHomeworkDetail, type HomeworkDetail } from '@/app/actions/homework'

type Props = {
  homeworkId: string
  title:      string
  onClose:    () => void
}

type SCQuestion = {
  id?:              string | number
  question?:        string
  prompt?:          string
  options?:         string[]
  marks?:           number
  hint?:            string
  scaffolding_hint?: string
  answer?:          string
  model_answer?:    string
  correct_answer?:  string
}

type StructuredContent = {
  questions?: SCQuestion[]
  prompt?:    string
  wordCount?: number
  steps?:     string[]
}

function QJQuestion({ q, i }: { q: Record<string, unknown>; i: number }) {
  const prompt  = (q.prompt ?? q.question ?? q.q ?? '') as string
  const answer  = (q.answer ?? q.model_answer ?? q.correct_answer ?? q.markScheme ?? '') as string
  const marks   = (q.marks ?? q.maxScore ?? null) as number | null
  const ms      = (q.markScheme ?? '') as string

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <p className="text-[13px] font-medium text-gray-900">{i + 1}. {prompt}</p>
        {marks != null && (
          <span className="text-[10px] text-gray-400 mt-0.5">[{marks} mark{marks !== 1 ? 's' : ''}]</span>
        )}
      </div>
      {(answer || ms) && (
        <div className="px-4 py-3 bg-green-50 border-b border-green-100">
          <p className="text-[10px] font-bold uppercase tracking-wide text-green-600 mb-1">Model answer</p>
          <p className="text-[12px] text-green-900 leading-snug">{answer || ms}</p>
        </div>
      )}
    </div>
  )
}

function SCQuestionCard({ q, i }: { q: SCQuestion; i: number }) {
  const prompt  = q.question ?? q.prompt ?? ''
  const answer  = q.answer ?? q.model_answer ?? q.correct_answer ?? ''
  const marks   = q.marks ?? null
  const hasSend = !!(q.scaffolding_hint)

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <p className="text-[13px] font-medium text-gray-900">{i + 1}. {prompt}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {marks != null && (
            <span className="text-[10px] text-gray-400">[{marks} mark{marks !== 1 ? 's' : ''}]</span>
          )}
          {hasSend && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">SEND scaffold</span>
          )}
        </div>
      </div>

      {/* MCQ options */}
      {q.options && q.options.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Options</p>
          <ul className="space-y-1">
            {q.options.map((opt, j) => (
              <li key={j} className={`text-[12px] flex items-center gap-2 ${opt === answer ? 'text-green-700 font-semibold' : 'text-gray-600'}`}>
                {opt === answer && <Icon name="check_circle" size="sm" className="text-green-500 shrink-0" />}
                {opt !== answer && <span className="w-3" />}
                {opt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Model answer for non-MCQ */}
      {answer && !q.options && (
        <div className="px-4 py-3 bg-green-50 border-b border-green-100">
          <p className="text-[10px] font-bold uppercase tracking-wide text-green-600 mb-1">Model answer</p>
          <p className="text-[12px] text-green-900 leading-snug">{answer}</p>
        </div>
      )}

      {/* SEND scaffolding hint */}
      {q.scaffolding_hint && (
        <div className="px-4 py-2.5 bg-purple-50">
          <p className="text-[10px] font-bold uppercase tracking-wide text-purple-600 mb-1 flex items-center gap-1">
            <Icon name="psychology" size="sm" /> SEND scaffolding hint (shown to eligible students only)
          </p>
          <p className="text-[12px] text-purple-900 italic">{q.scaffolding_hint}</p>
        </div>
      )}
    </div>
  )
}

export default function HomeworkDetailPanel({ homeworkId, title, onClose }: Props) {
  const [hw,      setHw]      = useState<HomeworkDetail>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getHomeworkDetail(homeworkId)
        if (!cancelled) setHw(data)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [homeworkId])

  // Parse questionsJson (flat [{prompt, answer, marks}] format)
  const qJson: Record<string, unknown>[] = (() => {
    if (!hw?.questionsJson) return []
    try {
      const raw = hw.questionsJson as unknown
      if (Array.isArray(raw)) return raw as Record<string, unknown>[]
      if (typeof raw === 'object' && raw !== null && 'questions' in raw) {
        const inner = (raw as { questions?: unknown }).questions
        if (Array.isArray(inner)) return inner as Record<string, unknown>[]
      }
    } catch { /* ignore */ }
    return []
  })()

  // Parse structuredContent questions
  const sc = hw?.structuredContent as StructuredContent | null | undefined
  const scQuestions: SCQuestion[] = sc?.questions ?? []

  // Grading bands
  const bands = hw?.gradingBands as Record<string, string> | null | undefined

  // HomeworkQuestion relation rows (normalized)
  const hqRows = hw?.questions ?? []

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="w-[540px] max-w-full bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-100">
              <Icon name="visibility" size="sm" className="text-blue-700" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-900 leading-tight">{title}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Teacher view — students do not see model answers</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 transition-colors">
            <Icon name="close" size="sm" className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading && (
            <div className="flex items-center gap-2 text-[12px] text-gray-400 py-8 justify-center">
              <Icon name="refresh" size="sm" className="animate-spin" /> Loading homework detail…
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-[12px] text-rose-600 py-8 justify-center">
              <Icon name="error" size="sm" /> Could not load homework detail.
            </div>
          )}

          {hw && !loading && (
            <>
              {/* Meta */}
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {hw.type.replace(/_/g, ' ')}
                </span>
                {hw.homeworkVariantType && hw.homeworkVariantType !== hw.type && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {hw.homeworkVariantType.replace(/_/g, ' ')}
                  </span>
                )}
                {hw.isAdapted && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    SEND adapted
                  </span>
                )}
              </div>

              {/* Instructions */}
              {hw.instructions && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Instructions</p>
                  <p className="text-[13px] text-gray-800 leading-relaxed">{hw.instructions}</p>
                </div>
              )}

              {/* Differentiation notes */}
              {hw.differentiationNotes && (
                <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                  <Icon name="psychology" size="sm" className="text-purple-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-purple-600 mb-1">SEND / differentiation notes</p>
                    <p className="text-[12px] text-purple-900 leading-snug">{hw.differentiationNotes}</p>
                  </div>
                </div>
              )}

              {/* Questions from structuredContent (richest source — has scaffold hints) */}
              {scQuestions.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1">
                    <Icon name="menu_book" size="sm" /> Questions &amp; model answers
                  </p>
                  <div className="space-y-3">
                    {scQuestions.map((q, i) => (
                      <SCQuestionCard key={q.id ?? i} q={q} i={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback: questionsJson flat array */}
              {scQuestions.length === 0 && qJson.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1">
                    <Icon name="menu_book" size="sm" /> Questions &amp; model answers
                  </p>
                  <div className="space-y-3">
                    {qJson.map((q, i) => (
                      <QJQuestion key={i} q={q} i={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback: HomeworkQuestion rows */}
              {scQuestions.length === 0 && qJson.length === 0 && hqRows.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1">
                    <Icon name="menu_book" size="sm" /> Questions &amp; mark scheme
                  </p>
                  <div className="space-y-3">
                    {hqRows.map((q, i) => {
                      const opts    = q.optionsJson as string[] | null
                      const correct = q.correctAnswerJson as string | string[] | null
                      const rubric  = q.rubricJson as Record<string, string> | null
                      return (
                        <div key={q.id} className="border border-gray-100 rounded-xl overflow-hidden">
                          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                            <p className="text-[13px] font-medium text-gray-900">{i + 1}. {q.prompt}</p>
                            <span className="text-[10px] text-gray-400">[{q.maxScore} mark{q.maxScore !== 1 ? 's' : ''}]</span>
                          </div>
                          {opts && opts.length > 0 && (
                            <div className="px-4 py-2 border-b border-gray-100">
                              <ul className="space-y-1">
                                {opts.map((opt, j) => {
                                  const isCorrect = Array.isArray(correct) ? correct.includes(opt) : correct === opt
                                  return (
                                    <li key={j} className={`text-[12px] flex items-center gap-2 ${isCorrect ? 'text-green-700 font-semibold' : 'text-gray-600'}`}>
                                      {isCorrect ? <Icon name="check_circle" size="sm" className="text-green-500 shrink-0" /> : <span className="w-3" />}
                                      {opt}
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          )}
                          {!opts && correct && (
                            <div className="px-4 py-3 bg-green-50">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-green-600 mb-1">Model answer</p>
                              <p className="text-[12px] text-green-900">{Array.isArray(correct) ? correct.join(', ') : correct}</p>
                            </div>
                          )}
                          {rubric && (
                            <div className="px-4 py-2 bg-amber-50">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600 mb-1">Rubric</p>
                              {Object.entries(rubric).map(([k, v]) => (
                                <p key={k} className="text-[12px] text-amber-900">{k}: {v}</p>
                              ))}
                            </div>
                          )}
                          {q.explanationText && (
                            <div className="px-4 py-2 bg-gray-50">
                              <p className="text-[12px] text-gray-600 italic">{q.explanationText}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Model answer (extended writing) */}
              {hw.modelAnswer && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Model answer</p>
                  <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <p className="text-[13px] text-green-900 leading-relaxed whitespace-pre-wrap">{hw.modelAnswer}</p>
                  </div>
                </div>
              )}

              {/* Grading bands / mark scheme */}
              {bands && Object.keys(bands).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Mark scheme / grading bands</p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {Object.entries(bands)
                      .sort(([a], [b]) => Number(b) - Number(a))
                      .map(([score, desc]) => (
                        <div key={score} className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
                          <span className="text-[11px] font-bold text-gray-700 w-12 shrink-0">{score} mk{Number(score) !== 1 ? 's' : ''}</span>
                          <p className="text-[12px] text-gray-600">{desc}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Nothing to show */}
              {scQuestions.length === 0 && qJson.length === 0 && hqRows.length === 0 && !hw.modelAnswer && !bands && (
                <div className="text-center py-8 text-[12px] text-gray-400 italic">
                  No question detail stored for this homework.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
