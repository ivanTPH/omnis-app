'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import Icon from '@/components/ui/Icon'
import type { PopulationInsights } from '@/app/actions/population'

// ── Palette ───────────────────────────────────────────────────────────────────

const SEND_COLOURS  = ['#e5e7eb', '#60a5fa', '#a78bfa']  // none, SEN support, EHCP
const NEED_COLOURS  = ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe']
const ATT_COLOURS   = ['#22c55e', '#84cc16', '#f59e0b', '#ef4444']
const PERF_COLOURS  = ['#6366f1', '#60a5fa', '#94a3b8']

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, colour = 'indigo',
}: { label: string; value: string | number; sub?: string; colour?: string }) {
  const border = {
    indigo: 'border-indigo-200 bg-indigo-50',
    amber:  'border-amber-200  bg-amber-50',
    red:    'border-red-200    bg-red-50',
    green:  'border-green-200  bg-green-50',
    purple: 'border-purple-200 bg-purple-50',
  }[colour] ?? 'border-indigo-200 bg-indigo-50'

  const text = {
    indigo: 'text-indigo-700',
    amber:  'text-amber-700',
    red:    'text-red-700',
    green:  'text-green-700',
    purple: 'text-purple-700',
  }[colour] ?? 'text-indigo-700'

  return (
    <div className={`rounded-xl border p-5 ${border}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${text}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Tooltips ──────────────────────────────────────────────────────────────────

function AttTooltip({ active, payload }: { active?: boolean; payload?: {name: string; value: number}[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-white border border-gray-200 px-3 py-2 shadow text-sm">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-gray-600">{payload[0].value} students</p>
    </div>
  )
}

// ── Risk badge ────────────────────────────────────────────────────────────────

const FLAG_COLOURS: Record<string, string> = {
  'SEND need':          'bg-purple-100 text-purple-700',
  'Attendance <90%':   'bg-amber-100  text-amber-700',
  'Behaviour concerns': 'bg-orange-100 text-orange-700',
  'Low attainment':    'bg-red-100    text-red-700',
  'Exclusion on record':'bg-red-200   text-red-800',
  'FSM':               'bg-blue-100   text-blue-700',
}

function FlagBadge({ label }: { label: string }) {
  const cls = FLAG_COLOURS[label] ?? 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PopulationDashboard({ data }: { data: PopulationInsights }) {
  const {
    totalStudents, sendCount, ehcpCount, sendPercent,
    attendanceAvg, persistentAbsenceCount, atRiskCount, exclusionCount,
    sendBreakdown, needAreaBreakdown, byYearGroup, attendanceBands,
    behaviourPositiveTotal, behaviourNegativeTotal,
    fsmCount, ealCount, fsmEalDataAvailable,
    avgGradeAllStudents, avgGradeSendStudents, avgGradeNoSendStudents,
    atRiskStudents,
  } = data

  const behaviourRatio = behaviourPositiveTotal + behaviourNegativeTotal > 0
    ? Math.round((behaviourPositiveTotal / (behaviourPositiveTotal + behaviourNegativeTotal)) * 100)
    : null

  const ygChartData = byYearGroup
    .filter(r => r.yearGroup != null)
    .map(r => ({
      name:     `Yr ${r.yearGroup}`,
      SEND:     r.sendCount,
      'No SEND': r.total - r.sendCount,
      total:    r.total,
    }))

  const perfData = [
    { name: 'All students',    value: avgGradeAllStudents    ?? 0 },
    { name: 'No SEND',         value: avgGradeNoSendStudents ?? 0 },
    { name: 'SEND students',   value: avgGradeSendStudents   ?? 0 },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-8">

      {/* ── Cohort overview ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total students"
          value={totalStudents}
          colour="indigo"
        />
        <StatCard
          label="SEND students"
          value={`${sendCount} (${sendPercent}%)`}
          sub={`${ehcpCount} with EHCP`}
          colour="purple"
        />
        <StatCard
          label="School attendance"
          value={attendanceAvg != null ? `${attendanceAvg}%` : '—'}
          sub={`${persistentAbsenceCount} below 80%`}
          colour={attendanceAvg != null && attendanceAvg < 90 ? 'amber' : 'green'}
        />
        <StatCard
          label="Multi-factor at risk"
          value={atRiskCount}
          sub={`${exclusionCount} exclusion record${exclusionCount !== 1 ? 's' : ''}`}
          colour={atRiskCount > 0 ? 'red' : 'green'}
        />
      </div>

      {/* ── SEND + attendance row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* SEND breakdown donut */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <SectionHeader title="SEND Profile" sub="Active students by support level" />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sendBreakdown}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {sendBreakdown.map((_, i) => (
                    <Cell key={i} fill={SEND_COLOURS[i % SEND_COLOURS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v} students`]} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Need area list */}
          {needAreaBreakdown.length > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-3 space-y-1">
              {needAreaBreakdown.slice(0, 5).map((r, i) => (
                <div key={r.needArea} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: NEED_COLOURS[i % NEED_COLOURS.length] }}
                    />
                    <span className="text-gray-700">{r.needArea}</span>
                  </div>
                  <span className="font-medium text-gray-900">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attendance bands */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <SectionHeader title="Attendance Distribution" sub="Current academic year" />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attendanceBands}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {attendanceBands.map((_b, i) => (
                    <Cell key={i} fill={ATT_COLOURS[i % ATT_COLOURS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<AttTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Behaviour row */}
          <div className="mt-3 border-t border-gray-100 pt-3 flex items-center gap-6 text-xs text-gray-600">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              <span>{behaviourPositiveTotal.toLocaleString()} positive incidents</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
              <span>{behaviourNegativeTotal.toLocaleString()} negative incidents</span>
            </div>
            {behaviourRatio != null && (
              <span className="ml-auto font-medium text-gray-900">{behaviourRatio}% positive</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Year group breakdown bar ──────────────────────────────────────── */}
      {ygChartData.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <SectionHeader title="SEND by Year Group" sub="Students with active SEND support vs no SEND" />
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ygChartData} barSize={20}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="No SEND" stackId="a" fill="#e5e7eb" />
                <Bar dataKey="SEND"    stackId="a" fill="#a78bfa" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Performance gap + FSM/EAL ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Performance gap */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <SectionHeader
            title="Attainment Gap"
            sub="Average submission score (%) — current term"
          />
          {perfData.length > 0 ? (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perfData} layout="vertical" barSize={22}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v) => [`${v}%`]} />
                  {perfData.map((d, i) => (
                    <Bar key={d.name} dataKey="value" fill={PERF_COLOURS[i]} radius={[0,4,4,0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mt-4">No graded submissions this term yet.</p>
          )}
          {avgGradeAllStudents != null && avgGradeSendStudents != null && (
            <p className="text-xs text-gray-500 mt-3">
              SEND gap: <span className="font-medium text-red-600">
                {Math.abs(avgGradeAllStudents - avgGradeSendStudents)}%
              </span> below school average
            </p>
          )}
        </div>

        {/* FSM / EAL */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <SectionHeader title="Pupil Characteristics" sub="FSM & EAL eligibility" />
          {fsmEalDataAvailable ? (
            <div className="space-y-4 mt-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-700">{fsmCount}</p>
                  <p className="text-xs text-gray-500">Free School Meals eligible</p>
                  <p className="text-xs text-gray-400">
                    {totalStudents > 0 ? Math.round((fsmCount / totalStudents) * 100) : 0}% of cohort
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-teal-700">{ealCount}</p>
                  <p className="text-xs text-gray-500">English as Additional Language</p>
                  <p className="text-xs text-gray-400">
                    {totalStudents > 0 ? Math.round((ealCount / totalStudents) * 100) : 0}% of cohort
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-700">
                    {data.byYearGroup.reduce((a, r) => a + r.fsmCount, 0) > 0
                      ? data.byYearGroup.filter(r => r.fsmCount > 0 && r.sendCount > 0).length
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-500">Year groups with FSM+SEND overlap</p>
                </div>
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                FSM/EAL data synced from MIS. Update via Admin → MIS Sync.
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center justify-center gap-2 text-center py-6">
              <Icon name="sync" size="lg" color="#9ca3af" />
              <p className="text-sm text-gray-500">FSM and EAL data not yet synced</p>
              <p className="text-xs text-gray-400">Run a Wonde MIS sync from Admin → MIS Sync to populate pupil characteristics.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Multi-factor at-risk students ─────────────────────────────────── */}
      {atRiskStudents.length > 0 && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-5">
          <SectionHeader
            title={`Multi-factor at-risk students (${atRiskStudents.length})`}
            sub="3 or more risk flags: SEND need, attendance <90%, behaviour concerns, low attainment, exclusion, FSM"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-red-200">
                  <th className="pb-2 font-medium pr-4">Student</th>
                  <th className="pb-2 font-medium pr-4">Year</th>
                  <th className="pb-2 font-medium pr-4">Attendance</th>
                  <th className="pb-2 font-medium">Risk factors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {atRiskStudents.map(s => (
                  <tr key={s.id} className="py-2">
                    <td className="py-2 pr-4 font-medium text-gray-900 whitespace-nowrap">
                      {s.firstName} {s.lastName}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {s.yearGroup != null ? `Yr ${s.yearGroup}` : '—'}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">
                      {s.attendance != null ? `${s.attendance}%` : '—'}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {s.riskFlags.map(f => <FlagBadge key={f} label={f} />)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {atRiskStudents.length === 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 flex items-center gap-3">
          <Icon name="check_circle" size="lg" color="#16a34a" />
          <div>
            <p className="text-sm font-medium text-green-800">No multi-factor at-risk students identified</p>
            <p className="text-xs text-green-600">No students currently have 3+ overlapping risk factors.</p>
          </div>
        </div>
      )}

    </div>
  )
}
