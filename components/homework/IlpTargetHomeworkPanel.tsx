'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'
import { getIlpTargetsDueForEvidencing } from '@/app/actions/ehcp'
import type { IlpTargetDue } from '@/app/actions/ehcp'

type Props = {
  classId: string
  linkedIds: string[]
  onToggle: (id: string) => void
}

export default function IlpTargetHomeworkPanel({ classId, linkedIds, onToggle }: Props) {
  const [targets, setTargets] = useState<IlpTargetDue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getIlpTargetsDueForEvidencing()
      .then(setTargets)
      .catch(() => setTargets([]))
      .finally(() => setLoading(false))
  }, [classId])

  if (loading) return <p className="text-sm text-gray-500 py-4">Loading ILP targets…</p>

  if (targets.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-500">
        <Icon name="track_changes" size="md" className="mx-auto mb-2 opacity-30" />
        No ILP targets due for evidencing in the next 28 days.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        {targets.length} target{targets.length !== 1 ? 's' : ''} due for evidencing. Link to this homework to build an evidence portfolio.
      </p>
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {targets.map(t => {
          const linked = linkedIds.includes(t.targetId)
          const urgent = t.daysUntilDue <= 7
          return (
            <button
              key={t.targetId}
              onClick={() => onToggle(t.targetId)}
              className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${linked ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="flex items-start gap-2">
                {linked ? <Icon name="check_box" size="sm" className="text-blue-600 shrink-0 mt-0.5" /> : <Icon name="check_box_outline_blank" size="sm" className="text-gray-400 shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-gray-600">{t.studentName}</span>
                    {urgent && <Icon name="error" size="sm" className="text-red-500" />}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {t.daysUntilDue}d left
                    </span>
                    {t.evidenceCount > 0 && (
                      <span className="text-xs text-gray-400">{t.evidenceCount} evidence</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 line-clamp-2">{t.target}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
