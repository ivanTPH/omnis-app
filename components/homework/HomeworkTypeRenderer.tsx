'use client'

import { useState } from 'react'

type Props = {
  type: string
  structuredContent?: unknown
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

type Question = {
  id: string
  question: string
  options?: string[]
  marks?: number
  hint?: string
}

export default function HomeworkTypeRenderer({ type, structuredContent, value, onChange, disabled }: Props) {
  const content = structuredContent as { questions?: Question[]; prompt?: string; wordCount?: number; steps?: string[] } | null

  // Parse stored answers for structured types
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    try { return JSON.parse(value) } catch { return {} }
  })

  function updateAnswer(id: string, answer: string) {
    const updated = { ...answers, [id]: answer }
    setAnswers(updated)
    onChange(JSON.stringify(updated))
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
          {questions.map((q, i) => (
            <div key={q.id ?? i} className="space-y-1.5">
              <p className="text-sm font-medium text-gray-800">{i + 1}. {q.question}</p>
              {q.marks && <p className="text-xs text-gray-400">[{q.marks} mark{q.marks !== 1 ? 's' : ''}]</p>}
              {q.hint && <p className="text-xs text-gray-500 italic">Hint: {q.hint}</p>}
              <textarea
                value={answers[q.id ?? i] ?? ''}
                onChange={e => updateAnswer(String(q.id ?? i), e.target.value)}
                disabled={disabled}
                placeholder="Your answer…"
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none disabled:bg-gray-50"
              />
            </div>
          ))}
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
