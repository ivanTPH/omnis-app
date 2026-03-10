'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Bot, CheckCircle } from 'lucide-react'
import type { ConcernRow } from '@/app/actions/send-support'
import ConcernReviewModal from './ConcernReviewModal'

const STATUS_COLOURS: Record<string, string> = {
  open:         'bg-amber-100 text-amber-800',
  under_review: 'bg-blue-100 text-blue-800',
  escalated:    'bg-red-100 text-red-800',
  monitoring:   'bg-purple-100 text-purple-800',
  closed:       'bg-gray-100 text-gray-600',
  no_action:    'bg-gray-100 text-gray-500',
}

const CATEGORY_COLOURS: Record<string, string> = {
  literacy:         'bg-sky-100 text-sky-700',
  numeracy:         'bg-emerald-100 text-emerald-700',
  behaviour:        'bg-red-100 text-red-700',
  attendance:       'bg-orange-100 text-orange-700',
  social_emotional: 'bg-violet-100 text-violet-700',
  communication:    'bg-teal-100 text-teal-700',
  physical:         'bg-pink-100 text-pink-700',
  sensory:          'bg-indigo-100 text-indigo-700',
  other:            'bg-gray-100 text-gray-700',
}

export function ConcernStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLOURS[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLOURS[category] ?? 'bg-gray-100 text-gray-700'}`}>
      {category.replace(/_/g, ' ')}
    </span>
  )
}

type Props = {
  concerns: ConcernRow[]
  isSenco?: boolean
  onRefresh?: () => void
}

export default function ConcernList({ concerns, isSenco = false, onRefresh }: Props) {
  const [expanded,      setExpanded]      = useState<Set<string>>(new Set())
  const [reviewing,     setReviewing]     = useState<ConcernRow | null>(null)

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (concerns.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <CheckCircle size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">No concerns on record.</p>
      </div>
    )
  }

  return (
    <>
      <div className="divide-y divide-gray-100">
        {concerns.map(c => {
          const isOpen = expanded.has(c.id)
          return (
            <div key={c.id} className="py-3">
              <button
                className="w-full text-left flex items-start gap-3"
                onClick={() => toggle(c.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{c.studentName}</span>
                    <CategoryBadge category={c.category} />
                    <ConcernStatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(c.createdAt).toLocaleDateString('en-GB')} · raised by {c.raiserName}
                  </p>
                  {!isOpen && (
                    <p className="text-sm text-gray-700 mt-1 line-clamp-1">{c.description}</p>
                  )}
                </div>
                {isOpen ? <ChevronUp size={16} className="text-gray-400 shrink-0 mt-0.5" /> : <ChevronDown size={16} className="text-gray-400 shrink-0 mt-0.5" />}
              </button>

              {isOpen && (
                <div className="mt-3 pl-2 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                    <p className="text-sm text-gray-800">{c.description}</p>
                  </div>

                  {c.evidenceNotes && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Evidence / observations</p>
                      <p className="text-sm text-gray-800">{c.evidenceNotes}</p>
                    </div>
                  )}

                  {c.reviewNotes && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">SENCO review notes</p>
                      <p className="text-sm text-gray-800">{c.reviewNotes}</p>
                      {c.reviewedAt && (
                        <p className="text-xs text-gray-400 mt-1">Reviewed {new Date(c.reviewedAt).toLocaleDateString('en-GB')}</p>
                      )}
                    </div>
                  )}

                  {c.aiAnalysis && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Bot size={14} className="text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">AI-assisted analysis</span>
                      </div>
                      <p className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{c.aiAnalysis}</p>
                    </div>
                  )}

                  {isSenco && c.status !== 'closed' && c.status !== 'no_action' && (
                    <button
                      onClick={() => setReviewing(c)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                    >
                      Review Concern
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {reviewing && (
        <ConcernReviewModal
          concern={reviewing}
          onClose={() => { setReviewing(null); onRefresh?.() }}
        />
      )}
    </>
  )
}
