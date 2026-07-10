'use client'

import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'
import { getSchoolCohortInsights, type CohortContext } from '@/app/actions/cohort'

const BLOOMS_ORDER = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create']

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const colour = pct >= 70 ? 'bg-green-400' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 w-7 text-right">{value}%</span>
    </div>
  )
}

const YEAR_GROUPS = [7, 8, 9, 10, 11, 12, 13]

export default function CohortInsightsPanel({ yearGroup: initialYearGroup }: { yearGroup?: number }) {
  const [selectedYear, setSelectedYear] = useState<number | undefined>(initialYearGroup)
  const [data,         setData]         = useState<CohortContext | null>(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    setLoading(true)
    setData(null)
    getSchoolCohortInsights(selectedYear)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedYear])

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-48" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-3/4" />
      </div>
    )
  }

  if (!data || data.studentCount === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-400">
        <Icon name="insights" size="md" className="mx-auto mb-2 opacity-40" />
        <p>Cohort insights not yet available.</p>
        <p className="text-[11px] mt-0.5">Profiles are computed nightly — check back tomorrow.</p>
      </div>
    )
  }

  const sendPct       = data.studentCount > 0 ? Math.round((data.sendCount / data.studentCount) * 100) : 0
  const completionPct = Math.round(data.avgCompletionRate * 100)

  // Best Bloom's level
  const bestBlooms = Object.entries(data.bloomsPerformance)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1)[0]

  // Best homework type for SEND students
  const bestSendType = Object.entries(data.sendTypePerformance)
    .sort((a, b) => b[1].avg - a[1].avg)
    .slice(0, 1)[0]

  // Top need area
  const topNeedArea = Object.entries(data.needAreaBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1)[0]

  const bloomsEntries = BLOOMS_ORDER
    .filter(l => data.bloomsPerformance[l] != null)
    .map(l => ({ level: l, score: data.bloomsPerformance[l] }))

  const { improving, stable, declining } = data.trendCounts
  const total = improving + stable + declining || 1

  return (
    <div className="rounded-2xl border border-purple-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-purple-50 bg-purple-50/40 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="insights" size="sm" className="text-purple-600" />
            <div>
              <p className="text-[13px] font-semibold text-purple-900">School Cohort Insights</p>
              <p className="text-[11px] text-purple-500">{data.studentCount} students · updated nightly</p>
            </div>
          </div>
          <span className="text-[10px] font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Live</span>
        </div>
        {/* Year group selector */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setSelectedYear(undefined)}
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition ${
              selectedYear == null
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
            }`}
          >
            All years
          </button>
          {YEAR_GROUPS.map(yg => (
            <button
              key={yg}
              onClick={() => setSelectedYear(yg)}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition ${
                selectedYear === yg
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
              }`}
            >
              Y{yg}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 grid grid-cols-2 gap-5">

        {/* Left column */}
        <div className="space-y-4">

          {/* SEND overview */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">SEND Overview</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-semibold text-purple-700">{data.sendCount}</p>
                <p className="text-[10px] text-purple-500">{sendPct}% on register</p>
              </div>
              <a href="/senco/concerns" className="bg-rose-50 rounded-xl p-3 text-center block hover:bg-rose-100 transition">
                <p className="text-2xl font-semibold text-rose-700">{data.highConcernCount}</p>
                <p className="text-[10px] text-rose-500">high concern</p>
                <p className="text-[9px] text-rose-400 mt-0.5">view all →</p>
              </a>
            </div>
            {topNeedArea && (
              <p className="text-[11px] text-gray-500 mt-2">
                Most common need: <span className="font-medium text-gray-700">{topNeedArea[0]}</span> ({topNeedArea[1]} students)
              </p>
            )}
          </div>

          {/* Attainment + completion */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Attainment</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-600">Avg score</span>
              </div>
              <ScoreBar value={data.avgScore} />
              <div className="flex items-center justify-between text-[11px] mt-2">
                <span className="text-gray-600">Completion rate</span>
              </div>
              <ScoreBar value={completionPct} />
            </div>
          </div>

          {/* Trend distribution */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Student Trends</p>
            <div className="flex gap-1 h-2 rounded-full overflow-hidden">
              <div className="bg-green-400" style={{ width: `${(improving / total) * 100}%` }} />
              <div className="bg-gray-200" style={{ width: `${(stable  / total) * 100}%` }} />
              <div className="bg-rose-400" style={{ width: `${(declining / total) * 100}%` }} />
            </div>
            <div className="flex gap-3 mt-1.5 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>{improving} improving</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200 inline-block"/>{stable} stable</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block"/>{declining} declining</span>
            </div>
          </div>

        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Bloom's performance */}
          {bloomsEntries.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Bloom&apos;s Performance
                {bestBlooms && (
                  <span className="ml-1 normal-case font-normal text-gray-400">
                    (strongest: {bestBlooms[0]})
                  </span>
                )}
              </p>
              <div className="space-y-1.5">
                {bloomsEntries.map(({ level, score }) => (
                  <div key={level}>
                    <p className="text-[10px] text-gray-500 capitalize mb-0.5">{level}</p>
                    <ScoreBar value={score} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Best task type for SEND */}
          {bestSendType && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Best Task Type (SEND)
              </p>
              <div className="bg-indigo-50 rounded-xl p-3">
                <p className="text-[12px] font-semibold text-indigo-800">
                  {bestSendType[0].replace(/_/g, ' ')}
                </p>
                <p className="text-[11px] text-indigo-600 mt-0.5">
                  avg {bestSendType[1].avg}% · {bestSendType[1].count} submissions
                </p>
              </div>
            </div>
          )}

          {/* Top ILP strategies */}
          {data.topStrategies.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Top ILP Strategies in School
              </p>
              <ul className="space-y-1">
                {data.topStrategies.slice(0, 3).map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-600">
                    <span className="text-purple-400 font-semibold shrink-0">{i + 1}.</span>
                    <span className="capitalize">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>

      <div className="px-5 pb-4 text-[10px] text-gray-400">
        Used automatically by AI to ground ILP generation in this school&apos;s evidence base.
      </div>
    </div>
  )
}
