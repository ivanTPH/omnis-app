import { requireAuth }          from '@/lib/session'
import { redirect }             from 'next/navigation'
import AppShell                 from '@/components/AppShell'
import Link                     from 'next/link'
import Icon                     from '@/components/ui/Icon'
import { getHodCurriculumData } from '@/app/actions/hod'

export const dynamic = 'force-dynamic'

function CoverageBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 30 ? 'bg-amber-400' : 'bg-gray-200'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  )
}

const KS_LABEL: Record<string, string> = {
  ks1: 'KS1', ks2: 'KS2', ks3: 'KS3', ks4: 'KS4', ks5: 'KS5',
}

export default async function HodCurriculumPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  const data = await getHodCurriculumData()

  const overallPct = data.totalOak > 0
    ? Math.round((data.totalUsed / data.totalOak) * 100)
    : 0

  // Group units by keystage
  const byKs = new Map<string, typeof data.units>()
  for (const u of data.units) {
    if (!byKs.has(u.keystage)) byKs.set(u.keystage, [])
    byKs.get(u.keystage)!.push(u)
  }

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/hod/dashboard" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <Icon name="chevron_left" size="sm" /> Department
                </Link>
              </div>
              <h1 className="text-[22px] font-bold text-gray-900">Curriculum Map</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">
                {data.department} · {data.subjects.join(', ')} · Oak National Academy coverage
              </p>
            </div>
            <div className="text-right">
              <p className="text-[28px] font-bold text-blue-600">{overallPct}%</p>
              <p className="text-[11px] text-gray-400">{data.totalUsed}/{data.totalOak} lessons used</p>
            </div>
          </div>

          {data.units.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <Icon name="map" size="lg" className="text-gray-300 mx-auto mb-3" />
              <p className="text-[14px] font-semibold text-gray-500">No Oak lesson data found</p>
              <p className="text-[12px] text-gray-400 mt-1">
                Run an Oak sync from the platform admin panel, or no lessons match your department subjects.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {[...byKs.entries()].sort().map(([ks, units]) => (
                <div key={ks}>
                  <h2 className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    {KS_LABEL[ks] ?? ks.toUpperCase()}
                    <span className="ml-2 font-normal text-gray-400">
                      {units.length} unit{units.length !== 1 ? 's' : ''}
                    </span>
                  </h2>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Unit</th>
                          <th className="text-center px-4 py-2.5 font-semibold text-gray-500 w-16">Year</th>
                          <th className="text-center px-4 py-2.5 font-semibold text-gray-500 w-24">Lessons</th>
                          <th className="px-4 py-2.5 font-semibold text-gray-500 w-48">Coverage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {units.map(u => (
                          <tr key={u.unitSlug} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{u.unitTitle}</p>
                              {u.usedLessons > 0 && (
                                <p className="text-[10px] text-emerald-600 mt-0.5">
                                  {u.usedLessons} lesson{u.usedLessons !== 1 ? 's' : ''} taught
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-500">
                              {u.yearGroup ? `Y${u.yearGroup}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600">
                              {u.usedLessons}/{u.totalLessons}
                            </td>
                            <td className="px-4 py-3">
                              <CoverageBar pct={u.coveragePct} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 flex items-center gap-6 text-[11px] text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> ≥70% covered</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> 30–69%</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" /> &lt;30%</span>
            <span className="ml-auto">Oak National Academy lesson data</span>
          </div>

        </div>
      </main>
    </AppShell>
  )
}
