import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { requireAuth } from '@/lib/session'
import { getAcademySchools } from '@/app/actions/academy'
import Icon from '@/components/ui/Icon'

export default async function AcademySendPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['ACADEMY_ADMIN', 'PLATFORM_ADMIN'].includes(role)) redirect('/dashboard')

  const schools = await getAcademySchools()

  const totalSend    = schools.reduce((n, s) => n + s.sendStudents, 0)
  const totalIlps    = schools.reduce((n, s) => n + s.activeIlps, 0)
  const totalEhcps   = schools.reduce((n, s) => n + s.ehcps, 0)
  const totalConcerns = schools.reduce((n, s) => n + s.openConcerns, 0)
  const totalStudents = schools.reduce((n, s) => n + s.studentCount, 0)
  const sendPct = totalStudents > 0 ? Math.round((totalSend / totalStudents) * 100) : 0

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8 space-y-6">
          <PageHeader
            title="SEND Overview"
            subtitle="Special Educational Needs & Disabilities — trust-wide"
            backHref="/academy/dashboard"
            backLabel="Academy Dashboard"
          />

          {/* Trust totals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'On SEND Register',  value: `${totalSend.toLocaleString()} (${sendPct}%)`, icon: 'favorite',       colour: 'text-purple-600' },
              { label: 'Active ILPs',        value: totalIlps.toLocaleString(),                   icon: 'description',    colour: 'text-amber-600'  },
              { label: 'EHCP Plans',         value: totalEhcps.toLocaleString(),                  icon: 'fact_check',     colour: 'text-rose-600'   },
              { label: 'Open Concerns',      value: totalConcerns.toLocaleString(),               icon: 'report_problem', colour: 'text-orange-600' },
            ].map(({ label, value, icon, colour }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon name={icon} size="sm" className={colour} />
                  <p className="text-[11px] text-gray-400 font-medium">{label}</p>
                </div>
                <p className={`text-[24px] font-bold ${colour}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Per-school breakdown */}
          <div>
            <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Per-school breakdown
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-semibold text-gray-500">School</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500">Students</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500">SEND</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500">SEND %</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500">ILPs</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500">EHCPs</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500">Open Concerns</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {schools.map(s => {
                    const pct = s.studentCount > 0
                      ? Math.round((s.sendStudents / s.studentCount) * 100) : 0
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{s.studentCount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={s.sendStudents > 0 ? 'text-purple-700 font-medium' : 'text-gray-300'}>
                            {s.sendStudents > 0 ? s.sendStudents : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {s.sendStudents > 0 ? (
                            <span className={`font-medium ${pct >= 20 ? 'text-amber-600' : 'text-gray-600'}`}>
                              {pct}%
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={s.activeIlps > 0 ? 'text-amber-700 font-medium' : 'text-gray-300'}>
                            {s.activeIlps > 0 ? s.activeIlps : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={s.ehcps > 0 ? 'text-rose-700 font-medium' : 'text-gray-300'}>
                            {s.ehcps > 0 ? s.ehcps : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {s.openConcerns > 0 ? (
                            <span className="inline-flex items-center justify-end gap-1 text-orange-600 font-medium">
                              <Icon name="report_problem" size="sm" />
                              {s.openConcerns}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Totals row */}
                  <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
                    <td className="px-4 py-3 text-gray-700">Trust Total</td>
                    <td className="px-4 py-3 text-right text-gray-700">{totalStudents.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-purple-700">{totalSend.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{sendPct}%</td>
                    <td className="px-4 py-3 text-right text-amber-700">{totalIlps}</td>
                    <td className="px-4 py-3 text-right text-rose-700">{totalEhcps}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{totalConcerns}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  )
}
