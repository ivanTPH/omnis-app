import { requireAuth }           from '@/lib/session'
import { redirect }              from 'next/navigation'
import Link                      from 'next/link'
import AppShell                  from '@/components/AppShell'
import Icon                      from '@/components/ui/Icon'
import { getAdminSendOverview }  from '@/app/actions/send-support'

export const dynamic = 'force-dynamic'

const ALLOWED = ['SCHOOL_ADMIN', 'SLT', 'SENCO']

const CATEGORY_LABELS: Record<string, string> = {
  literacy:         'Literacy',
  numeracy:         'Numeracy',
  behaviour:        'Behaviour',
  attendance:       'Attendance',
  social_emotional: 'Social & Emotional',
  communication:    'Communication',
  physical:         'Physical',
  sensory:          'Sensory',
  other:            'Other',
}

export default async function AdminSendOverviewPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/dashboard')

  const data = await getAdminSendOverview()

  const sendPct = data.totalStudents > 0
    ? Math.round((data.sendStudents / data.totalStudents) * 100)
    : 0

  const topStats = [
    { label: 'On SEND register',   value: data.sendStudents,    sub: `${sendPct}% of roll`,     color: 'bg-blue-50 text-blue-700'    },
    { label: 'Active ILPs',        value: data.activeIlps,      sub: `${data.ilpsUnderReview} under review`, color: 'bg-indigo-50 text-indigo-700' },
    { label: 'EHCP Plans',         value: data.ehcps,           sub: data.ehcpsDue30d > 0 ? `${data.ehcpsDue30d} due in 30d` : 'All on track', color: data.ehcpsDue30d > 0 ? 'bg-amber-50 text-amber-700' : 'bg-purple-50 text-purple-700' },
    { label: 'Open concerns',      value: data.openConcerns,    sub: 'open / under review',     color: data.openConcerns > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700' },
  ]

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/dashboard" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <Icon name="chevron_left" size="sm" /> Dashboard
            </Link>
          </div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">SEND Overview</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">School-wide SEND register, ILP and EHCP summary</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/api/export/send-register"
                className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Icon name="download" size="sm" /> SEND Register CSV
              </a>
              <Link
                href="/senco/concerns"
                className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <Icon name="open_in_new" size="sm" /> Concerns
              </Link>
            </div>
          </div>

          {/* Top KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {topStats.map(s => (
              <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
                <p className="text-[11px] font-semibold opacity-70 mb-1">{s.label}</p>
                <p className="text-[26px] font-bold leading-none mb-1">{s.value}</p>
                <p className="text-[10px] opacity-60">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Year group breakdown */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Icon name="groups" size="sm" className="text-blue-600" />
                <h2 className="text-[14px] font-semibold text-gray-900">By year group</h2>
              </div>
              {data.byYear.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-gray-400">No year group data available.</p>
              ) : (
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-2 font-semibold text-gray-500">Year</th>
                      <th className="text-right px-4 py-2 font-semibold text-gray-500">Roll</th>
                      <th className="text-right px-4 py-2 font-semibold text-gray-500">SEND</th>
                      <th className="text-right px-4 py-2 font-semibold text-gray-500">ILPs</th>
                      <th className="text-right px-4 py-2 font-semibold text-gray-500">EHCPs</th>
                      <th className="text-right px-4 py-2 font-semibold text-gray-500">Concerns</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.byYear.map(row => (
                      <tr key={row.yearGroup} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">Year {row.yearGroup}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{row.students}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="font-semibold text-blue-700">{row.sendStudents}</span>
                          <span className="text-gray-400 ml-1">({row.sendPct}%)</span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{row.activeIlps}</td>
                        <td className="px-4 py-2.5 text-right text-purple-700">{row.ehcps}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={row.openConcerns > 0 ? 'text-rose-600 font-semibold' : 'text-gray-400'}>
                            {row.openConcerns}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Concerns by category */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Icon name="warning" size="sm" className="text-amber-500" />
                <h2 className="text-[14px] font-semibold text-gray-900">Open concerns by category</h2>
              </div>
              {data.concernsByCategory.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <Icon name="check_circle" size="lg" color="#d1d5db" />
                  <p className="text-[13px] text-gray-400 mt-2">No open concerns.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {data.concernsByCategory.map(c => {
                    const maxCount = data.concernsByCategory[0]?.count ?? 1
                    const pct = Math.round((c.count / maxCount) * 100)
                    return (
                      <div key={c.category} className="px-5 py-3 flex items-center gap-3">
                        <p className="text-[12px] font-medium text-gray-700 w-32 shrink-0">
                          {CATEGORY_LABELS[c.category] ?? c.category}
                        </p>
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[12px] font-semibold text-gray-700 w-6 text-right">{c.count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Alerts */}
          {(data.ehcpsDue30d > 0 || data.ilpsUnderReview > 0) && (
            <div className="mt-5 space-y-3">
              {data.ehcpsDue30d > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-3">
                  <Icon name="schedule" size="sm" className="text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-amber-800">
                      {data.ehcpsDue30d} EHCP annual review{data.ehcpsDue30d !== 1 ? 's' : ''} due in the next 30 days
                    </p>
                    <p className="text-[12px] text-amber-600 mt-0.5">Review in EHCP Plans to action.</p>
                  </div>
                  <Link href="/senco/ehcp" className="text-[12px] font-semibold text-amber-700 underline shrink-0">View</Link>
                </div>
              )}
              {data.ilpsUnderReview > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-center gap-3">
                  <Icon name="pending" size="sm" className="text-blue-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-blue-800">
                      {data.ilpsUnderReview} ILP{data.ilpsUnderReview !== 1 ? 's' : ''} currently under review
                    </p>
                    <p className="text-[12px] text-blue-600 mt-0.5">Awaiting SENCO approval.</p>
                  </div>
                  <Link href="/senco/ilp" className="text-[12px] font-semibold text-blue-700 underline shrink-0">View</Link>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </AppShell>
  )
}
