'use client'

import { useState, useEffect, useCallback } from 'react'
import Icon from '@/components/ui/Icon'
import { startTestSession, submitTestAnswer } from '@/app/actions/revision-program'
import type { TestQuestion, TestResults } from '@/lib/revision/test-engine'

// ── Types ─────────────────────────────────────────────────────────────────────

type TestState =
  | { status: 'starting' }
  | { status: 'question'; sessionId: string; question: TestQuestion; number: number; total: number }
  | { status: 'submitting'; sessionId: string; question: TestQuestion; number: number; total: number }
  | { status: 'results'; results: TestResults; previousSessionId: string }
  | { status: 'error'; message: string }

type Props = {
  taskId:  string
  onDone:  (percentage: number) => void
}

const TYPE_LABELS: Record<string, string> = {
  mcq:       'Multiple Choice',
  written:   'Written Answer',
  fill_blank: 'Fill in the Blank',
  matching:  'Matching',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MCQQuestion({
  question, value, onChange,
}: {
  question: TestQuestion; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2.5">
      {question.options?.map((opt, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(String(i))}
          className={`w-full text-left px-4 py-3 border rounded-xl text-sm transition-colors ${
            value === String(i)
              ? 'border-blue-500 bg-blue-50 text-blue-900'
              : 'border-gray-200 hover:border-gray-300 text-gray-800'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function WrittenQuestion({
  value, onChange,
}: {
  value: string; onChange: (v: string) => void
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={5}
      placeholder="Write your answer here…"
      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
    />
  )
}

function FillBlankQuestion({
  question, value, onChange,
}: {
  question: TestQuestion; value: string; onChange: (v: string) => void
}) {
  const parts = (question.sentence ?? '').split('___')
  return (
    <p className="text-sm text-gray-800 leading-loose">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <input
              type="text"
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder="…"
              className="inline-block border-b-2 border-blue-400 bg-transparent focus:outline-none px-1 mx-1 text-blue-700 font-medium min-w-[80px] max-w-[200px] text-sm"
            />
          )}
        </span>
      ))}
    </p>
  )
}

function MatchingQuestion({
  question,
  matches,
  onMatch,
  onUnmatch,
}: {
  question:  TestQuestion
  matches:   Record<string, string>
  onMatch:   (term: string, definition: string) => void
  onUnmatch: (term: string) => void
}) {
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null)
  const pairs = question.pairs ?? []

  // Shuffle definitions once per question mount
  const [shuffledDefs] = useState<string[]>(
    () => [...pairs.map(p => p.definition)].sort(() => Math.random() - 0.5),
  )

  const matchedDefs = new Set(Object.values(matches))

  function handleTermClick(term: string) {
    if (term in matches) {
      // Re-select a matched term to change its pairing
      onUnmatch(term)
      setSelectedTerm(term)
    } else {
      setSelectedTerm(prev => prev === term ? null : term)
    }
  }

  function handleDefClick(def: string) {
    if (!selectedTerm || matchedDefs.has(def)) return
    onMatch(selectedTerm, def)
    setSelectedTerm(null)
  }

  const matchedCount = Object.keys(matches).length

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Terms */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Terms</p>
          {pairs.map(p => {
            const isMatched  = p.term in matches
            const isSelected = selectedTerm === p.term
            return (
              <button
                key={p.term}
                type="button"
                onClick={() => handleTermClick(p.term)}
                className={`w-full text-left px-3 py-2 border rounded-lg text-xs transition-colors ${
                  isSelected  ? 'border-blue-500 bg-blue-50 text-blue-900 font-medium'
                  : isMatched ? 'border-green-300 bg-green-50 text-green-800'
                  :             'border-gray-200 hover:border-gray-300 text-gray-800'
                }`}
              >
                {p.term}
                {isMatched && !isSelected && (
                  <span className="ml-1 text-green-500 text-[10px]">✓</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Definitions */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Definitions</p>
          {shuffledDefs.map((def, i) => {
            const isMatched   = matchedDefs.has(def)
            const isClickable = !!selectedTerm && !isMatched
            return (
              <button
                key={i}
                type="button"
                onClick={() => isClickable && handleDefClick(def)}
                className={`w-full text-left px-3 py-2 border rounded-lg text-xs transition-colors ${
                  isMatched   ? 'border-green-300 bg-green-50 text-green-700 cursor-default'
                  : isClickable ? 'border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-gray-800 cursor-pointer'
                  :               'border-gray-100 text-gray-400 cursor-default'
                }`}
              >
                {def}
              </button>
            )
          })}
        </div>
      </div>

      {selectedTerm && (
        <p className="text-xs text-blue-600 text-center">
          &ldquo;{selectedTerm}&rdquo; selected — click a definition to match
        </p>
      )}
      <p className="text-xs text-gray-400 text-center">
        {matchedCount} of {pairs.length} pairs matched
        {matchedCount > 0 && ' · click a term to re-match it'}
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RevisionTestMode({ taskId, onDone }: Props) {
  const [state,   setState]  = useState<TestState>({ status: 'starting' })
  const [answer,  setAnswer] = useState('')
  const [matches, setMatches] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // Initialise session on mount
  const initSession = useCallback(async (prevSessionId?: string) => {
    setState({ status: 'starting' })
    setAnswer('')
    setMatches({})
    setLoading(true)
    try {
      const { sessionId, question, totalQuestions } = await startTestSession(taskId, prevSessionId)
      setState({ status: 'question', sessionId, question, number: 1, total: totalQuestions })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not start test. Please try again.'
      setState({ status: 'error', message: msg })
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const { sessionId, question, totalQuestions } = await startTestSession(taskId)
        if (!cancelled) setState({ status: 'question', sessionId, question, number: 1, total: totalQuestions })
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Could not start test. Please try again.'
          setState({ status: 'error', message: msg })
        }
      }
    }
    init()
    return () => { cancelled = true }
  }, [taskId])

  function getAnswer(question: TestQuestion): string {
    if (question.type === 'matching') return JSON.stringify(matches)
    return answer
  }

  function isReady(question: TestQuestion): boolean {
    if (loading) return false
    if (question.type === 'mcq')       return answer !== ''
    if (question.type === 'written')   return answer.trim().length > 0
    if (question.type === 'fill_blank') return answer.trim().length > 0
    if (question.type === 'matching')  return Object.keys(matches).length === (question.pairs?.length ?? 0)
    return false
  }

  async function handleSubmit() {
    if (state.status !== 'question') return
    const { sessionId, question, number, total } = state
    if (!isReady(question)) return

    const submitted = getAnswer(question)
    setState({ status: 'submitting', sessionId, question, number, total })
    setLoading(true)

    try {
      const result = await submitTestAnswer(sessionId, submitted)
      setAnswer('')
      setMatches({})

      if (result.sessionComplete && result.results) {
        setState({ status: 'results', results: result.results, previousSessionId: sessionId })
      } else if (result.nextQuestion) {
        setState({ status: 'question', sessionId, question: result.nextQuestion, number: number + 1, total })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed. Please try again.'
      setState({ status: 'error', message: msg })
    } finally {
      setLoading(false)
    }
  }

  // ── Render: loading/starting ──
  if (state.status === 'starting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
          <Icon name="refresh" size="md" className="animate-spin text-blue-600" />
        </div>
        <p className="text-sm font-medium text-gray-700">Preparing your test…</p>
        <p className="text-xs text-gray-400">Generating personalised exam-style questions</p>
      </div>
    )
  }

  // ── Render: error ──
  if (state.status === 'error') {
    return (
      <div className="max-w-xl mx-auto px-6 py-12 text-center space-y-4">
        <Icon name="error" size="lg" className="text-rose-400 mx-auto" />
        <p className="text-sm font-medium text-gray-800">{state.message}</p>
        <button
          onClick={() => onDone(0)}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          ← Back to revision content
        </button>
      </div>
    )
  }

  // ── Render: results ──
  if (state.status === 'results') {
    const { results, previousSessionId } = state
    const { percentage, estimatedGrade, areasToRevisit, totalScore, maxScore, questionCount } = results
    const accent = percentage >= 70 ? 'text-green-700 bg-green-50 border-green-200'
                 : percentage >= 40 ? 'text-amber-700 bg-amber-50 border-amber-200'
                 :                    'text-rose-700 bg-rose-50 border-rose-200'

    return (
      <div className="max-w-xl mx-auto px-6 py-8 space-y-5">

        {/* Score card */}
        <div className={`border rounded-2xl px-6 py-6 text-center ${accent}`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Icon name="emoji_events" size="md" />
            <h2 className="text-base font-bold text-gray-900">Test Complete!</h2>
          </div>
          <p className={`text-5xl font-bold mb-1 ${accent.split(' ')[0]}`}>{percentage}%</p>
          <p className="text-lg font-semibold text-gray-700">{estimatedGrade}</p>
          <p className="text-xs text-gray-500 mt-2">
            {totalScore}/{maxScore} marks &middot; {questionCount} questions
          </p>
        </div>

        {/* Areas to revisit */}
        {areasToRevisit.length > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 space-y-2">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2">Areas to Revisit</p>
            {areasToRevisit.map(a => (
              <div key={a.topic} className="flex items-start gap-2">
                <span className="text-amber-500 text-xs mt-0.5 shrink-0">→</span>
                <div>
                  <span className="text-sm text-gray-800 font-medium">{a.topic}</span>
                  {a.questionTypes.length > 0 && (
                    <span className="text-xs text-gray-500 ml-1.5">
                      ({a.questionTypes.map(t => TYPE_LABELS[t] ?? t).join(', ')})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-center gap-2">
            <Icon name="check_circle" size="sm" className="text-green-600 shrink-0" />
            <p className="text-sm text-green-800">Excellent — no weak areas identified across all topics!</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-1">
          <button
            onClick={() => initSession(previousSessionId)}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 px-4 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Icon name="loop" size="sm" />
            Repeat Test (new questions)
          </button>
          <button
            onClick={() => onDone(percentage)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            <Icon name="check_circle" size="sm" />
            Finish &amp; Rate My Confidence →
          </button>
        </div>
      </div>
    )
  }

  // ── Render: question (or submitting) ──
  const { question, number, total } = state
  const isSubmitting = state.status === 'submitting'
  const progressPct  = Math.round(((number - 1) / total) * 100)
  const ready        = isReady(question)

  return (
    <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">

      {/* Progress header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="font-semibold text-gray-700">Question {number} of {total}</span>
          <span className="text-gray-400">{TYPE_LABELS[question.type] ?? question.type}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-[11px] text-gray-400">Topic: {question.topic}</p>
      </div>

      {/* Question card */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-900 leading-relaxed">{question.text}</p>
          <p className="text-xs text-gray-400 mt-1">
            [{question.marks} mark{question.marks !== 1 ? 's' : ''}]
          </p>
        </div>

        {/* Reset answer when question changes */}
        <div key={question.index}>
          {question.type === 'mcq' && (
            <MCQQuestion question={question} value={answer} onChange={setAnswer} />
          )}
          {question.type === 'written' && (
            <WrittenQuestion value={answer} onChange={setAnswer} />
          )}
          {question.type === 'fill_blank' && (
            <FillBlankQuestion question={question} value={answer} onChange={setAnswer} />
          )}
          {question.type === 'matching' && (
            <MatchingQuestion
              question={question}
              matches={matches}
              onMatch={(term, def) => setMatches(prev => ({ ...prev, [term]: def }))}
              onUnmatch={term => setMatches(prev => { const n = { ...prev }; delete n[term]; return n })}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Icon name="menu_book" size="sm" />
          <span>Scores revealed at the end</span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!ready || isSubmitting}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          {isSubmitting
            ? <><Icon name="refresh" size="sm" className="animate-spin" /> Evaluating…</>
            : <>{number === total ? 'Submit Final Answer' : 'Next Question'} <Icon name="chevron_right" size="sm" /></>
          }
        </button>
      </div>
    </div>
  )
}
