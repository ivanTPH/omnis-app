'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type RevisionProgressRow = {
  id:              string
  subject:         string
  topic:           string
  preRevisionAvg:  number | null
  postRevisionAvg: number | null
  improvement:     number | null
  confidenceLevel: number | null
}

export default function RevisionProgressChart({
  progress,
  subject,
}: {
  progress: RevisionProgressRow[]
  subject:  string
}) {
  const data = progress.map(p => ({
    name:   p.topic.length > 18 ? p.topic.slice(0, 18) + '…' : p.topic,
    Before: p.preRevisionAvg != null ? Math.round(p.preRevisionAvg * 10) / 10 : null,
    After:  p.postRevisionAvg != null ? Math.round(p.postRevisionAvg * 10) / 10 : null,
  }))

  const improved = progress.filter(p => p.improvement != null && p.improvement > 0)
  const avgImprovement = improved.length > 0
    ? Math.round((improved.reduce((s, p) => s + (p.improvement ?? 0), 0) / improved.length) * 10) / 10
    : null

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p className="text-sm">No revision progress data yet for {subject}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 9]} tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
            formatter={(v: any) => [`${v}/9`, '']}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Before" fill="#94a3b8" radius={[3,3,0,0]} />
          <Bar dataKey="After"  fill="#22c55e" radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
      {avgImprovement != null && (
        <p className="text-xs text-center text-green-600 font-semibold">
          Average improvement: +{avgImprovement} grades across revised topics
        </p>
      )}
    </div>
  )
}
