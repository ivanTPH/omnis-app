'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'
import { getInferenceStatsAction, type InferenceStats } from '@/app/actions/platform-insights'

export default function OmnisInferenceStatsPanel() {
  const [stats,   setStats]   = useState<InferenceStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getInferenceStatsAction()
      .then(s => setStats(s))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-48 mb-3" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    )
  }

  const empty = !stats || stats.totalEntries === 0

  return (
    <div className="rounded-2xl border border-violet-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-violet-50 bg-violet-50/40">
        <div className="flex items-center gap-2">
          <Icon name="memory" size="sm" className="text-violet-600" />
          <div>
            <p className="text-[13px] font-semibold text-violet-900">Omnis Inference Layer</p>
            <p className="text-[11px] text-violet-500">
              Claude call reduction via profile signature caching
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
          empty
            ? 'bg-gray-100 text-gray-500'
            : 'bg-violet-100 text-violet-700'
        }`}>
          {empty ? 'No data yet' : 'Active'}
        </span>
      </div>

      {empty ? (
        <div className="px-5 py-6 text-center text-sm text-gray-400">
          <Icon name="cached" size="md" className="mx-auto mb-2 opacity-30" />
          <p>Cache will populate after the nightly coach agent runs.</p>
          <p className="text-[11px] mt-0.5">
            Profile signatures are written on first SEND student encountered per type.
          </p>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-violet-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-violet-700">{stats.totalEntries}</p>
              <p className="text-[10px] text-violet-500">unique profiles</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{stats.totalHits.toLocaleString()}</p>
              <p className="text-[10px] text-emerald-500">cache hits</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-amber-700">
                {stats.totalEntries > 0
                  ? Math.round((stats.totalHits / (stats.totalHits + stats.totalEntries)) * 100)
                  : 0}%
              </p>
              <p className="text-[10px] text-amber-500">hit rate</p>
            </div>
            <div className="bg-indigo-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-indigo-700">
                ${stats.estimatedSavingsUsd.toFixed(2)}
              </p>
              <p className="text-[10px] text-indigo-500">est. API savings</p>
            </div>
          </div>

          {/* By type breakdown */}
          {Object.entries(stats.byType).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Cache Breakdown
              </p>
              <div className="space-y-2">
                {Object.entries(stats.byType).map(([type, d]) => (
                  <div key={type} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-[11px] font-medium text-gray-700">
                        {type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {d.entries} profile types · {d.hits} hits
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-600">
                      ${d.estimatedSavingsUsd.toFixed(2)} saved
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="flex gap-4 text-[10px] text-gray-400">
            {stats.oldestEntry && (
              <span>
                First entry: {new Date(stats.oldestEntry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
            {stats.newestEntry && (
              <span>
                Latest: {new Date(stats.newestEntry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>

          <p className="text-[10px] text-gray-400">
            Profile signatures bucket: year group × SEND need area × performance tier × weak/retention topic counts.
            TTL: 30 days. Expired entries purged nightly by early-warning cron.
          </p>
        </div>
      )}
    </div>
  )
}
