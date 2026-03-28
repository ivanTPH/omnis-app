'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import type { SencoDashboardData } from '@/app/actions/send-support'
import { triggerEarlyWarningAnalysis } from '@/app/actions/send-support'
import { ConcernStatusBadge } from './ConcernList'
import { SeverityBadge } from './EarlyWarningPanel'

type Props = { data: SencoDashboardData }

export default function SencoDashboard({ data }: Props) {
  const [running, setRunning] = useState(false)
  const [result, setResult]   = useState<{ flagsCreated: number } | null>(null)

  async function runAnalysis() {
    setRunning(true)
    try {
      const r = await triggerEarlyWarningAnalysis()
      setResult(r)
    } finally {
      setRunning(false)
    }
  }

  const kpis = [
    { label: 'Open Concerns',      value: data.openConcerns,      iconName: 'warning',         color: data.openConcerns > 0 ? 'text-amber-600' : 'text-gray-400' },
    { label: 'High Severity Flags', value: data.highSeverityFlags, iconName: 'radar',           color: data.highSeverityFlags > 0 ? 'text-red-600' : 'text-gray-400' },
    { label: 'Students with ILP',  value: data.studentsWithIlp,   iconName: 'favorite_border', color: 'text-blue-600' },
    { label: 'Reviews Due (14d)',   value: data.ilpReviewsDue,     iconName: 'schedule',        color: data.ilpReviewsDue > 0 ? 'text-orange-600' : 'text-gray-400' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name={k.iconName} size="md" className={k.color} />
              <span className="text-xs text-gray-500 font-medium">{k.label}</span>
            </div>
            <div className={`text-3xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Run analysis button */}
      <div className="flex items-center gap-4">
        <button
          onClick={runAnalysis}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Icon name="trending_up" size="sm" />
          {running ? 'Analysing…' : 'Run Early Warning Analysis'}
        </button>
        {result && (
          <span className="text-sm text-gray-600">
            {result.flagsCreated === 0 ? 'No new flags detected.' : `${result.flagsCreated} new flag${result.flagsCreated > 1 ? 's' : ''} created.`}
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent concerns */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Icon name="warning" size="sm" className="text-amber-500" />
            <h3 className="font-medium text-gray-900 text-sm">Recent Concerns</h3>
          </div>
          {data.recentConcerns.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No concerns raised.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.recentConcerns.map(c => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.studentName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.category} · raised by {c.raiserName}</p>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-1">{c.description}</p>
                    </div>
                    <ConcernStatusBadge status={c.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active flags */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Icon name="radar" size="sm" className="text-blue-500" />
            <h3 className="font-medium text-gray-900 text-sm">Active Warning Flags</h3>
          </div>
          {data.activeFlags.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No active flags.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.activeFlags.map(f => (
                <div key={f.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{f.studentName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{f.flagType.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{f.description}</p>
                    </div>
                    <SeverityBadge severity={f.severity} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Links */}
      <div className="flex gap-3 flex-wrap">
        <a href="/senco/concerns" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="warning" size="sm" /> All Concerns
        </a>
        <a href="/senco/ilp" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="favorite_border" size="sm" /> ILP Records
        </a>
        <a href="/senco/early-warning" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="radar" size="sm" /> Early Warning
        </a>
        <a href="/send-scorer" className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
          <Icon name="people" size="sm" /> Resource Scorer
        </a>
      </div>
    </div>
  )
}
