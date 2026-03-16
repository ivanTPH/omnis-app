'use client'
import { useState, useTransition } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { getClassPerformanceAnalysis } from '@/app/actions/revision-program'
import type { ClassPerformanceAnalysis } from '@/lib/revision/analysis-engine'

function scoreColour(pct: number) {
  if (pct >= 75) return { bg: 'bg-green-100', text: 'text-green-700', icon: '✅' }
  if (pct >= 50) return { bg: 'bg-amber-100', text: 'text-amber-700', icon: '⚠️' }
  return { bg: 'bg-rose-100', text: 'text-rose-700', icon: '❌' }
}

export default function RevisionAnalysisPanel({
  classId,
  periodStart,
  periodEnd,
  onCreateProgram,
}: {
  classId:         string
  periodStart:     Date
  periodEnd:       Date
  onCreateProgram: () => void
}) {
  const [analysis, setAnalysis]   = useState<ClassPerformanceAnalysis | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function load() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await getClassPerformanceAnalysis(classId, periodStart, periodEnd)
        setAnalysis(result)
      } catch {
        setError('Failed to load analysis.')
      }
    })
  }

  if (!analysis && !isPending) {
    return (
      <div className="flex flex-col items-center py-8 gap-3">
        <p className="text-sm text-gray-500">Analyse class performance to identify revision needs</p>
        <button onClick={load} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
          Analyse Class Performance
        </button>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-gray-500">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Analysing…</span>
      </div>
    )
  }

  if (!analysis) return null

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        {analysis.topicPerformance.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No homework data for this period.</p>
        ) : analysis.topicPerformance.map(tp => {
          const pct = Math.round((tp.classAvgScore / 9) * 100)
          const c   = scoreColour(pct)
          return (
            <div key={tp.topic} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${c.bg}`}>
              <span className="text-[10px]">{c.icon}</span>
              <span className="flex-1 text-xs text-gray-800 truncate">{tp.topic}</span>
              <div className="w-20 h-1 bg-white/60 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
              </div>
              <span className={`text-[10px] font-bold ${c.text}`}>{pct}%</span>
            </div>
          )
        })}
      </div>
      <button
        onClick={onCreateProgram}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
      >
        <Plus size={14} /> Create Revision Program
      </button>
    </div>
  )
}
