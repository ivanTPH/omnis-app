'use client'

import { useState, useTransition } from 'react'
import { useRouter }                from 'next/navigation'
import Link                         from 'next/link'
import Icon                         from '@/components/ui/Icon'
import { reviewAgentRecommendation, type AgentRecommendation } from '@/app/actions/agent-insights'

const AGENT_COLORS: Record<string, string> = {
  COACH:          'bg-blue-100 text-blue-700',
  QUALITY:        'bg-violet-100 text-violet-700',
  PLAN_SYNTHESIS: 'bg-emerald-100 text-emerald-700',
  EVIDENCE:       'bg-amber-100 text-amber-700',
}

const AGENT_LABELS: Record<string, string> = {
  COACH:          'Coach',
  QUALITY:        'Quality',
  PLAN_SYNTHESIS: 'Plan Synthesis',
  EVIDENCE:       'Evidence',
}

const SKILL_LABELS: Record<string, string> = {
  CURRICULUM_ALIGNMENT:  'Curriculum Alignment',
  BLOOMS_ANALYSIS:       "Bloom's Analysis",
  SEND_DIFFERENTIATION:  'SEND Differentiation',
  RETRIEVAL_SPACING:     'Retrieval & Spacing',
  MARKING_CONSISTENCY:   'Marking Consistency',
  APDR_CYCLE:            'APDR Cycle',
  FEEDBACK_QUALITY:      'Feedback Quality',
}

const CONFIDENCE_COLOR = (c: number) =>
  c >= 80 ? 'text-green-600' : c >= 60 ? 'text-amber-600' : 'text-red-500'

const OUTCOME_STYLES: Record<string, string> = {
  CONFIRMED:  'bg-green-100 text-green-700',
  OVERRIDDEN: 'bg-amber-100 text-amber-700',
  DISMISSED:  'bg-gray-100 text-gray-500',
}

const PAGE_SIZE = 30

function RecommendationCard({ item, onReviewed }: {
  item: AgentRecommendation
  onReviewed: () => void
}) {
  const [expanded, setExpanded]   = useState(false)
  const [note, setNote]           = useState('')
  const [pending, startTransition] = useTransition()
  const [done, setDone]           = useState<string | null>(item.reviewOutcome)

  function handleReview(outcome: 'CONFIRMED' | 'OVERRIDDEN' | 'DISMISSED') {
    startTransition(async () => {
      await reviewAgentRecommendation(item.id, outcome, note || undefined)
      setDone(outcome)
      onReviewed()
    })
  }

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all ${done ? 'opacity-60' : 'border-gray-200'}`}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <Icon name={expanded ? 'expand_less' : 'expand_more'} size="sm" className="text-gray-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${AGENT_COLORS[item.agentType] ?? 'bg-gray-100 text-gray-600'}`}>
              {AGENT_LABELS[item.agentType] ?? item.agentType}
            </span>
            <span className="text-[10px] text-gray-400 font-medium">
              {SKILL_LABELS[item.skillId] ?? item.skillId}
            </span>
            <span className={`text-[10px] font-semibold ${CONFIDENCE_COLOR(item.confidence)}`}>
              {item.confidence}% confidence
            </span>
            {done && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${OUTCOME_STYLES[done] ?? ''}`}>
                {done}
              </span>
            )}
          </div>
          <p className="text-[13px] font-medium text-gray-900 truncate">{item.studentName}</p>
          <p className="text-[12px] text-gray-500 line-clamp-2 mt-0.5">{item.outputSummary}</p>
        </div>
        <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0 mt-0.5">
          {new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
          {/* Decision */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-1">Recommended action</p>
            <p className="text-[13px] text-blue-900 font-medium">{item.decision}</p>
          </div>

          {/* Standards */}
          {item.standardsApplied.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Standards applied</p>
              <div className="flex flex-wrap gap-1">
                {item.standardsApplied.map(s => (
                  <span key={s} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Link to student */}
          <div className="flex items-center gap-2">
            <Link
              href={`/senco/ilp/${item.studentId}`}
              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium"
            >
              <Icon name="person" size="sm" />View {item.studentName}&apos;s ILP
            </Link>
          </div>

          {/* Review panel — only show if not yet reviewed */}
          {!done ? (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-[11px] font-semibold text-gray-600 mb-2">Review this recommendation</p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Optional note (e.g. already actioned, disagree because…)"
                rows={2}
                className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleReview('CONFIRMED')}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                >
                  <Icon name="check_circle" size="sm" />Confirm
                </button>
                <button
                  onClick={() => handleReview('OVERRIDDEN')}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition"
                >
                  <Icon name="edit" size="sm" />Override
                </button>
                <button
                  onClick={() => handleReview('DISMISSED')}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition"
                >
                  <Icon name="close" size="sm" />Dismiss
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-100 pt-3 flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold ${OUTCOME_STYLES[done] ?? ''}`}>
                {done}
              </span>
              {item.reviewNote && <p className="text-[11px] text-gray-500 italic">{item.reviewNote}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function AgentRecommendationsView({
  items, total, filter, page,
}: {
  items:  AgentRecommendation[]
  total:  number
  filter: string
  page:   number
}) {
  const router    = useRouter()
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const localItems = items

  // When an item is reviewed, refresh server data
  function handleReviewed() { router.refresh() }

  const filterChips = [
    { key: 'pending',  label: 'Awaiting review' },
    { key: 'reviewed', label: 'Reviewed' },
    { key: 'all',      label: 'All' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-page-title">AI Agent Insights</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">
          Recommendations generated by the Coach, Quality, and Plan Synthesis agents.
          Review each and confirm, override, or dismiss.
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-5">
        {filterChips.map(chip => {
          const active = filter === chip.key
          return (
            <a
              key={chip.key}
              href={`/senco/agent-insights?filter=${chip.key}`}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition ${
                active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {chip.label}
            </a>
          )
        })}
        <span className="ml-auto text-[12px] text-gray-400 self-center">{total} total</span>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="check_circle" size="lg" className="mx-auto mb-3 text-gray-300" />
          <p>
            {filter === 'pending' ? 'No pending recommendations — all reviewed.' : 'No recommendations found.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {localItems.map(item => (
            <RecommendationCard key={item.id} item={item} onReviewed={handleReviewed} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-[12px] text-gray-400">Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            {page > 0 && (
              <a href={`/senco/agent-insights?filter=${filter}&page=${page - 1}`}
                 className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <Icon name="chevron_left" size="sm" />Previous
              </a>
            )}
            {page < totalPages - 1 && (
              <a href={`/senco/agent-insights?filter=${filter}&page=${page + 1}`}
                 className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                Next<Icon name="chevron_right" size="sm" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Info footer */}
      <div className="mt-8 flex items-start gap-2 text-[11px] text-gray-400">
        <Icon name="info" size="sm" className="shrink-0 mt-0.5" />
        <p>
          Agents run nightly. Coach identifies knowledge gaps and retrieval risks.
          Quality reviews homework and marking standards. Plan Synthesis checks ILP→EHCP→K Plan coherence.
          All agent decisions are logged to the audit trail.
        </p>
      </div>
    </div>
  )
}
