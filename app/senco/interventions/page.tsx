import { requireAuth }            from '@/lib/session'
import { redirect }               from 'next/navigation'
import Link                       from 'next/link'
import AppShell                   from '@/components/AppShell'
import Icon                       from '@/components/ui/Icon'
import SendBadge                  from '@/components/ui/SendBadge'
import { getSencoInterventions }  from '@/app/actions/send-support'

export const dynamic = 'force-dynamic'

const ALLOWED = ['SENCO', 'SLT', 'SCHOOL_ADMIN']

export default async function SencoInterventionsPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/dashboard')

  const rows = await getSencoInterventions()

  const ehcpDue   = rows.filter(r => r.ehcpDue)
  const highAlert = rows.filter(r => !r.ehcpDue && r.openConcerns >= 2)
  const standard  = rows.filter(r => !r.ehcpDue && r.openConcerns < 2)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Link href="/senco/dashboard" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <Icon name="chevron_left" size="sm" /> SENCO Dashboard
            </Link>
          </div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">Interventions Hub</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">
                All SEND students with active K Plans, ILPs, and open concerns
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">
                {rows.length} students on register
              </span>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl py-12 text-center">
              <Icon name="check_circle" size="lg" color="#d1d5db" />
              <p className="text-sm text-gray-500 mt-3">No active SEND students found.</p>
            </div>
          ) : (
            <div className="space-y-6">

              {/* EHCP due */}
              {ehcpDue.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="schedule" size="sm" className="text-amber-600" />
                    <h2 className="text-[13px] font-semibold text-amber-700">
                      EHCP reviews due within 30 days ({ehcpDue.length})
                    </h2>
                  </div>
                  <InterventionTable rows={ehcpDue} urgency="amber" />
                </section>
              )}

              {/* High concern */}
              {highAlert.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="warning" size="sm" className="text-rose-600" />
                    <h2 className="text-[13px] font-semibold text-rose-700">
                      Multiple open concerns ({highAlert.length})
                    </h2>
                  </div>
                  <InterventionTable rows={highAlert} urgency="rose" />
                </section>
              )}

              {/* Standard */}
              {standard.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="people" size="sm" className="text-gray-500" />
                    <h2 className="text-[13px] font-semibold text-gray-600">
                      All other SEND students ({standard.length})
                    </h2>
                  </div>
                  <InterventionTable rows={standard} urgency="none" />
                </section>
              )}

            </div>
          )}
        </div>
      </main>
    </AppShell>
  )
}

// ── Sub-component ──────────────────────────────────────────────────────────────

type RowProps = Awaited<ReturnType<typeof getSencoInterventions>>[number]

function InterventionTable({ rows, urgency }: {
  rows:    RowProps[]
  urgency: 'amber' | 'rose' | 'none'
}) {
  const borderClass = urgency === 'amber' ? 'border-amber-200'
    : urgency === 'rose' ? 'border-rose-200'
    : 'border-gray-200'

  return (
    <div className={`bg-white border ${borderClass} rounded-xl overflow-hidden`}>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Student</th>
            <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Year</th>
            <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Status</th>
            <th className="text-center px-4 py-2.5 font-semibold text-gray-500">K Plan</th>
            <th className="text-center px-4 py-2.5 font-semibold text-gray-500">ILP targets</th>
            <th className="text-center px-4 py-2.5 font-semibold text-gray-500">Concerns</th>
            <th className="text-left px-4 py-2.5 font-semibold text-gray-500">EHCP due</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map(row => (
            <tr key={row.studentId} className="hover:bg-gray-50">
              <td className="px-4 py-2.5 font-medium text-gray-900">{row.studentName}</td>
              <td className="px-4 py-2.5 text-gray-500">
                {row.yearGroup ? `Y${row.yearGroup}` : '—'}
              </td>
              <td className="px-4 py-2.5">
                {row.sendStatus && row.sendStatus !== 'NONE' && (
                  <SendBadge status={row.sendStatus as 'SEN_SUPPORT' | 'EHCP'} size="sm" />
                )}
              </td>
              <td className="px-4 py-2.5 text-center">
                {row.hasKPlan ? (
                  <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${
                    row.kPlanStatus === 'active' ? 'text-blue-700' : 'text-gray-500'
                  }`}>
                    <Icon name="check" size="sm" />
                    {row.kPlanStatus}
                  </span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-center">
                {row.hasIlp ? (
                  <span className={`font-semibold ${row.ilpTargetCount > 0 ? 'text-indigo-700' : 'text-gray-400'}`}>
                    {row.ilpTargetCount}
                  </span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-center">
                <span className={`font-semibold ${
                  row.openConcerns >= 2 ? 'text-rose-600'
                  : row.openConcerns === 1 ? 'text-amber-600'
                  : 'text-gray-400'
                }`}>
                  {row.openConcerns || '—'}
                </span>
              </td>
              <td className="px-4 py-2.5">
                {row.ehcpDue ? (
                  <span className="text-[11px] font-semibold text-amber-700">
                    {new Date(row.ehcpDue).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                <Link
                  href={`/students/${row.studentId}`}
                  className="text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
