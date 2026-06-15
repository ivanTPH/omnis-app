import { requireAuth }         from '@/lib/session'
import { redirect }            from 'next/navigation'
import AppShell                from '@/components/AppShell'
import Link                    from 'next/link'
import Icon                    from '@/components/ui/Icon'
import { getHodDashboardData } from '@/app/actions/hod'
import { formatAvgGrade }      from '@/lib/gradeUtils'

export const dynamic = 'force-dynamic'

const RAG_COLOR = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-400',
  red:   'bg-red-500',
}

export default async function HodDashboardPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  const data = await getHodDashboardData()

  const gradeDisplay = data.avgScore != null ? formatAvgGrade(data.avgScore) : null
  const completionPct = data.avgCompletion != null ? Math.round(data.avgCompletion * 100) : null

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">{data.department} Department</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">
                {schoolName} · {data.subjects.join(', ')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/api/export/department-report"
                target="_blank"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-purple-200 bg-white hover:bg-purple-50 text-purple-700 transition-colors"
              >
                <Icon name="picture_as_pdf" size="sm" />
                Dept Report PDF
              </Link>
              <Link
                href="/hod/curriculum"
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <Icon name="map" size="sm" />
                Curriculum Map
              </Link>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
            {[
              { label: 'Classes',     value: data.totalClasses,   color: 'text-gray-900' },
              { label: 'Students',    value: data.totalStudents,  color: 'text-gray-900' },
              { label: 'Staff',       value: data.staff.length,   color: 'text-gray-900' },
              { label: 'SEND',        value: data.sendStudents,   color: data.sendStudents > 0 ? 'text-amber-600' : 'text-gray-300' },
              { label: 'Avg Grade',   value: gradeDisplay?.main ?? '—', color: 'text-blue-600' },
              { label: 'Completion',  value: completionPct != null ? `${completionPct}%` : '—', color: 'text-gray-900' },
              { label: 'To Mark',     value: data.totalUngraded,  color: data.totalUngraded > 0 ? 'text-rose-600' : 'text-gray-300' },
            ].map(k => (
              <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className={`text-[22px] font-bold ${k.color}`}>{k.value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Class performance table */}
            <div className="lg:col-span-2">
              <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Class Performance
              </h2>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Class</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden sm:table-cell">Teacher</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Students</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Avg</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Done</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-gray-500">RAG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.classes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-[12px] text-gray-400">
                          No classes found for this department.
                        </td>
                      </tr>
                    ) : data.classes.map(cls => {
                      const grade = cls.avgScore != null ? formatAvgGrade(cls.avgScore) : null
                      const comp  = cls.completionRate != null ? `${Math.round(cls.completionRate * 100)}%` : '—'
                      return (
                        <tr key={cls.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5">
                            <p className="font-semibold text-gray-900">{cls.name}</p>
                            <p className="text-[10px] text-gray-400">Y{cls.yearGroup} · {cls.subject}</p>
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell text-gray-600">
                            {cls.teacherNames.join(', ') || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-700">
                            {cls.studentCount}
                            {cls.sendCount > 0 && (
                              <span className="ml-1 text-[10px] text-amber-600">({cls.sendCount} SEND)</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                            {grade ? grade.main : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-600">{comp}</td>
                          <td className="px-4 py-2.5 text-center">
                            {cls.rag ? (
                              <span className={`inline-block w-2.5 h-2.5 rounded-full ${RAG_COLOR[cls.rag]}`} />
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Ungraded alert */}
              {data.totalUngraded > 0 && (
                <div className="mt-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <Icon name="pending_actions" size="sm" className="text-rose-600 shrink-0" />
                  <p className="text-[12px] text-rose-800">
                    <span className="font-semibold">{data.totalUngraded} submission{data.totalUngraded !== 1 ? 's' : ''}</span> awaiting marking across the department.
                  </p>
                  <Link href="/homework" className="ml-auto text-[11px] font-semibold text-rose-700 hover:underline shrink-0">
                    View →
                  </Link>
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="space-y-5">

              {/* Staff workload */}
              <div>
                <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Staff Workload
                </h2>
                <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-50">
                  {data.staff.length === 0 ? (
                    <p className="px-4 py-4 text-[12px] text-gray-400">No staff assigned.</p>
                  ) : data.staff.map(s => {
                    const g = s.avgScore != null ? formatAvgGrade(s.avgScore) : null
                    return (
                      <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-gray-900 truncate">{s.name}</p>
                          <p className="text-[10px] text-gray-400">{s.classCount} class{s.classCount !== 1 ? 'es' : ''} · {s.studentCount} students</p>
                        </div>
                        <div className="text-right shrink-0">
                          {g && <p className="text-[11px] font-semibold text-gray-700">{g.main}</p>}
                          {s.ungradedCount > 0 && (
                            <p className="text-[10px] text-rose-600 font-semibold">{s.ungradedCount} to mark</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* SEND summary */}
              <div>
                <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  SEND Summary
                </h2>
                <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-50">
                  {[
                    { label: 'SEND students',  value: data.sendStudents,  icon: 'favorite',     color: 'text-amber-600' },
                    { label: 'Active ILPs',    value: data.activeIlps,   icon: 'description',  color: 'text-blue-600'  },
                    { label: 'Open concerns',  value: data.openConcerns, icon: 'report_problem', color: data.openConcerns > 0 ? 'text-rose-600' : 'text-gray-400' },
                  ].map(item => (
                    <div key={item.label} className="px-4 py-3 flex items-center gap-3">
                      <Icon name={item.icon} size="sm" className={item.color} />
                      <span className="text-[12px] text-gray-700 flex-1">{item.label}</span>
                      <span className={`text-[13px] font-bold ${item.color}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick links */}
              <div>
                <h2 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Quick Access
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Analytics',    href: '/analytics',            icon: 'bar_chart'     },
                    { label: 'Homework',     href: '/homework',             icon: 'assignment'    },
                    { label: 'SEND Concerns',href: '/senco/concerns',       icon: 'warning'       },
                    { label: 'AI Generator', href: '/ai-generator',         icon: 'auto_awesome'  },
                  ].map(l => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="flex flex-col items-center gap-1 p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-200 hover:shadow-sm transition text-center"
                    >
                      <Icon name={l.icon} size="md" className="text-blue-600" />
                      <span className="text-[10px] font-semibold text-gray-600">{l.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </AppShell>
  )
}
