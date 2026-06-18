import { redirect }             from 'next/navigation'
import Link                      from 'next/link'
import AppShell                  from '@/components/AppShell'
import Icon                      from '@/components/ui/Icon'
import { requireAuth }           from '@/lib/session'
import { gradeLabel, gradePillClass } from '@/lib/grading'
import {
  getTeacherList,
  getTeacherAnalytics,
} from '@/app/actions/analytics-staff'
import TeacherSelector           from './TeacherSelector'

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

function pct(v: number) { return `${Math.round(v * 100)}%` }

export default async function TeacherAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ teacherId?: string }>
}) {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/analytics')

  const { teacherId } = await searchParams
  const [teachers, data] = await Promise.all([
    getTeacherList(),
    teacherId ? getTeacherAnalytics(teacherId) : null,
  ])

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
              <h1 className="text-[22px] font-bold text-gray-900">Teacher Analytics</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">Per-teacher class and homework performance</p>
            </div>
            <Link
              href="/analytics/department"
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <Icon name="domain" size="sm" />
              Department view
            </Link>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
            <label className="text-[12px] font-semibold text-gray-500 block mb-2">Select teacher</label>
            <TeacherSelector teachers={teachers} selectedId={teacherId} />
          </div>

          {!teacherId && (
            <div className="bg-white border border-gray-200 rounded-xl py-14 text-center">
              <Icon name="person_search" size="lg" color="#d1d5db" />
              <p className="text-sm text-gray-400 mt-3">Choose a teacher above to view their analytics</p>
            </div>
          )}

          {teacherId && !data && (
            <div className="bg-white border border-gray-200 rounded-xl py-14 text-center">
              <Icon name="error_outline" size="lg" color="#d1d5db" />
              <p className="text-sm text-gray-400 mt-3">Teacher not found</p>
            </div>
          )}

          {data && (
            <>
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                  {data.teacher.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{data.teacher.name}</p>
                  <p className="text-[12px] text-gray-400">{data.teacher.email} · {data.teacher.department}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                {[
                  { label: 'Classes',    value: data.totals.classes,        colour: 'bg-blue-50 text-blue-700'   },
                  { label: 'Students',   value: data.totals.students,       colour: 'bg-gray-50 text-gray-700'   },
                  { label: 'HW set 30d', value: data.totals.homeworkSet30d, colour: 'bg-indigo-50 text-indigo-700' },
                  { label: 'Ungraded',   value: data.totals.ungraded,       colour: data.totals.ungraded > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700' },
                ].map(c => (
                  <div key={c.label} className={`rounded-xl p-4 ${c.colour}`}>
                    <p className="text-[11px] font-semibold opacity-70 mb-1">{c.label}</p>
                    <p className="text-[26px] font-bold leading-none">{c.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-[11px] font-semibold text-gray-400 mb-2">Avg GCSE grade</p>
                  {data.totals.avgGrade != null ? (
                    <span className={`inline-block px-3 py-1 rounded-full text-[15px] font-bold ${gradePillClass(Math.round(data.totals.avgGrade))}`}>
                      {gradeLabel(Math.round(data.totals.avgGrade))}
                    </span>
                  ) : <p className="text-[22px] font-bold text-gray-300">—</p>}
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-[11px] font-semibold text-gray-400 mb-1">SEND students</p>
                  <p className="text-[26px] font-bold text-gray-900 leading-none">{data.totals.sendStudents}</p>
                  {data.totals.students > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {Math.round((data.totals.sendStudents / data.totals.students) * 100)}% of cohort
                    </p>
                  )}
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-[11px] font-semibold text-gray-400 mb-1">Avg marking turnaround</p>
                  <p className="text-[26px] font-bold text-gray-900 leading-none">
                    {data.totals.avgTurnaroundDays != null ? `${data.totals.avgTurnaroundDays}d` : '—'}
                  </p>
                </div>
              </div>

              {data.classes.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <h2 className="text-[14px] font-semibold text-gray-900">Class breakdown</h2>
                  </div>
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Class</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden sm:table-cell">Yr</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Students</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-500 hidden md:table-cell">SEND</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Avg grade</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden lg:table-cell w-36">Submission</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-500 hidden lg:table-cell">HW 30d</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Ungraded</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.classes.map(cls => (
                        <tr key={cls.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-900">{cls.name}</p>
                            <p className="text-[10px] text-gray-400">{cls.subject}</p>
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell text-gray-500">Y{cls.yearGroup}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">{cls.studentCount}</td>
                          <td className="px-4 py-2.5 text-right hidden md:table-cell text-gray-500">{cls.sendCount}</td>
                          <td className="px-4 py-2.5">
                            {cls.avgGrade != null ? (
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${gradePillClass(Math.round(cls.avgGrade))}`}>
                                {gradeLabel(Math.round(cls.avgGrade))}
                              </span>
                            ) : <span className="text-gray-300 text-[12px]">—</span>}
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell">
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-400 rounded-full" style={{ width: pct(cls.submissionRate) }} />
                              </div>
                              <span className="text-gray-500 text-[11px]">{pct(cls.submissionRate)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right hidden lg:table-cell text-gray-500">{cls.homeworkSet30d}</td>
                          <td className="px-4 py-2.5 text-right">
                            {cls.ungraded > 0
                              ? <span className="text-amber-600 font-semibold">{cls.ungraded}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {data.bloomsCoverage.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h2 className="text-[14px] font-semibold text-gray-900 mb-3">Bloom&apos;s taxonomy coverage</h2>
                  <div className="flex flex-wrap gap-2">
                    {BLOOMS_ALL.map(l => {
                      const found = data.bloomsCoverage.find((b: { level: string }) => b.level === l)
                      return (
                        <span
                          key={l}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ${found ? (BLOOMS_COLOUR[l] ?? 'bg-gray-100 text-gray-600') : 'bg-gray-50 text-gray-300 border border-gray-100'}`}
                        >
                          {l.charAt(0).toUpperCase() + l.slice(1)}
                          <span className="opacity-60">{found?.count ?? 0}</span>
                        </span>
                      )
                    })}
                  </div>
                  {data.bloomsCoverage.length < 6 && (
                    <p className="text-[11px] text-amber-600 mt-3 flex items-center gap-1">
                      <Icon name="info" size="sm" />
                      {6 - data.bloomsCoverage.length} Bloom&apos;s level{6 - data.bloomsCoverage.length !== 1 ? 's' : ''} not yet covered in homework
                    </p>
                  )}
                </div>
              )}
            </>
          )}

        </div>
      </main>
    </AppShell>
  )
}
