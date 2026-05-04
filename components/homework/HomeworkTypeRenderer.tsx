'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'

type Props = {
  type: string
  structuredContent?: unknown
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  sendStatus?: string    // 'NONE' | 'SEN_SUPPORT' | 'EHCP'
  showScaffold?: boolean // legacy — treated as SEN_SUPPORT if sendStatus not provided
  onSubmitRequest?: () => void
  submitting?: boolean
}

type VocabEntry = { term: string; definition: string }

type Question = {
  id: string
  question: string
  options?: string[]
  marks?: number
  hint?: string
  scaffolding_hint?: string
  ehcp_adaptation?: string
  vocab_support?: VocabEntry[]
}

function VocabGlossary({ terms }: { terms: VocabEntry[] }) {
  const [open, setOpen] = useState(false)
  if (!terms || terms.length === 0) return null
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900"
      >
        <span className="text-[10px]">{open ? '▾' : '▸'}</span>
        Key vocabulary ({terms.length} terms)
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-purple-200 bg-purple-50 divide-y divide-purple-100">
          {terms.map((v, i) => (
            <div key={i} className="flex gap-2 px-3 py-1.5">
              <span className="text-xs font-semibold text-purple-800 shrink-0 min-w-[110px]">{v.term}</span>
              <span className="text-xs text-purple-700">{v.definition}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function getAnswerPlaceholder(question: Question): string {
  const marks = question.marks ?? 0
  if (marks <= 2) return 'Write a short answer...'
  if (marks <= 4) return 'Identify and explain your points clearly. Use specific examples...'
  if (marks <= 6) return 'Write a structured explanation. Include: a clear point, evidence to support it, and analysis of why this is significant...'
  return 'Write a balanced argument. Include points on both sides, use specific evidence, and reach a clear conclusion that answers the question directly...'
}

export default function HomeworkTypeRenderer({
  type, structuredContent, value, onChange, disabled,
  sendStatus, showScaffold, onSubmitRequest, submitting,
}: Props) {
  const content = structuredContent as { questions?: Question[]; prompt?: string; wordCount?: number; steps?: string[] } | null

  // Resolve effective SEND level
  const effectiveSend = sendStatus ?? (showScaffold ? 'SEN_SUPPORT' : 'NONE')
  const isEhcp    = effectiveSend === 'EHCP'
  const isSen     = effectiveSend === 'SEN_SUPPORT'

  // Parse stored answers for structured types
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    try { return JSON.parse(value) } catch { return {} }
  })
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({})

  // Stepper state (used only in multi-question short_answer mode)
  const [currentQ,    setCurrentQ]    = useState(0)
  const [hintOpen,    setHintOpen]    = useState(false)
  const [skipWarning, setSkipWarning] = useState(false)

  function updateAnswer(id: string, answer: string) {
    const updated = { ...answers, [id]: answer }
    setAnswers(updated)
    onChange(JSON.stringify(updated))
  }

  function toggleOriginal(id: string) {
    setShowOriginal(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function goToNext(questions: Question[]) {
    const qId = questions[currentQ]?.id ?? String(currentQ)
    if (!answers[qId]?.trim()) { setSkipWarning(true); return }
    setCurrentQ(q => q + 1)
    setHintOpen(false)
    setSkipWarning(false)
  }

  function goToPrev() {
    setCurrentQ(q => q - 1)
    setHintOpen(false)
    setSkipWarning(false)
  }

  switch (type) {
    case 'multiple_choice':
    case 'quiz': {
      const questions = content?.questions ?? []
      return (
        <div className="space-y-6">
          {questions.map((q, i) => {
            const qId = q.id ?? String(i)
            const questionText = isEhcp && q.ehcp_adaptation ? q.ehcp_adaptation : q.question
            return (
              <div key={qId} className="space-y-2">
                <p className="text-sm font-medium text-gray-800">{i + 1}. {questionText}</p>
                {isEhcp && q.ehcp_adaptation && q.ehcp_adaptation !== q.question && (
                  <p className="text-[11px] text-purple-500 italic">Simplified for accessibility</p>
                )}
                {q.hint && <p className="text-xs text-gray-500 italic">Hint: {q.hint}</p>}
                {isSen && q.scaffolding_hint && (
                  <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-[10px] font-bold text-blue-600 shrink-0 mt-0.5">HINT</span>
                    <p className="text-xs text-blue-700">{q.scaffolding_hint}</p>
                  </div>
                )}
                {isEhcp && q.vocab_support && q.vocab_support.length > 0 && (
                  <VocabGlossary terms={q.vocab_support} />
                )}
                {q.options ? (
                  <div className="space-y-1.5">
                    {q.options.map((opt, j) => (
                      <label key={j} className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`q-${qId}`}
                          value={opt}
                          checked={answers[qId] === opt}
                          onChange={() => updateAnswer(qId, opt)}
                          disabled={disabled}
                          className="mt-0.5"
                        />
                        <span className="text-sm text-gray-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={answers[qId] ?? ''}
                    onChange={e => updateAnswer(qId, e.target.value)}
                    disabled={disabled}
                    placeholder="Your answer…"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 disabled:bg-gray-50"
                  />
                )}
                {q.marks && <p className="text-xs text-gray-400">[{q.marks} mark{q.marks !== 1 ? 's' : ''}]</p>}
              </div>
            )
          })}
        </div>
      )
    }

    case 'short_answer':
    case 'SHORT_ANSWER':
    case 'retrieval_practice': {
      const questions = content?.questions ?? []
      if (questions.length === 0) {
        return (
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            placeholder="Write your answer here…"
            rows={6}
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none disabled:bg-gray-50"
          />
        )
      }

      // ── Multi-question stepper (student submission mode only) ──────────────
      if (questions.length > 1 && !disabled) {
        const q = questions[currentQ]
        const qId = q.id ?? String(currentQ)
        const questionText = isEhcp && q.ehcp_adaptation ? q.ehcp_adaptation : q.question
        const wordCount = (answers[qId] ?? '').trim().split(/\s+/).filter(Boolean).length
        const isLast = currentQ === questions.length - 1

        return (
          <div>
            {/* Progress indicator */}
            <div className="flex items-center gap-1 mb-6 flex-wrap">
              {questions.map((qItem, i) => {
                const iId = qItem.id ?? String(i)
                const isDone = !!answers[iId]?.trim() && i < currentQ
                return (
                  <div key={i} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (i < currentQ) { setCurrentQ(i); setHintOpen(false); setSkipWarning(false) }
                      }}
                      className={`w-8 h-8 rounded-full text-sm font-semibold transition-all flex items-center justify-center ${
                        i === currentQ
                          ? 'bg-blue-700 text-white ring-2 ring-blue-700 ring-offset-2'
                          : i < currentQ
                            ? 'bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-400 cursor-default'
                      }`}
                    >
                      {isDone
                        ? <Icon name="check" size="sm" />
                        : i + 1
                      }
                    </button>
                    {i < questions.length - 1 && (
                      <div className={`h-0.5 w-6 mx-1 transition-colors ${i < currentQ ? 'bg-blue-300' : 'bg-gray-200'}`} />
                    )}
                  </div>
                )
              })}
              <span className="text-[11px] text-gray-400 ml-2">
                Question {currentQ + 1} of {questions.length}
              </span>
            </div>

            {/* Question card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-start justify-between gap-4 mb-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Question {currentQ + 1}
                </p>
                {q.marks != null && (
                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-lg shrink-0">
                    [{q.marks} mark{q.marks !== 1 ? 's' : ''}]
                  </span>
                )}
              </div>

              <p className="text-[14px] font-medium text-gray-900 leading-relaxed mb-4">
                {questionText}
              </p>

              {/* Collapsible hint */}
              {q.hint && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setHintOpen(v => !v)}
                    className="flex items-center gap-2 w-full text-left"
                  >
                    <Icon name="lightbulb" size="sm" className="text-amber-600 shrink-0" />
                    <span className="text-xs font-medium text-amber-700">
                      {hintOpen ? 'Hide hint' : 'Show hint'}
                    </span>
                  </button>
                  {hintOpen && (
                    <p className="text-sm text-amber-800 mt-2 leading-relaxed">{q.hint}</p>
                  )}
                </div>
              )}

              {/* SEND: scaffolding hint */}
              {isSen && q.scaffolding_hint && (
                <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                  <span className="text-[10px] font-bold text-blue-600 shrink-0 mt-0.5">HINT</span>
                  <p className="text-xs text-blue-700">{q.scaffolding_hint}</p>
                </div>
              )}

              {/* EHCP: vocab + toggle */}
              {isEhcp && (
                <>
                  {q.vocab_support && q.vocab_support.length > 0 && (
                    <div className="mb-4"><VocabGlossary terms={q.vocab_support} /></div>
                  )}
                  {q.ehcp_adaptation && (
                    <button
                      type="button"
                      onClick={() => toggleOriginal(qId)}
                      className="text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2 mb-3"
                    >
                      {showOriginal[qId] ? 'Show simplified question' : 'Show original question'}
                    </button>
                  )}
                  {showOriginal[qId] && (
                    <p className="text-sm text-gray-600 italic mb-4">{q.question}</p>
                  )}
                </>
              )}

              {/* Answer textarea */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">
                  Your Answer
                </label>
                <textarea
                  value={answers[qId] ?? ''}
                  onChange={e => updateAnswer(qId, e.target.value)}
                  placeholder={getAnswerPlaceholder(q)}
                  rows={6}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-[14px] text-gray-800 resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 leading-relaxed"
                />
                <p className="text-[11px] text-gray-400 mt-1 text-right">
                  {wordCount} word{wordCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              {currentQ > 0 ? (
                <button
                  type="button"
                  onClick={goToPrev}
                  className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm"
                >
                  <Icon name="arrow_back" size="sm" />
                  Previous
                </button>
              ) : <div />}

              {!isLast ? (
                <button
                  type="button"
                  onClick={() => goToNext(questions)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 transition"
                >
                  Next question
                  <Icon name="arrow_forward" size="sm" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSubmitRequest}
                  disabled={!onSubmitRequest || submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {submitting
                    ? <><Icon name="refresh" size="sm" className="animate-spin" /> Submitting…</>
                    : <><Icon name="send" size="sm" /> Submit homework</>
                  }
                </button>
              )}
            </div>

            {/* Skip warning */}
            {skipWarning && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <Icon name="warning" size="sm" className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-amber-800">You haven&apos;t answered this question yet.</p>
                  <button
                    type="button"
                    onClick={() => { setSkipWarning(false); setCurrentQ(q => q + 1); setHintOpen(false) }}
                    className="text-xs text-amber-700 underline mt-1"
                  >
                    Skip anyway
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      }

      // ── All-questions view (single question, or disabled/submitted state) ──
      return (
        <div className="space-y-5">
          {questions.map((q, i) => {
            const qId = q.id ?? String(i)
            const questionText = isEhcp && q.ehcp_adaptation ? q.ehcp_adaptation : q.question
            const isShowingOriginal = showOriginal[qId]

            return (
              <div key={qId} className="space-y-1.5">
                {isEhcp && q.ehcp_adaptation && isShowingOriginal ? (
                  <p className="text-sm font-medium text-gray-800">{i + 1}. {q.question}</p>
                ) : (
                  <p className="text-sm font-medium text-gray-800">{i + 1}. {questionText}</p>
                )}

                {q.marks && <p className="text-xs text-gray-400">[{q.marks} mark{q.marks !== 1 ? 's' : ''}]</p>}
                {q.hint && <p className="text-xs text-gray-500 italic">Hint: {q.hint}</p>}

                {isEhcp && (
                  <>
                    {q.vocab_support && q.vocab_support.length > 0 && (
                      <VocabGlossary terms={q.vocab_support} />
                    )}
                    {q.ehcp_adaptation && (
                      <button
                        type="button"
                        onClick={() => toggleOriginal(qId)}
                        className="text-[11px] text-gray-400 hover:text-gray-600 underline underline-offset-2"
                      >
                        {isShowingOriginal ? 'Show simplified question' : 'Show original question'}
                      </button>
                    )}
                  </>
                )}

                {isSen && q.scaffolding_hint && (
                  <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-[10px] font-bold text-blue-600 shrink-0 mt-0.5">HINT</span>
                    <p className="text-xs text-blue-700">{q.scaffolding_hint}</p>
                  </div>
                )}

                <textarea
                  value={answers[qId] ?? ''}
                  onChange={e => updateAnswer(qId, e.target.value)}
                  disabled={disabled}
                  placeholder="Your answer…"
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none disabled:bg-gray-50"
                />
              </div>
            )
          })}
        </div>
      )
    }

    case 'essay':
    case 'extended_writing':
    case 'free_text':
    case 'creative_writing': {
      const wordCount = content?.wordCount
      const prompt = content?.prompt
      const firstQ = content?.questions?.[0]
      const essayScaffold = isSen && firstQ?.scaffolding_hint ? firstQ.scaffolding_hint : null
      const essayVocab = isEhcp && firstQ?.vocab_support?.length ? firstQ.vocab_support : null
      return (
        <div className="space-y-3">
          {prompt && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900">
              {prompt}
            </div>
          )}
          {essayScaffold && (
            <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-[10px] font-bold text-blue-600 shrink-0 mt-0.5">HINT</span>
              <p className="text-xs text-blue-700">{essayScaffold}</p>
            </div>
          )}
          {essayVocab && <VocabGlossary terms={essayVocab} />}
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            placeholder="Write your response here…"
            rows={12}
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none disabled:bg-gray-50 leading-relaxed"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>{value.trim().split(/\s+/).filter(Boolean).length} words</span>
            {wordCount && <span>Target: ~{wordCount} words</span>}
          </div>
        </div>
      )
    }

    case 'structured_task':
    case 'problem_solving': {
      const steps = content?.steps ?? []
      const questions = content?.questions ?? []
      return (
        <div className="space-y-4">
          {steps.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase">Steps to follow</p>
              <ol className="space-y-1">
                {steps.map((step, i) => (
                  <li key={i} className="text-sm text-gray-700">{i + 1}. {step}</li>
                ))}
              </ol>
            </div>
          )}
          {questions.length > 0 ? (
            questions.map((q, i) => (
              <div key={q.id ?? i} className="space-y-1.5">
                <p className="text-sm font-medium text-gray-800">{i + 1}. {q.question}</p>
                <textarea
                  value={answers[q.id ?? i] ?? ''}
                  onChange={e => updateAnswer(String(q.id ?? i), e.target.value)}
                  disabled={disabled}
                  rows={4}
                  placeholder="Your answer…"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none disabled:bg-gray-50"
                />
              </div>
            ))
          ) : (
            <textarea
              value={value}
              onChange={e => onChange(e.target.value)}
              disabled={disabled}
              rows={10}
              placeholder="Complete the task here…"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none disabled:bg-gray-50"
            />
          )}
        </div>
      )
    }

    case 'mind_map':
    case 'diagram':
    case 'upload': {
      return (
        <div className="space-y-3">
          {content?.prompt && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900">
              {content.prompt}
            </div>
          )}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center space-y-2">
            <p className="text-sm text-gray-500">
              {type === 'mind_map' && 'Draw or photograph your mind map and upload below.'}
              {type === 'diagram' && 'Draw or photograph your diagram and upload below.'}
              {type === 'upload' && 'Upload your completed work below.'}
            </p>
            <input type="file" className="text-sm" disabled={disabled} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Add a written description (optional)</label>
            <textarea
              value={value}
              onChange={e => onChange(e.target.value)}
              disabled={disabled}
              rows={3}
              placeholder="Describe your work…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none disabled:bg-gray-50"
            />
          </div>
        </div>
      )
    }

    default:
      return (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Write your response here…"
          rows={8}
          className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none disabled:bg-gray-50"
        />
      )
  }
}
