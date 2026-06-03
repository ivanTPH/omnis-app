'use client'

import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { SltSendDashboardData } from '@/app/actions/slt-send'

type Props = { data: SltSendDashboardData }

function gradeLabel(score: number | null): string {
  if (score == null) return '—'
  const g = Math.round(score)
  const letters: Record<number, string> = { 9:'A**', 8:'A*', 7:'A', 6:'B', 5:'C+', 4:'C', 3:'D', 2:'E', 1:'F' }
  return `Gr ${g} (${letters[g] ?? '?'})`
}

function gap(send: number | null, all: number | null): string {
  if (send == null || all == null) return '—'
  const diff = send - all
  return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`
}

function gapColour(send: number | null, all: number | null): string {
  if (send == null || all == null) return 'text-gray-400'
  const diff = send - all
  if (diff >= -0.5) return 'text-green-600'
  if (diff >= -1.5) return 'text-amber-600'
  return 'text-red-600'
}

const FLAG_LABELS: Record<string, string> = {
  homework_decline:    'Homework decline',
  completion_drop:     'Completion drop',
  score_decline:       'Score decline',
  pattern_absence:     'Attendance pattern',
  multiple_concerns:   'Multiple concerns',
}

export default function SltSendDashboard({ data }: Props) {
  const { sendTotal, senSupport, ehcpCount, schoolAvgScore, sendAvgScore,
          yearGroupRows, ehcp, ilp, needAreas, flags } = data

  const attainmentGap = sendAvgScore != null && schoolAvgScore != null
    ? sendAvgScore - schoolAvgScore
    : null

  // Chart data: attainment by year group
  const chartData = yearGroupRows.map(r => ({
    name:      `Yr ${r.yearGroup}`,
    'School':  r.allAvgScore  != null ? parseFloat(r.allAvgScore.toFixed(1))  : null,
    'SEND':    r.sendAvgScore != null ? parseFloat(r.sendAvgScore.toFixed(1)) : null,
  }))

  return (
    <div className="space-y-6">

      {/* ── 1. Register summary ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'On SEND register', value: sendTotal,    icon: 'group',       colour: 'text-purple-700', bg: 'bg-purple-50 border-purple-100' },
          { label: 'SEN Support',      value: senSupport,   icon: 'support',     colour: 'text-blue-700',   bg: 'bg-blue-50 border-blue-100' },
          { label: 'With EHCP',        value: ehcpCount,    icon: 'description', colour: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-100' },
          { label: 'Active ILPs',      value: ilp.activeIlps, icon: 'task_alt',  colour: 'text-teal-700',   bg: 'bg-teal-50 border-teal-100' },
        ].map(k => (
          <div key={k.label} className={`border rounded-xl p-5 ${k.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{k.label}</p>
              <Icon name={k.icon} size="sm" className={k.colour} />
            </div>
            <p className={`text-3xl font-bold ${k.colour}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── 2. Attainment gap banner ──────────────────────────────────────── */}
      <div className={`border rounded-xl p-5 flex flex-wrap items-center gap-6 ${attainmentGap != null && attainmentGap < -1.5 ? 'bg-red-50 border-red-200' : attainmentGap != null && attainmentGap < -0.5 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">School avg grade (last 90 days)</p>
          <p className="text-2xl font-bold text-gray-900">{gradeLabel(schoolAvgScore)}</p>
        </div>
        <Icon name="arrow_forward" size="md" className="text-gray-400" />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">SEND avg grade</p>
          <p className={`text-2xl font-bold ${gapColour(sendAvgScore, schoolAvgScore)}`}>{gradeLabel(sendAvgScore)}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Attainment gap</p>
          <p className={`text-2xl font-bold ${gapColour(sendAvgScore, schoolAvgScore)}`}>{gap(sendAvgScore, schoolAvgScore)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">grades (SEND vs school)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Year-group attainment chart */}
          {chartData.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-[13px] font-semibold text-gray-900 mb-4">Attainment by Year Group (last 90 days)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 9]} ticks={[1,2,3,4,5,6,7,8,9]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val: unknown) => gradeLabel(typeof val === 'number' ? val : null)}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="School" fill="#93c5fd" radius={[4,4,0,0]} />
                  <Bar dataKey="SEND"   radius={[4,4,0,0]}>
                    {chartData.map((entry, i) => {
                      const gap = (entry['SEND'] ?? 0) - (entry['School'] ?? 0)
                      return <Cell key={i} fill={gap >= -0.5 ? '#34d399' : gap >= -1.5 ? '#fbbf24' : '#f87171'} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Year-group table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
              <h2 className="text-[13px] font-semibold text-gray-900">Year Group Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Year', 'SEND', 'SEN Supp.', 'EHCP', 'ILPs', 'SEND avg', 'School avg', 'Gap'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {yearGroupRows.map(r => (
                    <tr key={r.yearGroup} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">Yr {r.yearGroup}</td>
                      <td className="px-4 py-3 font-bold text-purple-700">{r.total}</td>
                      <td className="px-4 py-3 text-blue-700">{r.senSupport}</td>
                      <td className="px-4 py-3 text-indigo-700">{r.ehcp}</td>
                      <td className="px-4 py-3 text-teal-700">{r.activeIlps}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{gradeLabel(r.sendAvgScore)}</td>
                      <td className="px-4 py-3 text-gray-600">{gradeLabel(r.allAvgScore)}</td>
                      <td className={`px-4 py-3 font-bold ${gapColour(r.sendAvgScore, r.allAvgScore)}`}>
                        {gap(r.sendAvgScore, r.allAvgScore)}
                      </td>
                    </tr>
                  ))}
                  {yearGroupRows.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No SEND data by year group</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Need area breakdown */}
          {needAreas.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
                <h2 className="text-[13px] font-semibold text-gray-900">By Need Area</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {needAreas.map(n => (
                  <div key={n.needArea} className="flex items-center px-5 py-3 gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-gray-900 truncate">{n.needArea}</p>
                    </div>
                    <div className="flex items-center gap-6 shrink-0 text-right">
                      <div>
                        <p className="text-[13px] font-bold text-purple-700">{n.count}</p>
                        <p className="text-[10px] text-gray-400">students</p>
                      </div>
                      <div>
                        <p className={`text-[12px] font-medium ${gapColour(n.avgScore, schoolAvgScore)}`}>{gradeLabel(n.avgScore)}</p>
                        <p className="text-[10px] text-gray-400">avg grade</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column ─────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* EHCP compliance */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="description" size="sm" className="text-indigo-600" />
              <h3 className="text-[13px] font-semibold text-gray-900">EHCP Compliance</h3>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Total plans',       value: ehcp.total,           colour: 'text-gray-900' },
                { label: 'Approved',          value: ehcp.approved,        colour: 'text-green-600' },
                { label: 'Pending sign-off',  value: ehcp.pendingApproval, colour: ehcp.pendingApproval > 0 ? 'text-amber-600' : 'text-gray-300' },
                { label: 'Reviews overdue',   value: ehcp.reviewOverdue,   colour: ehcp.reviewOverdue > 0   ? 'text-red-600'   : 'text-gray-300' },
                { label: 'Reviews due (30d)', value: ehcp.reviewDue30,     colour: ehcp.reviewDue30 > 0     ? 'text-amber-600' : 'text-gray-300' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-500">{r.label}</span>
                  <span className={`text-[14px] font-bold ${r.colour}`}>{r.value}</span>
                </div>
              ))}
            </div>

            {/* Outcome progress */}
            {ehcp.outcomesTotal > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Outcome progress</p>
                <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-2">
                  <div className="bg-green-400" style={{ width: `${(ehcp.outcomesAchieved / ehcp.outcomesTotal) * 100}%` }} />
                  <div className="bg-blue-300"  style={{ width: `${(ehcp.outcomesActive   / ehcp.outcomesTotal) * 100}%` }} />
                  <div className="bg-gray-200"  style={{ flex: 1 }} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="text-[10px] text-green-700 font-medium">{ehcp.outcomesAchieved} achieved</span>
                  <span className="text-[10px] text-blue-600 font-medium">{ehcp.outcomesActive} active</span>
                  <span className="text-[10px] text-gray-400">{ehcp.outcomesTotal} total</span>
                </div>
              </div>
            )}

            {/* Evidence audit */}
            {ehcp.outcomesTotal > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Evidence audit</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Sufficient (≥2 pieces)', value: ehcp.evidenceGood, colour: 'text-green-600', bg: 'bg-green-100' },
                    { label: 'Partial (1 piece)',       value: ehcp.evidenceSome, colour: 'text-amber-600', bg: 'bg-amber-100' },
                    { label: 'No evidence',            value: ehcp.evidenceNone, colour: 'text-red-600',   bg: 'bg-red-100' },
                  ].map(e => (
                    <div key={e.label} className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-500">{e.label}</span>
                      <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${e.bg} ${e.colour}`}>{e.value}</span>
                    </div>
                  ))}
                  {ehcp.pendingAiSuggestions > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-purple-700 bg-purple-50 px-2 py-1.5 rounded-lg">
                      <Icon name="auto_awesome" size="sm" />
                      {ehcp.pendingAiSuggestions} AI suggestion{ehcp.pendingAiSuggestions !== 1 ? 's' : ''} awaiting SENCO review
                    </div>
                  )}
                </div>
              </div>
            )}

            <Link href="/senco/ehcp" className="mt-4 flex items-center gap-1 text-[11px] text-indigo-600 font-medium hover:underline">
              View EHCP Plans <Icon name="chevron_right" size="sm" />
            </Link>
          </div>

          {/* ILP coverage */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="task_alt" size="sm" className="text-teal-600" />
              <h3 className="text-[13px] font-semibold text-gray-900">ILP Coverage</h3>
            </div>

            {/* Coverage bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] text-gray-500">ILP coverage</span>
                <span className={`text-[14px] font-bold ${ilp.coveragePct >= 80 ? 'text-green-600' : ilp.coveragePct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  {ilp.coveragePct}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${ilp.coveragePct >= 80 ? 'bg-green-400' : ilp.coveragePct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${ilp.coveragePct}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{ilp.activeIlps} of {data.sendTotal} SEND students have an active approved ILP</p>
            </div>

            <div className="space-y-2.5 border-t border-gray-100 pt-3">
              {[
                { label: 'Active targets',   value: ilp.targetsActive,   colour: 'text-blue-700' },
                { label: 'Achieved targets', value: ilp.targetsAchieved, colour: 'text-green-600' },
                { label: 'Not achieved',     value: ilp.targetsNotAch,   colour: ilp.targetsNotAch > 0 ? 'text-red-500' : 'text-gray-300' },
                { label: 'ILPs overdue review', value: ilp.reviewOverdue, colour: ilp.reviewOverdue > 0 ? 'text-amber-600' : 'text-gray-300' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-500">{r.label}</span>
                  <span className={`text-[14px] font-bold ${r.colour}`}>{r.value}</span>
                </div>
              ))}
            </div>

            <Link href="/senco/ilp" className="mt-4 flex items-center gap-1 text-[11px] text-teal-600 font-medium hover:underline">
              View ILP Records <Icon name="chevron_right" size="sm" />
            </Link>
          </div>

          {/* Early warning flags */}
          <div className={`border rounded-xl p-5 ${flags.high > 0 ? 'bg-red-50 border-red-200' : flags.medium > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <Icon name="warning" size="sm" className={flags.high > 0 ? 'text-red-600' : flags.medium > 0 ? 'text-amber-600' : 'text-gray-400'} />
              <h3 className="text-[13px] font-semibold text-gray-900">Early Warning Flags</h3>
            </div>
            <div className="flex gap-4 mb-3">
              {[
                { label: 'High',   value: flags.high,   colour: 'text-red-600',   bg: 'bg-red-100' },
                { label: 'Medium', value: flags.medium, colour: 'text-amber-600', bg: 'bg-amber-100' },
                { label: 'Low',    value: flags.low,    colour: 'text-gray-600',  bg: 'bg-gray-100' },
              ].map(s => (
                <div key={s.label} className={`flex-1 text-center rounded-lg py-2 ${s.bg}`}>
                  <p className={`text-[18px] font-bold ${s.colour}`}>{s.value}</p>
                  <p className="text-[10px] text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
            {flags.byType.length > 0 && (
              <div className="space-y-1.5 border-t border-gray-200 pt-3">
                {flags.byType.map(f => (
                  <div key={f.type} className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-600">{FLAG_LABELS[f.type] ?? f.type}</span>
                    <span className="text-[12px] font-bold text-gray-800">{f.count}</span>
                  </div>
                ))}
              </div>
            )}
            {flags.totalActive === 0 && (
              <p className="text-[12px] text-gray-400 text-center py-2">No active flags</p>
            )}
            <Link href="/senco/early-warning" className="mt-3 flex items-center gap-1 text-[11px] text-gray-600 font-medium hover:underline">
              View Early Warning <Icon name="chevron_right" size="sm" />
            </Link>
          </div>

          {/* UK GDPR notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <Icon name="lock" size="sm" className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-800">
              SEND data is Special Category under UK GDPR (Article 9). Access is logged. Governors may request anonymised summaries only.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
