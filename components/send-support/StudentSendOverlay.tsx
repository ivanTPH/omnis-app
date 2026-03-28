'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import type { StudentSendSummary } from '@/app/actions/send-support'
import RaiseConcernButton from './RaiseConcernButton'

type Props = { students: StudentSendSummary[] }

export default function StudentSendOverlay({ students }: Props) {
  const [expanded, setExpanded] = useState(false)

  const flagged = students.filter(s =>
    s.hasSendStatus || s.openConcerns > 0 || s.hasActiveIlp || s.hasWarningFlag
  )

  if (flagged.length === 0) return null

  return (
    <div className="border border-amber-200 rounded-xl bg-amber-50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <Icon name="group" size="sm" className="text-amber-600" />
          <span className="text-sm font-medium text-amber-800">
            {flagged.length} student{flagged.length > 1 ? 's' : ''} with SEND notes
          </span>
        </div>
        {expanded ? <Icon name="expand_less" size="sm" className="text-amber-600" /> : <Icon name="expand_more" size="sm" className="text-amber-600" />}
      </button>

      {expanded && (
        <div className="border-t border-amber-200 divide-y divide-amber-100">
          {flagged.map(s => (
            <div key={s.userId} className="px-4 py-3 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="text-sm font-medium text-gray-900">{s.name}</span>
                    {s.hasSendStatus && s.sendStatus && s.sendStatus !== 'NONE' && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                        {s.sendStatus.replace('_', ' ')}
                      </span>
                    )}
                    {s.openConcerns > 0 && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                        {s.openConcerns} concern{s.openConcerns > 1 ? 's' : ''}
                      </span>
                    )}
                    {s.hasActiveIlp && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">ILP</span>
                    )}
                    {s.hasWarningFlag && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">⚠ Flag</span>
                    )}
                  </div>

                  {s.ilpStrategies.length > 0 && (
                    <div className="text-xs text-gray-600 mt-1">
                      <span className="font-medium">ILP strategies: </span>
                      {s.ilpStrategies.slice(0, 2).join(', ')}
                      {s.ilpStrategies.length > 2 && ` +${s.ilpStrategies.length - 2} more`}
                    </div>
                  )}
                </div>
                <RaiseConcernButton studentId={s.userId} studentName={s.name} variant="icon" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
