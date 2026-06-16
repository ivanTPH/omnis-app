import { requireAuth }          from '@/lib/session'
import { redirect }             from 'next/navigation'
import Link                     from 'next/link'
import AppShell                 from '@/components/AppShell'
import Icon                     from '@/components/ui/Icon'
import { getHodDashboardData }  from '@/app/actions/hod'
import { gradeLabel, gradePillClass } from '@/lib/grading'

export const dynamic = 'force-dynamic'

const ALLOWED = ['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN']

export default async function HodPerformancePage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/dashboard')

  const data = await getHodDashboardData()

  const avgGradeLabel = data.avgScore != null ? gradeLabel(Math.round(data.avgScore)) : '—'
  const avgPillClass  = data.avgScore != null ? gradePillClass(Math.round(data.avgScore)) : 'bg-gray-100 text-gray-500'

  const completionPct = data.avgCompletion != null
    ? Math.round(data.avgCompletion * 100)
    : null

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Link href="/hod/dashboard" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <Icon name="chevron_left" size="sm" /> HOD Dashboard
            </Link>
          </div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">Department Performance</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">
                {data.department} · {data.subjects.join(', ') || 'All subjects'}
              </p>
            </div>
            <Link
              href="/analytics"
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Icon name="open_in_new" size="sm" /> Full Analytics
            </Link>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[11px] font-semibold text-gray-400 mb-1">Classes</p>
              <p className="text-[26px] font-bold text-gray-900 leading-none">{data.totalClasses}</p>
              <p className="text-[10px] text-gray-400 mt-1">{data.subjects.length} subject{data.subjects.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[11px] font-semibold text-gray-400 mb-1">Students</p>
              <p className="text-[26px] font-bold text-gray-900 leading-none">{data.totalStudents}</p>
              <p className="text-[10px] text-gray-400 mt-1">{data.sendStudents} SEND</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[11px] font-semibold text-gray-400 mb-1">Avg grade</p>
              <div className={`inline-flex items-center px-2 py-0.5 rounded text-[13px] font-bold mt-0.5 ${avgPillClass}`}>
                {avgGradeLabel}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">dept average</p>
            </div>
            <div className={`rounded-xl p-4 ${data.totalUngraded > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-gray-200'}`}>
              <p className="text-[11px] font-semibold text-gray-400 mb-1">Ungraded</p>
              <p className={`text-[26px] font-bold leading-none ${data.totalUngraded > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                {data.totalUngraded}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">submissions</p>
            </div>
          </div>

          {/* Completion bar */}
          {completionPct != null && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[12px] font-semibold text-gray-700">Homework completion rate</p>
                  <p className="text-[12px] font-bold text-gray-900">{completionPct}%</p>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      completionPct >= 80 ? 'bg-emerald-500'
                      : completionPct >= 60 ? 'bg-amber-400'
                      : 'bg-rose-500'
                    }`}
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Class table */}
          {data.classes.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Icon name="groups" size="sm" className="text-blue-600" />
                <h2 className="text-[14px] font-semibold text-gray-900">Classes</h2>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Class</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Teachers</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Students</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">SEND</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Avg grade</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Ungraded</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-gray-500">RAG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.classes.map(cls => {
                    const grade = cls.avgScore != null ? gradeLabel(Math.round(cls.avgScore)) : '—'
                    const pill  = cls.avgScore != null ? gradePillClass(Math.round(cls.avgScore)) : 'bg-gray-100 text-gray-400'
                    return (
                      <tr key={cls.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          <span>{cls.name}</span>
                          <span className="ml-1.5 text-[10px] text-gray-400">Y{cls.yearGroup}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">
                          {cls.teacherNames.slice(0, 2).join(', ')}
                          {cls.teacherNames.length > 2 && ` +${cls.teacherNames.length - 2}`}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{cls.studentCount}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={cls.sendCount > 0 ? 'text-blue-700 font-semibold' : 'text-gray-400'}>
                            {cls.sendCount || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold ${pill}`}>
                            {grade}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={cls.ungradedCount > 0 ? 'text-amber-700 font-semibold' : 'text-gray-400'}>
                            {cls.ungradedCount || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {cls.rag ? (
                            <span className={`inline-block w-3 h-3 rounded-full ${
                              cls.rag === 'green' ? 'bg-emerald-500'
                              : cls.rag === 'amber' ? 'bg-amber-400'
                              : 'bg-rose-500'
                            }`} />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Staff table */}
          {data.staff.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Icon name="manage_accounts" size="sm" className="text-indigo-600" />
                <h2 className="text-[14px] font-semibold text-gray-900">Staff</h2>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Teacher</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Classes</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Students</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Avg grade</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Ungraded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.staff.map(s => {
                    const grade = s.avgScore != null ? gradeLabel(Math.round(s.avgScore)) : '—'
                    const pill  = s.avgScore != null ? gradePillClass(Math.round(s.avgScore)) : 'bg-gray-100 text-gray-400'
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{s.name}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{s.classCount}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{s.studentCount}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold ${pill}`}>
                            {grade}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={s.ungradedCount > 0 ? 'text-amber-700 font-semibold' : 'text-gray-400'}>
                            {s.ungradedCount || '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {data.classes.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl py-12 text-center">
              <Icon name="bar_chart" size="lg" color="#d1d5db" />
              <p className="text-sm text-gray-500 mt-3">No class data available yet.</p>
              <p className="text-[12px] text-gray-400 mt-1">Performance data will appear once homework has been marked.</p>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  )
}
