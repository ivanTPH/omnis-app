'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

type ConfidenceEntry = {
  subject:       string
  avgConfidence: number
  sessionCount:  number
}

function barColour(avg: number) {
  if (avg <= 2) return '#ef4444'  // red
  if (avg <= 3) return '#f59e0b'  // amber
  return '#22c55e'                // green
}

export default function ConfidenceChart({ data }: { data: ConfidenceEntry[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[12px] text-gray-400">
        Complete revision sessions to track confidence.
      </div>
    )
  }

  const chartData = data.map(d => ({
    subject: d.subject.length > 10 ? d.subject.slice(0, 10) + '…' : d.subject,
    fullSubject: d.subject,
    confidence: Math.round(d.avgConfidence * 10) / 10,
    sessions: d.sessionCount,
  }))

  return (
    <div>
      <h3 className="text-[13px] font-bold text-gray-900 mb-3">Confidence by Subject</h3>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="subject"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 5]}
            ticks={[1,2,3,4,5]}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload
              return (
                <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-[11px] shadow-sm">
                  <p className="font-semibold text-gray-900">{d.fullSubject}</p>
                  <p className="text-gray-600">Confidence: {d.confidence}/5</p>
                  <p className="text-gray-400">{d.sessions} session{d.sessions !== 1 ? 's' : ''}</p>
                </div>
              )
            }}
          />
          <Bar dataKey="confidence" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={barColour(entry.confidence)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 justify-center">
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />1–2 Low
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />3 Okay
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />4–5 Confident
        </span>
      </div>
    </div>
  )
}
