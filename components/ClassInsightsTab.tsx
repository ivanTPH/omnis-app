'use client'
import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { getClassInsights, type ClassInsightsData } from '@/app/actions/lessons'

const RAG_COLOR = {
  green: '#22c55e',
  amber: '#f59e0b',
  red:   '#ef4444',
  none:  '#e5e7eb',
}

const RAG_LABEL = {
  green: { cls: 'bg-green-100 text-green-700', text: '≥70%' },
  amber: { cls: 'bg-amber-100 text-amber-700', text: '40–69%' },
  red:   { cls: 'bg-red-100 text-red-600',     text: '<40%' },
  none:  { cls: 'bg-gray-100 text-gray-400',   text: 'No data' },
}

export default function ClassInsightsTab({ classId }: { classId: string }) {
  const [data,    setData]    = useState<ClassInsightsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getClassInsights(classId)
      .then(setData)
      .catch(() => setData({ students: [], classAvg: null, totalHomework: 0 }))
      .finally(() => setLoading(false))
  }, [classId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Icon name="refresh" size="md" className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (!data || data.totalHomework === 0) {
    return (
      <div className="p-7">
        <div className="border border-dashed border-gray-200 rounded-2xl p-10 text-center">
          <Icon name="bar_chart" size="lg" className="mx-auto text-gray-300 mb-2" />
          <p className="text-[12px] text-gray-400">No published homework for this class yet.</p>
        </div>
      </div>
    )
  }

  const { students, classAvg, totalHomework } = data
  const green = students.filter(s => s.ragStatus === 'green').length
  const amber = students.filter(s => s.ragStatus === 'amber').length
  const red   = students.filter(s => s.ragStatus === 'red').length
  const none  = students.filter(s => s.ragStatus === 'none').length

  const chartData = students.map(s => ({
    name:  s.name.split(' ').map(w => w[0]).join('.'),
    full:  s.name,
    score: s.avgScore != null ? Math.round(s.avgScore) : 0,
    fill:  RAG_COLOR[s.ragStatus],
    subs:  s.submissionCount,
  }))

  return (
    <div className="p-7 space-y-6">

      {/* RAG summary chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-medium text-gray-500">{students.length} students · {totalHomework} assignments</span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{green} on track</span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{amber} developing</span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">{red} at risk</span>
        {none > 0 && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">{none} no data</span>
        )}
      </div>

      {/* Bar chart */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Average Score by Student</p>
          <div className="flex items-center gap-3 text-[9px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> ≥70%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 40–69%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;40%</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ top: 10, right: 4, left: -26, bottom: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip
              formatter={(v: unknown, _n: unknown, item: { payload?: { full?: string; subs?: number } }) => [
                `${v}% (${item.payload?.subs ?? 0}/${totalHomework} submitted)`,
                item.payload?.full ?? '',
              ]}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            {classAvg != null && (
              <ReferenceLine
                y={Math.round(classAvg)}
                stroke="#6366f1"
                strokeDasharray="4 3"
                label={{ value: `Avg ${Math.round(classAvg)}%`, fontSize: 9, fill: '#6366f1', position: 'insideTopRight' }}
              />
            )}
            <Bar dataKey="score" radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* RAG student table */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Student RAG Status</p>
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
          {students.map(s => {
            const rag = RAG_LABEL[s.ragStatus]
            return (
              <div key={s.studentId} className="flex items-center gap-3 px-4 py-2 bg-white">
                <span className="flex-1 text-[12px] text-gray-800 truncate">{s.name}</span>
                <span className="text-[11px] text-gray-400 shrink-0">
                  {s.submissionCount}/{totalHomework} submitted
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${rag.cls}`}>
                  {s.avgScore != null ? `${Math.round(s.avgScore)}%` : rag.text}
                </span>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
