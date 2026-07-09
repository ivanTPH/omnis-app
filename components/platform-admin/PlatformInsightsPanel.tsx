'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'
import { getPlatformInsightDashboardData, type PlatformInsightDashboardData } from '@/app/actions/platform-insights'

const BLOOMS_ORDER = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create']

function Bar({ value, max = 100 }: { value: number; max?: number }) {
  const pct    = Math.min(100, Math.round((value / max) * 100))
  const colour = pct >= 70 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 w-7 text-right">{value}%</span>
    </div>
  )
}

export default function PlatformInsightsPanel() {
  const [data,    setData]    = useState<PlatformInsightDashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPlatformInsightDashboardData()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-56" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-3/4" />
      </div>
    )
  }

  if (!data || !data.attainment) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-400">
        <Icon name="insights" size="md" className="mx-auto mb-2 opacity-40" />
        <p className="font-medium">Cross-school insights not yet available.</p>
        <p className="text-[11px] mt-0.5">
          The pipeline runs Sundays at 05:00 UTC once at least 3 schools have nightly cohort aggregates.
        </p>
      </div>
    )
  }

  const { attainment, blooms, sendTaskTypes, strategies, needAreas } = data
  const updatedStr = data.lastGeneratedAt
    ? new Date(data.lastGeneratedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'

  const bloomsEntries = BLOOMS_ORDER
    .filter(l => blooms?.levels[l] != null)
    .map(l => ({ level: l, score: blooms!.levels[l] }))

  const topTasks = sendTaskTypes
    ? Object.entries(sendTaskTypes.types)
        .sort((a, b) => b[1].avg - a[1].avg)
        .slice(0, 4)
    : []

  const topNeedAreas = needAreas
    ? Object.entries(needAreas.areas)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 5)
    : []

  const topStrats = strategies?.strategies.slice(0, 5) ?? []

  return (
    <div className="rounded-2xl border border-indigo-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-indigo-50 bg-indigo-50/40">
        <div className="flex items-center gap-2">
          <Icon name="public" size="sm" className="text-indigo-600" />
          <div>
            <p className="text-[13px] font-semibold text-indigo-900">Cross-School Intelligence</p>
            <p className="text-[11px] text-indigo-500">
              {data.schoolCount} schools · {data.studentCount.toLocaleString()} students · updated {updatedStr}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
            k-anon ≥3 schools
          </span>
        </div>
      </div>

      <div className="p-5 grid grid-cols-3 gap-6">

        {/* Column 1: Attainment benchmarks */}
        <div className="space-y-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">National Benchmarks</p>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-indigo-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-indigo-700">{attainment.avgScore}%</p>
              <p className="text-[10px] text-indigo-500">avg score</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-emerald-700">{attainment.avgCompletion}%</p>
              <p className="text-[10px] text-emerald-500">completion</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-purple-700">{attainment.sendPct}%</p>
              <p className="text-[10px] text-purple-500">SEND register</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-amber-700">{attainment.improvingPct}%</p>
              <p className="text-[10px] text-amber-500">improving</p>
            </div>
          </div>

          {attainment.sendAvgScore > 0 && (
            <div className="bg-rose-50 rounded-xl px-3 py-2">
              <p className="text-[11px] text-rose-600">
                SEND students avg: <span className="font-semibold">{attainment.sendAvgScore}%</span>
                {' '}
                <span className="text-rose-400">
                  ({attainment.avgScore - attainment.sendAvgScore > 0
                    ? `${attainment.avgScore - attainment.sendAvgScore}pt gap vs cohort`
                    : 'matching cohort'})
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Column 2: Bloom's + best SEND task types */}
        <div className="space-y-4">
          {bloomsEntries.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Bloom&apos;s Distribution (national)
              </p>
              <div className="space-y-1.5">
                {bloomsEntries.map(({ level, score }) => (
                  <div key={level}>
                    <p className="text-[10px] text-gray-500 capitalize mb-0.5">{level}</p>
                    <Bar value={score} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {topTasks.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Best Task Types (SEND students)
              </p>
              <div className="space-y-1.5">
                {topTasks.map(([type, d]) => (
                  <div key={type}>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-gray-600 capitalize">{type.replace(/_/g, ' ').toLowerCase()}</span>
                      <span className="text-gray-400">{d.studentCount.toLocaleString()} students</span>
                    </div>
                    <Bar value={d.avg} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Column 3: SEND need areas + ILP strategies */}
        <div className="space-y-4">
          {topNeedAreas.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                SEND Need Area Prevalence
              </p>
              <div className="space-y-1.5">
                {topNeedAreas.map(([area, pct]) => (
                  <div key={area}>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-gray-600">{area}</span>
                      <span className="text-gray-400">{pct as number}%</span>
                    </div>
                    <Bar value={pct as number} max={50} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {topStrats.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Top ILP Strategies (by school adoption)
              </p>
              <ol className="space-y-1">
                {topStrats.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-600">
                    <span className="text-indigo-400 font-semibold shrink-0">{i + 1}.</span>
                    <span className="capitalize">{s.strategy}</span>
                    <span className="ml-auto text-[10px] text-gray-400 shrink-0">{s.schoolCount}s</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

      </div>

      <div className="px-5 pb-4 text-[10px] text-gray-400">
        Insights are anonymised, aggregated, and injected into every ILP generation prompt to ground recommendations in national evidence. No school or student identifiers are stored.
      </div>
    </div>
  )
}
