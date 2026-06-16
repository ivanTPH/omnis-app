import { requireAuth }       from '@/lib/session'
import { redirect }          from 'next/navigation'
import Link                  from 'next/link'
import AppShell              from '@/components/AppShell'
import Icon                  from '@/components/ui/Icon'
import SendBadge             from '@/components/ui/SendBadge'
import { getHodClassDetail } from '@/app/actions/hod'
import { gradeLabel, gradePillClass } from '@/lib/grading'

export const dynamic = 'force-dynamic'

const ALLOWED = ['HEAD_OF_DEPT', 'SLT', 'SCHOOL_ADMIN']

export default async function HodClassDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/dashboard')

  const detail = await getHodClassDetail(classId)
  if (!detail) redirect('/hod/performance')

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          <div className="flex items-center gap-2 mb-1">
            <Link href="/hod/performance" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <Icon name="chevron_left" size="sm" /> Department Performance
            </Link>
          </div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">{detail.className}</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">
                {detail.subject} · Year {detail.yearGroup} · {detail.students.length} students
              </p>
            </div>
          </div>

          {detail.students.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl py-12 text-center">
              <Icon name="groups" size="lg" color="#d1d5db" />
              <p className="text-sm text-gray-500 mt-3">No students enrolled in this class.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="groups" size="sm" className="text-blue-600" />
                  <h2 className="text-[14px] font-semibold text-gray-900">Student breakdown</h2>
                </div>
                <p className="text-[11px] text-gray-400">Avg grade based on last 5 returned homeworks</p>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Student</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-gray-500">SEND</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Avg grade</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Late submissions</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {detail.students.map(s => {
                    const grade = s.avgScore != null ? gradeLabel(Math.round(s.avgScore)) : '—'
                    const pill  = s.avgScore != null ? gradePillClass(Math.round(s.avgScore)) : 'bg-gray-100 text-gray-400'
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          {s.firstName} {s.lastName}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {s.sendStatus ? (
                            <SendBadge status={s.sendStatus as 'SEN_SUPPORT' | 'EHCP'} size="sm" />
                          ) : (
                            <span className="text-gray-200">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold ${pill}`}>
                            {grade}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={s.lateCount > 0 ? 'text-amber-700 font-semibold' : 'text-gray-300'}>
                            {s.lateCount > 0 ? s.lateCount : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/students/${s.id}`}
                            className="text-[11px] font-semibold text-blue-600 hover:underline"
                          >
                            Profile
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  )
}
