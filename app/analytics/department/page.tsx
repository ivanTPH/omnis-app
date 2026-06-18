import { redirect }          from 'next/navigation'
import Link                  from 'next/link'
import AppShell              from '@/components/AppShell'
import Icon                  from '@/components/ui/Icon'
import { requireAuth }       from '@/lib/session'
import { gradeLabel, gradePillClass } from '@/lib/grading'
import { getDepartmentAnalytics } from '@/app/actions/analytics-staff'
import DepartmentSelector    from './DepartmentSelector'

export const dynamic = 'force-dynamic'

const ALLOWED = ['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN']

const BLOOMS_COLOUR: Record<string, string> = {
  remember:   'bg-blue-100 text-blue-700',
  understand: 'bg-indigo-100 text-indigo-700',
  apply:      'bg-violet-100 text-violet-700',
  analyse:    'bg-amber-100 text-amber-700',
  evaluate:   'bg-orange-100 text-orange-700',
  create:     'bg-rose-100 text-rose-700',
}

const BLOOMS_ALL = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create']

export default async function DepartmentAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string }>
}) {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/analytics')

  const { dept } = await searchParams
  const data = await getDepartmentAnalytics(dept)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          <div className="flex items-center gap-2 mb-1">
            <Link href="/analytics" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <Icon name="chevron_left" size="sm" /> Analytics
            </Link>
          </div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">Department Analytics</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">{data.department} — cross-teacher performance comparison</p>
            </div>
            <Link
              href="/analytics/teacher"
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <Icon name="person" size="sm" />
              Teacher view
            </Link>
          </div>

          {/* Department selector — only shown for SLT/SCHOOL_ADMIN */}
          {role !== 'HEAD_OF_DEPT' && data.departments.length > 1 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
              <label className="text-[12px] font-semibold text-gray-500 block mb-2">Department</label>
              <DepartmentSelector departments={data.departments} selected={dept ?? ''} />
            </div>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Teachers',  value: data.totals.teachers,                                              colour: 'bg-blue-50 text-blue-700'    },
              { label: 'Classes',   value: data.totals.classes,                                               colour: 'bg-indigo-50 text-indigo-700' },
              { label: 'Students',  value: data.totals.students,                                              colour: 'bg-gray-50 text-gray-700'    },
              { label: 'SEND %',    value: `${data.totals.sendPct}%`,                                         colour: 'bg-purple-50 text-purple-700' },
              { label: 'Ungraded',  value: data.totals.ungraded,                                              colour: data.totals.ungraded > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700' },
            ].map(c => (
              <div key={c.label} className={`rounded-xl p-4 ${c.colour}`}>
                <p className="text-[11px] font-semibold opacity-70 mb-1">{c.label}</p>
                <p className="text-[22px] font-bold leading-none">{c.value}</p>
              </div>
            ))}
          </div>

          {/* Avg grade card */}
          {data.totals.avgGrade != null && (
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-6 flex items-center gap-4">
              <div>
                <p className="text-[11px] font-semibold text-gray-400 mb-1">Department avg GCSE grade</p>
                <span className={`inline-block px-4 py-1.5 rounded-full text-[16px] font-bold ${gradePillClass(Math.round(data.totals.avgGrade))}`}>
                  {gradeLabel(Math.round(data.totals.avgGrade))}
                </span>
              </div>
              <div className="h-8 w-px bg-gray-100 mx-2" />
              <p className="text-[12px] text-gray-400">Aggregate across all teachers and classes in {data.department}</p>
            </div>
          )}

          {/* Teacher comparison table */}
          {data.teachers.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl py-14 text-center">
              <Icon name="school" size="lg" color="#d1d5db" />
              <p className="text-sm text-gray-400 mt-3">No teachers found for this department</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <h2 className="text-[14px] font-semibold text-gray-900">Teacher comparison</h2>
                <span className="ml-auto text-[11px] text-gray-400">{data.teachers.length} teachers</span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Teacher</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500 hidden sm:table-cell">Classes</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Students</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500 hidden md:table-cell">SEND</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Avg grade</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500 hidden lg:table-cell">HW 30d</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Ungraded</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden lg:table-cell"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.teachers.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{t.name}</td>
                      <td className="px-4 py-2.5 text-right hidden sm:table-cell text-gray-600">{t.classCount}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{t.studentCount}</td>
                      <td className="px-4 py-2.5 text-right hidden md:table-cell text-gray-500">{t.sendCount}</td>
                      <td className="px-4 py-2.5">
                        {t.avgGrade != null ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${gradePillClass(Math.round(t.avgGrade))}`}>
                            {gradeLabel(Math.round(t.avgGrade))}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right hidden lg:table-cell text-gray-500">{t.homeworkSet30d}</td>
                      <td className="px-4 py-2.5 text-right">
                        {t.ungraded > 0
                          ? <span className="text-amber-600 font-semibold">{t.ungraded}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell">
                        <Link
                          href={`/analytics/teacher?teacherId=${t.id}`}
                          className="text-[11px] text-indigo-600 hover:underline"
                        >
                          Detail →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Bloom's coverage */}
          {data.bloomsCoverage.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-[14px] font-semibold text-gray-900 mb-1">Bloom&apos;s taxonomy — department coverage</h2>
              <p className="text-[12px] text-gray-400 mb-3">Homework tasks logged across all classes in {data.department}</p>
              <div className="space-y-2">
                {BLOOMS_ALL.map(l => {
                  const found  = data.bloomsCoverage.find(b => b.level === l)
                  const count  = found?.count ?? 0
                  const maxCount = Math.max(...data.bloomsCoverage.map(b => b.count), 1)
                  const barPct = Math.round((count / maxCount) * 100)
                  return (
                    <div key={l} className="flex items-center gap-3">
                      <span className={`w-20 shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full text-center ${count > 0 ? (BLOOMS_COLOUR[l] ?? 'bg-gray-100 text-gray-600') : 'bg-gray-50 text-gray-300'}`}>
                        {l.charAt(0).toUpperCase() + l.slice(1)}
                      </span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${count > 0 ? 'bg-indigo-400' : 'bg-gray-100'}`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-gray-500 w-6 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
              {data.bloomsCoverage.length < 6 && (
                <p className="text-[11px] text-amber-600 mt-3 flex items-center gap-1">
                  <Icon name="info" size="sm" />
                  {6 - data.bloomsCoverage.length} Bloom&apos;s level{6 - data.bloomsCoverage.length !== 1 ? 's' : ''} not yet set in any homework across this department
                </p>
              )}
            </div>
          )}

        </div>
      </main>
    </AppShell>
  )
}
