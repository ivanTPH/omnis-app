'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts'
import { getHomeworkAdaptiveAnalytics } from '@/app/actions/analytics'
import type { HomeworkAdaptiveAnalytics } from '@/app/actions/analytics'
import { Brain, TrendingUp, FileCheck, BookOpen } from 'lucide-react'

const BLOOMS_COLOURS: Record<string, string> = {
  remember:   '#6366f1',
  understand: '#8b5cf6',
  apply:      '#a855f7',
  analyse:    '#d946ef',
  evaluate:   '#ec4899',
  create:     '#f43f5e',
}

const TYPE_COLOUR = '#7c3aed'

export default function AdaptiveAnalyticsDashboard() {
  const [data, setData] = useState<HomeworkAdaptiveAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getHomeworkAdaptiveAnalytics()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  if (!data) return null

  const ilpPct = Math.round(data.ilpEvidenceRate * 100)
  const ehcpPct = Math.round(data.ehcpEvidenceRate * 100)

  return (
    <div className="space-y-8">
      {/* Evidence rates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileCheck size={18} className="text-green-600" />
            <h3 className="font-medium text-gray-900">ILP Evidence Rate</h3>
          </div>
          <div className="text-4xl font-bold text-green-700 mb-2">{ilpPct}%</div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${ilpPct}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-2">of homework linked to an ILP target</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={18} className="text-purple-600" />
            <h3 className="font-medium text-gray-900">EHCP Evidence Rate</h3>
          </div>
          <div className="text-4xl font-bold text-purple-700 mb-2">{ehcpPct}%</div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${ehcpPct}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-2">of homework linked to an EHCP outcome</p>
        </div>
      </div>

      {/* Bloom's distribution */}
      {data.bloomsDistribution.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-indigo-600" />
            <h3 className="font-medium text-gray-900">Bloom&apos;s Taxonomy Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.bloomsDistribution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="level" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: unknown, name: unknown) => [value as number, name === 'count' ? 'Homework tasks' : 'Avg score']}
              />
              <Bar dataKey="count" name="count" radius={[4, 4, 0, 0]}>
                {data.bloomsDistribution.map((entry) => (
                  <Cell key={entry.level} fill={BLOOMS_COLOURS[entry.level] ?? '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-3">
            {data.bloomsDistribution.map(d => (
              <div key={d.level} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: BLOOMS_COLOURS[d.level] ?? '#6366f1' }} />
                <span className="text-xs text-gray-600 capitalize">{d.level}</span>
                {d.avgScore > 0 && <span className="text-xs text-gray-400">({Math.round(d.avgScore)}% avg)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Homework type performance */}
      {data.typeBreakdown.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={18} className="text-blue-600" />
            <h3 className="font-medium text-gray-900">Performance by Homework Type</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={data.typeBreakdown.map(t => ({
                ...t,
                type: t.type.replace(/_/g, ' '),
              }))}
              margin={{ top: 0, right: 0, left: -20, bottom: 40 }}
            >
              <XAxis dataKey="type" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
              <Tooltip
                formatter={(value: unknown, name: unknown) => [
                  name === 'avgScore' ? `${Math.round(value as number)}%` : (value as number),
                  name === 'avgScore' ? 'Avg score' : 'Tasks',
                ]}
              />
              <Legend verticalAlign="top" />
              <Bar dataKey="avgScore" name="avgScore" fill={TYPE_COLOUR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Completion by type */}
      {data.completionByType.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-medium text-gray-900 mb-4">Completion Rate by Type</h3>
          <div className="space-y-3">
            {data.completionByType
              .sort((a, b) => b.completionRate - a.completionRate)
              .map(t => (
                <div key={t.type} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-36 shrink-0 capitalize">{t.type.replace(/_/g, ' ')}</span>
                  <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.round(t.completionRate * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-700 w-12 text-right">{Math.round(t.completionRate * 100)}%</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {data.typeBreakdown.length === 0 && data.bloomsDistribution.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Brain size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No adaptive homework data yet. Publish some homework with Bloom&apos;s levels to see analytics here.</p>
        </div>
      )}
    </div>
  )
}
