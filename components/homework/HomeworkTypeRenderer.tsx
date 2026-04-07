'use client'

import { useState } from 'react'

type Props = {
  type: string
  structuredContent?: unknown
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  sendStatus?: string   // 'NONE' | 'SEN_SUPPORT' | 'EHCP'
  showScaffold?: boolean // legacy — treated as SEN_SUPPORT if sendStatus not provided
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

export default function HomeworkTypeRenderer({ type, structuredContent, value, onChange, disabled, sendStatus, showScaffold }: Props) {
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

  function updateAnswer(id: string, answer: string) {
    const updated = { ...answers, [id]: answer }
    setAnswers(updated)
    onChange(JSON.stringify(updated))
  }

  function toggleOriginal(id: string) {
    setShowOriginal(prev => ({ ...prev, [id]: !prev[id] }))
  }

  switch (type) {
    case 'multiple_choice':
    case 'quiz': {
      const questions = content?.questions ?? []
      return (
        <div className="space-y-6">
          {questions.map((q, i) => (
            <div key={q.id ?? i} className="space-y-2">
              <p className="text-sm font-medium text-gray-800">{i + 1}. {q.question}</p>
              {q.hint && <p className="text-xs text-gray-500 italic">Hint: {q.hint}</p>}
              {q.options ? (
                <div className="space-y-1.5">
                  {q.options.map((opt, j) => (
                    <label key={j} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`q-${q.id ?? i}`}
                        value={opt}
                        checked={answers[q.id ?? i] === opt}
                        onChange={() => updateAnswer(String(q.id ?? i), opt)}
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
                  value={answers[q.id ?? i] ?? ''}
                  onChange={e => updateAnswer(String(q.id ?? i), e.target.value)}
                  disabled={disabled}
                  placeholder="Your answer…"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 disabled:bg-gray-50"
                />
              )}
              {q.marks && <p className="text-xs text-gray-400">[{q.marks} mark{q.marks !== 1 ? 's' : ''}]</p>}
            </div>
          ))}
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
      return (
        <div className="space-y-5">
          {questions.map((q, i) => {
            const qId = q.id ?? String(i)
            // For EHCP: show adapted question text; for others: standard question
            const questionText = isEhcp && q.ehcp_adaptation ? q.ehcp_adaptation : q.question
            const isShowingOriginal = showOriginal[qId]

            return (
              <div key={qId} className="space-y-1.5">
                {/* Question text */}
                {isEhcp && q.ehcp_adaptation && isShowingOriginal ? (
                  <p className="text-sm font-medium text-gray-800">{i + 1}. {q.question}</p>
                ) : (
                  <p className="text-sm font-medium text-gray-800">{i + 1}. {questionText}</p>
                )}

                {q.marks && <p className="text-xs text-gray-400">[{q.marks} mark{q.marks !== 1 ? 's' : ''}]</p>}
                {q.hint && <p className="text-xs text-gray-500 italic">Hint: {q.hint}</p>}

                {/* EHCP: vocab glossary + show original toggle */}
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

                {/* SEN Support: scaffolding hint in blue box */}
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
      return (
        <div className="space-y-3">
          {prompt && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900">
              {prompt}
            </div>
          )}
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
