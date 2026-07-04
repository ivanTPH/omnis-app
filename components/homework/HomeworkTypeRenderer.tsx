'use client'

import { useState, useEffect, useRef } from 'react'
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

  // Sync answers when parent restores a draft from localStorage (value prop updates after mount)
  useEffect(() => {
    if (!value) return
    try {
      const parsed: unknown = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setAnswers(parsed as Record<string, string>)
      }
    } catch { /* plain string — not JSON-structured, used directly */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

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

      // ── Multi-question stepper (submission mode) ──────────────────────────
      if (questions.length > 1 && !disabled) {
        const q     = questions[currentQ]
        const qId   = q.id ?? String(currentQ)
        const questionText = isEhcp && q.ehcp_adaptation ? q.ehcp_adaptation : q.question
        const isLast = currentQ === questions.length - 1
        const pct    = Math.round((currentQ / questions.length) * 100)
        const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

        return (
          <div>
            {/* ── Progress bar ──────────────────────────────────────────── */}
            <div className="mb-5">
              <div className="flex items-center justify-between text-[11px] font-semibold mb-2">
                <span className="text-indigo-600">Question {currentQ + 1} of {questions.length}</span>
                <span className="text-gray-400">{pct}% complete</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {/* Dot indicators — clickable for completed questions */}
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                {questions.map((qItem, i) => {
                  const iId   = qItem.id ?? String(i)
                  const isDone = !!answers[iId]?.trim()
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (i < currentQ || isDone) { setCurrentQ(i); setHintOpen(false); setSkipWarning(false) }
                      }}
                      title={`Question ${i + 1}`}
                      className={`w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center transition-all ${
                        i === currentQ
                          ? 'bg-indigo-600 text-white scale-110 shadow-md shadow-indigo-200'
                          : isDone
                            ? 'bg-emerald-500 text-white cursor-pointer'
                            : 'bg-gray-100 text-gray-400 cursor-default'
                      }`}
                    >
                      {isDone && i !== currentQ ? <Icon name="check" size="sm" /> : i + 1}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Question card ─────────────────────────────────────────── */}
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 sm:p-6 mb-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                  Q{currentQ + 1}
                </span>
                {q.marks != null && (
                  <span className="text-[11px] font-medium text-gray-400">
                    {q.marks} mark{q.marks !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <p className="text-[15px] sm:text-[16px] font-semibold text-gray-900 leading-relaxed mb-5">
                {questionText}
              </p>

              {/* Collapsible hint */}
              {q.hint && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                  <button type="button" onClick={() => setHintOpen(v => !v)} className="flex items-center gap-2 w-full px-4 py-2.5 text-left">
                    <Icon name="lightbulb" size="sm" className="text-amber-500 shrink-0" />
                    <span className="text-xs font-semibold text-amber-700">{hintOpen ? 'Hide hint' : 'Need a hint?'}</span>
                    <Icon name={hintOpen ? 'expand_less' : 'expand_more'} size="sm" className="text-amber-400 ml-auto" />
                  </button>
                  {hintOpen && <p className="text-sm text-amber-800 px-4 pb-3 leading-relaxed">{q.hint}</p>}
                </div>
              )}

              {isSen && q.scaffolding_hint && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl mb-4">
                  <Icon name="support" size="sm" className="text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 leading-relaxed">{q.scaffolding_hint}</p>
                </div>
              )}

              {/* MCQ options — large tappable cards */}
              {q.options ? (
                <div className="space-y-2.5">
                  {q.options.map((opt, j) => {
                    const selected = answers[qId] === opt
                    return (
                      <button
                        key={j}
                        type="button"
                        onClick={() => updateAnswer(qId, opt)}
                        className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                          selected
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/30'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 text-[11px] font-bold transition-all ${
                          selected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300 text-gray-400'
                        }`}>
                          {selected ? <Icon name="check" size="sm" /> : OPTION_LETTERS[j] ?? j + 1}
                        </div>
                        <span className={`text-sm font-medium ${selected ? 'text-indigo-900' : 'text-gray-700'}`}>
                          {opt}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  value={answers[qId] ?? ''}
                  onChange={e => updateAnswer(qId, e.target.value)}
                  placeholder="Your answer…"
                  className="w-full text-sm border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-400"
                />
              )}
            </div>

            {/* ── Navigation ────────────────────────────────────────────── */}
            <div className="flex items-center gap-3">
              {currentQ > 0 ? (
                <button type="button" onClick={goToPrev} className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition shrink-0">
                  <Icon name="arrow_back" size="sm" /> Back
                </button>
              ) : <div />}

              {!isLast ? (
                <button
                  type="button"
                  onClick={() => goToNext(questions)}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition"
                >
                  Next question <Icon name="arrow_forward" size="sm" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSubmitRequest}
                  disabled={!onSubmitRequest || submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold rounded-xl hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {submitting
                    ? <><Icon name="refresh" size="sm" className="animate-spin" /> Submitting…</>
                    : <><Icon name="send" size="sm" /> Submit homework</>
                  }
                </button>
              )}
            </div>

            {skipWarning && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2">
                <Icon name="warning" size="sm" className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Select an answer first</p>
                  <button type="button" onClick={() => { setSkipWarning(false); setCurrentQ(q => q + 1); setHintOpen(false) }} className="text-xs text-amber-600 underline mt-0.5">
                    Skip this question
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      }

      // ── All-questions view (single question or submitted/disabled state) ───
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
        const pct = Math.round((currentQ / questions.length) * 100)

        return (
          <div>
            {/* ── Progress bar ──────────────────────────────────────────── */}
            <div className="mb-5">
              <div className="flex items-center justify-between text-[11px] font-semibold mb-2">
                <span className="text-indigo-600">Question {currentQ + 1} of {questions.length}</span>
                <span className="text-gray-400">{pct}% complete</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {/* Dot indicators */}
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                {questions.map((qItem, i) => {
                  const iId = qItem.id ?? String(i)
                  const isDone = !!answers[iId]?.trim()
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (i < currentQ || isDone) { setCurrentQ(i); setHintOpen(false); setSkipWarning(false) }
                      }}
                      title={`Question ${i + 1}`}
                      className={`w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center transition-all ${
                        i === currentQ
                          ? 'bg-indigo-600 text-white scale-110 shadow-md shadow-indigo-200'
                          : isDone
                            ? 'bg-emerald-500 text-white cursor-pointer'
                            : 'bg-gray-100 text-gray-400 cursor-default'
                      }`}
                    >
                      {isDone && i !== currentQ ? <Icon name="check" size="sm" /> : i + 1}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Question card ─────────────────────────────────────────── */}
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 sm:p-6 mb-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                  Q{currentQ + 1}
                </span>
                {q.marks != null && (
                  <span className="text-[11px] font-medium text-gray-400">
                    {q.marks} mark{q.marks !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <p className="text-[15px] sm:text-[16px] font-semibold text-gray-900 leading-relaxed mb-5">
                {questionText}
              </p>

              {/* Collapsible hint */}
              {q.hint && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                  <button type="button" onClick={() => setHintOpen(v => !v)} className="flex items-center gap-2 w-full px-4 py-2.5 text-left">
                    <Icon name="lightbulb" size="sm" className="text-amber-500 shrink-0" />
                    <span className="text-xs font-semibold text-amber-700">{hintOpen ? 'Hide hint' : 'Need a hint?'}</span>
                    <Icon name={hintOpen ? 'expand_less' : 'expand_more'} size="sm" className="text-amber-400 ml-auto" />
                  </button>
                  {hintOpen && <p className="text-sm text-amber-800 px-4 pb-3 leading-relaxed">{q.hint}</p>}
                </div>
              )}

              {/* SEND: scaffolding hint */}
              {isSen && q.scaffolding_hint && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl mb-4">
                  <Icon name="support" size="sm" className="text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700 leading-relaxed">{q.scaffolding_hint}</p>
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
                <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2 block">
                  Your Answer
                </label>
                <textarea
                  value={answers[qId] ?? ''}
                  onChange={e => updateAnswer(qId, e.target.value)}
                  placeholder={getAnswerPlaceholder(q)}
                  rows={5}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-800 resize-y focus:outline-none focus:border-indigo-400 leading-relaxed transition"
                />
                <p className="text-[11px] text-gray-400 mt-1 text-right">
                  {wordCount} word{wordCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* ── Navigation ────────────────────────────────────────────── */}
            <div className="flex items-center gap-3">
              {currentQ > 0 ? (
                <button type="button" onClick={goToPrev} className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition shrink-0">
                  <Icon name="arrow_back" size="sm" /> Back
                </button>
              ) : <div />}

              {!isLast ? (
                <button
                  type="button"
                  onClick={() => goToNext(questions)}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition"
                >
                  Next question <Icon name="arrow_forward" size="sm" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSubmitRequest}
                  disabled={!onSubmitRequest || submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold rounded-xl hover:from-indigo-700 hover:to-violet-700 shadow-sm shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2">
                <Icon name="warning" size="sm" className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Answer this question first</p>
                  <button
                    type="button"
                    onClick={() => { setSkipWarning(false); setCurrentQ(q => q + 1); setHintOpen(false) }}
                    className="text-xs text-amber-600 underline mt-0.5"
                  >
                    Skip this question
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
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const fileRef = useRef<HTMLInputElement>(null)
      // Parse the stored value — either a plain text description or JSON {text, fileName, dataUrl}
      let storedText = value
      let storedFileName: string | null = null
      try {
        const parsed = JSON.parse(value)
        if (parsed && typeof parsed === 'object' && 'dataUrl' in parsed) {
          storedText    = parsed.text ?? ''
          storedFileName = parsed.fileName ?? null
        }
      } catch { /* plain text value */ }

      function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0]
        if (!f) return
        const reader = new FileReader()
        reader.onload = () => {
          // Store as JSON so both the file and the text description travel together
          onChange(JSON.stringify({ text: storedText, fileName: f.name, dataUrl: reader.result as string }))
        }
        reader.readAsDataURL(f)
      }

      function handleTextChange(text: string) {
        if (storedFileName) {
          // Re-parse to keep the dataUrl intact
          try {
            const parsed = JSON.parse(value)
            onChange(JSON.stringify({ ...parsed, text }))
            return
          } catch { /* fall through */ }
        }
        onChange(text)
      }

      return (
        <div className="space-y-3">
          {content?.prompt && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900">
              {content.prompt}
            </div>
          )}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center space-y-2 transition-colors ${disabled ? 'border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-blue-300 cursor-pointer'}`}
            onClick={() => !disabled && fileRef.current?.click()}
          >
            {storedFileName ? (
              <>
                <Icon name="attach_file" size="md" className="text-green-500 mx-auto" />
                <p className="text-sm font-medium text-green-700">{storedFileName}</p>
                {!disabled && <p className="text-xs text-gray-400">Click to replace</p>}
              </>
            ) : (
              <>
                <Icon name="upload" size="md" className="text-gray-400 mx-auto" />
                <p className="text-sm text-gray-500">
                  {type === 'mind_map' && 'Photograph your mind map and upload below.'}
                  {type === 'diagram' && 'Photograph your diagram and upload below.'}
                  {type === 'upload' && 'Click to upload your completed work.'}
                </p>
                {!disabled && <p className="text-xs text-gray-400">JPG, PNG, PDF accepted</p>}
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              className="hidden"
              disabled={disabled}
              onChange={handleFileChange}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Add a written description (optional)</label>
            <textarea
              value={storedText}
              onChange={e => handleTextChange(e.target.value)}
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
