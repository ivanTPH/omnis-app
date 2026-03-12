'use client'

import { useState } from 'react'
import { CheckCircle, Circle, Plus, FileText } from 'lucide-react'
import type { EhcpPlanWithOutcomes } from '@/app/actions/ehcp'
import { updateEhcpOutcomeStatus } from '@/app/actions/ehcp'

type Props = { plan: EhcpPlanWithOutcomes }

const STATUS_COLOURS: Record<string, string> = {
  active:               'bg-blue-100 text-blue-700',
  achieved:             'bg-green-100 text-green-700',
  partially_achieved:   'bg-amber-100 text-amber-700',
  not_achieved:         'bg-red-100 text-red-700',
}

const STATUS_OPTIONS = ['active', 'achieved', 'partially_achieved', 'not_achieved']

export default function EhcpOutcomeTracker({ plan }: Props) {
  const [outcomes, setOutcomes] = useState(plan.outcomes)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function handleStatusChange(outcomeId: string, status: string) {
    setUpdatingId(outcomeId)
    try {
      await updateEhcpOutcomeStatus(outcomeId, status)
      setOutcomes(prev => prev.map(o => o.id === outcomeId ? { ...o, status } : o))
    } finally {
      setUpdatingId(null)
    }
  }

  const achieved = outcomes.filter(o => o.status === 'achieved').length
  const total = outcomes.length

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          <span className="font-medium text-green-700">{achieved}</span> of {total} outcomes achieved
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>LA: {plan.localAuthority}</span>
          <span>·</span>
          <span>Review: {new Date(plan.reviewDate).toLocaleDateString('en-GB')}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all"
          style={{ width: total > 0 ? `${Math.round((achieved / total) * 100)}%` : '0%' }}
        />
      </div>

      {/* Outcomes grouped by section */}
      <div className="space-y-3">
        {outcomes.map(outcome => (
          <div key={outcome.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-start gap-3 p-4">
              <div className="shrink-0 pt-0.5">
                {outcome.status === 'achieved'
                  ? <CheckCircle size={18} className="text-green-600" />
                  : <Circle size={18} className="text-gray-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-gray-500 uppercase">Section {outcome.section}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOURS[outcome.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {outcome.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-gray-500">
                    {outcome.evidenceCount} evidence piece{outcome.evidenceCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-gray-400">
                    Due {new Date(outcome.targetDate).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <p className="text-sm text-gray-900 mb-1">{outcome.outcomeText}</p>
                <p className="text-xs text-gray-500">{outcome.successCriteria}</p>
                {outcome.provisionRequired && (
                  <p className="text-xs text-purple-700 mt-1">Provision: {outcome.provisionRequired}</p>
                )}
              </div>
              <div className="shrink-0">
                <select
                  value={outcome.status}
                  onChange={e => handleStatusChange(outcome.id, e.target.value)}
                  disabled={updatingId === outcome.id}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 disabled:opacity-50"
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            </div>

            {outcome.evidenceCount === 0 && outcome.status === 'active' && (
              <div className="border-t border-gray-100 px-4 py-2 bg-amber-50">
                <p className="text-xs text-amber-700 flex items-center gap-1">
                  <Plus size={12} /> No evidence linked yet — link from the submission marking view
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {outcomes.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <FileText size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No outcomes recorded for this EHCP plan.</p>
        </div>
      )}
    </div>
  )
}
