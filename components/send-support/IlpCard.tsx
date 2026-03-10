'use client'

import { useState } from 'react'
import { FileHeart, Target, CheckCircle, Clock, XCircle, ChevronDown } from 'lucide-react'
import type { IlpWithTargets } from '@/app/actions/send-support'
import { updateIlpTarget } from '@/app/actions/send-support'

const TARGET_STATUS_ICONS: Record<string, React.ReactNode> = {
  active:       <Clock size={14} className="text-blue-500" />,
  achieved:     <CheckCircle size={14} className="text-green-500" />,
  not_achieved: <XCircle size={14} className="text-red-500" />,
  deferred:     <ChevronDown size={14} className="text-orange-500" />,
}

type Props = { ilp: IlpWithTargets }

export default function IlpCard({ ilp }: Props) {
  const [updatingId,    setUpdatingId]    = useState<string | null>(null)
  const [expandedTargetId, setExpandedTargetId] = useState<string | null>(null)
  const [notes,         setNotes]         = useState('')

  async function saveTargetUpdate(targetId: string, status: string) {
    setUpdatingId(targetId)
    try {
      await updateIlpTarget(targetId, status, notes)
    } finally {
      setUpdatingId(null)
      setExpandedTargetId(null)
      setNotes('')
    }
  }

  const reviewSoon = new Date(ilp.reviewDate).getTime() - Date.now() < 14 * 24 * 60 * 60 * 1000

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileHeart size={16} className="text-blue-600" />
              <h3 className="font-semibold text-gray-900">Individual Learning Plan</h3>
            </div>
            <p className="text-sm text-gray-600">
              {ilp.studentName} · {ilp.sendCategory}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-xs font-medium ${reviewSoon ? 'text-orange-600' : 'text-gray-500'}`}>
              Review: {new Date(ilp.reviewDate).toLocaleDateString('en-GB')}
            </p>
            {reviewSoon && <p className="text-xs text-orange-500">Review due soon</p>}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Strengths & Needs */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Current Strengths</p>
            <p className="text-sm text-gray-700">{ilp.currentStrengths}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Areas of Need</p>
            <p className="text-sm text-gray-700">{ilp.areasOfNeed}</p>
          </div>
        </div>

        {/* Targets */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Targets</p>
          <div className="space-y-2">
            {ilp.targets.map(t => (
              <div key={t.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  {TARGET_STATUS_ICONS[t.status] ?? <Target size={14} className="text-gray-400" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{t.target}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Strategy: {t.strategy}</p>
                    <p className="text-xs text-gray-500">Success measure: {t.successMeasure}</p>
                    {t.progressNotes && (
                      <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1 mt-1">{t.progressNotes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">Target date: {new Date(t.targetDate).toLocaleDateString('en-GB')}</p>
                  </div>
                  <button
                    onClick={() => setExpandedTargetId(expandedTargetId === t.id ? null : t.id)}
                    className="shrink-0 text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Update
                  </button>
                </div>

                {expandedTargetId === t.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    <select
                      defaultValue={t.status}
                      onChange={e => saveTargetUpdate(t.id, e.target.value)}
                      disabled={updatingId === t.id}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                    >
                      <option value="active">Active</option>
                      <option value="achieved">Achieved</option>
                      <option value="not_achieved">Not Achieved</option>
                      <option value="deferred">Deferred</option>
                    </select>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Progress notes (optional)…"
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs resize-none"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Strategies */}
        {ilp.strategies.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Teaching Strategies</p>
            <ul className="space-y-1">
              {ilp.strategies.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-blue-400 mt-0.5">·</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Success criteria */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Success Criteria</p>
          <p className="text-sm text-gray-700">{ilp.successCriteria}</p>
        </div>
      </div>
    </div>
  )
}
