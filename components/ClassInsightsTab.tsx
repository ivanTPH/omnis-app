'use client'
import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
  BarChart, Bar, Cell,
} from 'recharts'
import {
  getClassInsights, getClassTimeSeries,
  type ClassInsightsData, type ClassTimeSeriesData,
} from '@/app/actions/lessons'
import { gradeLabel, percentToGcseGrade } from '@/lib/grading'

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

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm text-[11px] space-y-1">
      <p className="font-semibold text-gray-800 mb-1">{d?.title}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value != null ? `${Math.round(p.value)}%` : '–'}
        </p>
      ))}
    </div>
  )
}

export default function ClassInsightsTab({ classId }: { classId: string }) {
  const [data,       setData]       = useState<ClassInsightsData | null>(null)
  const [timeSeries, setTimeSeries] = useState<ClassTimeSeriesData | null>(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getClassInsights(classId),
      getClassTimeSeries(classId),
    ])
      .then(([insights, ts]) => {
        setData(insights)
        setTimeSeries(ts)
      })
      .catch(() => {
        setData({ students: [], classAvg: null, totalHomework: 0 })
        setTimeSeries({ points: [], studentNames: [] })
      })
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

  // Bar chart data (kept for RAG view)
  const chartData = students.map(s => ({
    name:  s.name.split(' ').map(w => w[0]).join('.'),
    full:  s.name,
    score: s.avgScore != null ? Math.round(s.avgScore) : 0,
    fill:  RAG_COLOR[s.ragStatus],
    subs:  s.submissionCount,
  }))

  // Line chart data
  const hasTimeSeries = (timeSeries?.points.length ?? 0) >= 2
  const lineData = (timeSeries?.points ?? []).map((p, i) => ({
    x:        i + 1,
    title:    p.title,
    dueAt:    p.dueAt,
    classAvg: p.classAvgScore,
    yearAvg:  p.yearAvgScore,
    baseline: p.curriculumBaseline,
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

      {/* Line chart — class performance over time */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Class Performance Over Time</p>
        </div>
        {hasTimeSeries ? (
          <div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={lineData} margin={{ top: 10, right: 16, left: -26, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="x"
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 9, color: '#9ca3af', paddingTop: 4 }}
                  formatter={(value: string) => (
                    <span style={{ fontSize: 9, color: '#6b7280' }}>{value}</span>
                  )}
                />
                {/* Curriculum baseline — dashed grey */}
                <Line
                  type="monotone"
                  dataKey="baseline"
                  name="Curriculum baseline"
                  stroke="#9ca3af"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={false}
                />
                {/* Year group average — light blue dashed */}
                <Line
                  type="monotone"
                  dataKey="yearAvg"
                  name="Year group avg"
                  stroke="#93c5fd"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                />
                {/* Class average — solid blue */}
                <Line
                  type="monotone"
                  dataKey="classAvg"
                  name="Class average"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center h-24 border border-dashed border-gray-200 rounded-xl">
            <p className="text-[11px] text-gray-400">Not enough data for trend chart</p>
          </div>
        )}
      </div>

      {/* Bar chart — average score by student */}
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
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Student Progress Status</p>
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
                  {s.avgScore != null ? gradeLabel(percentToGcseGrade(Math.round(s.avgScore))) : rag.text}
                </span>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
