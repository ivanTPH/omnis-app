import { requireAuth }          from '@/lib/session'
import { redirect }             from 'next/navigation'
import Link                     from 'next/link'
import AppShell                 from '@/components/AppShell'
import Icon                     from '@/components/ui/Icon'
import { getAbsenceSummary }    from '@/app/actions/hoy-welfare'

export const dynamic = 'force-dynamic'

const ALLOWED = ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN']

function RagBar({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-gray-400 text-[11px]">N/A</span>
  const color = pct < 85 ? 'bg-rose-500' : pct < 90 ? 'bg-amber-400' : pct < 95 ? 'bg-yellow-300' : 'bg-emerald-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-[11px] font-semibold text-gray-700 w-10 text-right">{pct.toFixed(1)}%</span>
    </div>
  )
}

function SendBadge({ status }: { status: string | null }) {
  if (!status) return null
  const isEhcp = status === 'EHCP'
  return (
    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${isEhcp ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
      {isEhcp ? 'EHCP' : 'SEN'}
    </span>
  )
}

export default async function HoyAbsencePage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/dashboard')

  const data = await getAbsenceSummary()

  const statCards = [
    { label: 'Total students', value: data.totalStudents,                  color: 'bg-blue-50 text-blue-700'   },
    { label: 'Below 95%',      value: data.below95,                        color: 'bg-yellow-50 text-yellow-700' },
    { label: 'Below 90%',      value: data.below90,                        color: 'bg-amber-50 text-amber-700'  },
    { label: 'Below 85%',      value: data.below85,                        color: 'bg-rose-50 text-rose-700'    },
    { label: 'School avg',     value: data.avgAttendance != null ? `${data.avgAttendance}%` : '—', color: 'bg-gray-50 text-gray-700' },
  ]

  const flagged = data.students.filter(s => s.attendancePct != null && s.attendancePct < 90)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Link href="/hoy/dashboard" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <Icon name="chevron_left" size="sm" /> HOY Dashboard
            </Link>
          </div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">Absence Hub</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">
                {data.yearGroup ? `Year ${data.yearGroup} attendance overview` : 'School-wide attendance overview'}
              </p>
            </div>
            <Link
              href="/admin/attendance"
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Icon name="open_in_new" size="sm" />
              Full overview
            </Link>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {statCards.map(c => (
              <div key={c.label} className={`rounded-xl p-4 ${c.color}`}>
                <p className="text-[11px] font-semibold opacity-70 mb-1">{c.label}</p>
                <p className="text-[22px] font-bold">{c.value}</p>
              </div>
            ))}
          </div>

          {/* Students below 90% */}
          {flagged.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl py-12 text-center">
              <Icon name="check_circle" size="lg" color="#d1d5db" />
              <p className="text-sm text-gray-500 mt-3">No students below 90% attendance.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Icon name="warning" size="sm" className="text-amber-500" />
                <h2 className="text-[14px] font-semibold text-gray-900">Students below 90% attendance</h2>
                <span className="ml-auto text-[11px] text-gray-400">{flagged.length} students</span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Student</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden sm:table-cell">SEND</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden md:table-cell">Open concerns</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 w-40">Attendance</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-500 hidden lg:table-cell">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {flagged.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/students/${s.id}?tab=Pastoral`}
                          className="font-medium text-gray-900 hover:text-indigo-700 hover:underline"
                        >
                          {s.name}
                        </Link>
                        {s.yearGroup && <p className="text-[10px] text-gray-400">Year {s.yearGroup}</p>}
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <SendBadge status={s.sendStatus} />
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        {s.openConcerns > 0 ? (
                          <span className="text-rose-600 font-semibold">{s.openConcerns}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 w-40">
                        <RagBar pct={s.attendancePct} />
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/api/export/attendance-letter/${s.id}`}
                            target="_blank"
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors"
                          >
                            <Icon name="mail" size="sm" />
                            Letter
                          </Link>
                          <Link
                            href={`/api/export/report-card/${s.id}`}
                            target="_blank"
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors"
                          >
                            <Icon name="picture_as_pdf" size="sm" />
                            Report
                          </Link>
                          <Link
                            href={`/students/${s.id}?tab=Pastoral`}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors"
                          >
                            <Icon name="eco" size="sm" />
                            Pastoral
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </main>
    </AppShell>
  )
}
