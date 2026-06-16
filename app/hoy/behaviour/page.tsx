import { requireAuth }                          from '@/lib/session'
import { redirect }                             from 'next/navigation'
import AppShell                                  from '@/components/AppShell'
import Link                                      from 'next/link'
import Icon                                      from '@/components/ui/Icon'
import { getBehaviourOverview, getBehaviourTrends } from '@/app/actions/behaviour'
import BehaviourTrendChart                       from '@/components/behaviour/BehaviourTrendChart'

export const dynamic = 'force-dynamic'

export default async function HoyBehaviourPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_DEPT'].includes(role)) redirect('/dashboard')

  const { year } = await searchParams
  const yearGroup = year ? parseInt(year, 10) : undefined

  const [rows, trends] = await Promise.all([
    getBehaviourOverview(yearGroup),
    getBehaviourTrends(8),
  ])

  const withExclusion  = rows.filter(r => r.hasExclusion).length
  const withNegative   = rows.filter(r => (r.wondeNegative ?? 0) + r.manualNegative > 0).length
  const withPositive   = rows.filter(r => (r.wondePositive ?? 0) + r.manualPositive > 0).length
  const totalManual    = rows.reduce((s, r) => s + r.totalManual, 0)

  const YEARS = [7, 8, 9, 10, 11, 12, 13]

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/hoy/dashboard" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <Icon name="chevron_left" size="sm" /> Dashboard
                </Link>
              </div>
              <h1 className="text-[22px] font-bold text-gray-900">Behaviour Overview</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">
                {schoolName}{yearGroup ? ` — Year ${yearGroup}` : ''} · {rows.length} students
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/api/export/behaviour-summary${yearGroup ? `?yearGroup=${yearGroup}` : ''}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <Icon name="download" size="sm" />
                Behaviour CSV
              </Link>
              <Link
                href={`/api/export/detention-register${yearGroup ? `?yearGroup=${yearGroup}` : ''}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <Icon name="download" size="sm" />
                Detentions CSV
              </Link>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Students',         value: rows.length,    color: 'text-gray-900' },
              { label: 'With exclusion',   value: withExclusion,  color: withExclusion > 0 ? 'text-rose-600' : 'text-gray-300' },
              { label: 'Negative records', value: withNegative,   color: withNegative > 0 ? 'text-amber-600' : 'text-gray-300' },
              { label: 'Positive records', value: withPositive,   color: 'text-emerald-600' },
            ].map(k => (
              <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className={`text-[24px] font-bold ${k.color}`}>{k.value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Trend chart */}
          {trends.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
              <h2 className="text-[13px] font-semibold text-gray-800 mb-4">Weekly Trend (8 weeks)</h2>
              <BehaviourTrendChart data={trends} />
            </div>
          )}

          {/* Year group filter */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Link
              href="/hoy/behaviour"
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${!yearGroup ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              All Years
            </Link>
            {YEARS.map(y => (
              <Link
                key={y}
                href={`/hoy/behaviour?year=${y}`}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${yearGroup === y ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                Year {y}
              </Link>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {rows.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Icon name="sentiment_satisfied" size="lg" className="text-gray-300 mx-auto mb-3" />
                <p className="text-[13px] text-gray-500">No behaviour data for this year group.</p>
              </div>
            ) : (
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Student</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-gray-500">Year</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-gray-500">SEND</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-emerald-700">+ Positive</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-rose-700">− Negative</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-gray-500">Exclusion</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-gray-500">Manual</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map(r => {
                    const pos = (r.wondePositive ?? 0) + r.manualPositive
                    const neg = (r.wondeNegative ?? 0) + r.manualNegative
                    const isHighRisk = r.hasExclusion || neg >= 5
                    return (
                      <tr key={r.studentId} className={`hover:bg-gray-50 transition-colors ${isHighRisk ? 'bg-rose-50/30' : ''}`}>
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-gray-900">{r.studentName}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-500">
                          {r.yearGroup ? `Y${r.yearGroup}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {r.sendStatus ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-800">
                              {r.sendStatus.replace('_', ' ')}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center font-semibold text-emerald-600">
                          {pos > 0 ? `+${pos}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center font-semibold text-rose-600">
                          {neg > 0 ? `-${neg}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {r.hasExclusion
                            ? <span className="inline-flex items-center gap-0.5 text-rose-600 font-semibold"><Icon name="block" size="sm" /> Yes</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-600">
                          {r.totalManual > 0 ? r.totalManual : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/students/${r.studentId}`}
                            className="text-[11px] text-blue-600 hover:underline"
                          >
                            File →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {totalManual > 0 && (
            <p className="mt-3 text-[11px] text-gray-400">
              {totalManual} manual record{totalManual !== 1 ? 's' : ''} logged by staff · Wonde data synced from MIS
            </p>
          )}
        </div>
      </main>
    </AppShell>
  )
}
