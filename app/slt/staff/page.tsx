import { requireAuth }     from '@/lib/session'
import { redirect }        from 'next/navigation'
import Link                from 'next/link'
import AppShell            from '@/components/AppShell'
import Icon                from '@/components/ui/Icon'
import { getStaffOverview, type StaffOverviewRow } from '@/app/actions/analytics-staff'
import { gradeLabel, gradePillClass } from '@/lib/grading'

export const dynamic = 'force-dynamic'

function ragGrade(g: number | null): string {
  if (g == null) return 'text-gray-400'
  if (g >= 6)   return 'text-emerald-700'
  if (g >= 4)   return 'text-amber-700'
  return 'text-rose-700'
}


function SubmissionBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100)
  const colour = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-rose-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[60px]">
        <div className={`h-1.5 rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-600">{pct}%</span>
    </div>
  )
}

function CsvExportButton({ rows }: { rows: StaffOverviewRow[] }) {
  // Build CSV client-side via a data: URL anchor
  const headers = ['Name', 'Email', 'Department', 'Classes', 'Students', 'SEND', 'Avg Grade', 'Submission %', 'HW (30d)', 'Turnaround (days)']
  const csvRows = rows.map(r => [
    r.name, r.email, r.department, r.classCount, r.studentCount, r.sendCount,
    r.avgGrade ?? '', Math.round(r.submissionRate * 100), r.homeworkSet30d,
    r.turnaroundDays ?? '',
  ])
  const csv = [headers, ...csvRows].map(row => row.join(',')).join('\n')
  const href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`

  return (
    <a
      href={href}
      download="staff-overview.csv"
      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <Icon name="download" size="sm" />
      Export CSV
    </a>
  )
}

export default async function SltStaffPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  const rows = await getStaffOverview()

  const avgGrades = rows.map(r => r.avgGrade).filter((g): g is number => g != null)
  const overallAvg = avgGrades.length > 0
    ? Math.round(avgGrades.reduce((a, b) => a + b, 0) / avgGrades.length * 10) / 10
    : null

  const totalStudents  = rows.reduce((s, r) => s + r.studentCount, 0)
  const totalHw30      = rows.reduce((s, r) => s + r.homeworkSet30d, 0)
  const lowGradeCount  = rows.filter(r => (r.avgGrade ?? 10) < 4).length

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/slt/analytics" className="text-gray-400 hover:text-gray-600">
              <Icon name="arrow_back" size="sm" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Staff Overview</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                School-wide teacher performance — {rows.length} teachers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/analytics/department"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Icon name="domain" size="sm" />
              Department view
            </Link>
            <CsvExportButton rows={rows} />
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Teachers',     value: rows.length,   icon: 'person',     colour: 'text-indigo-700' },
            { label: 'Students',     value: totalStudents, icon: 'groups',     colour: 'text-blue-700'   },
            { label: 'HW set (30d)', value: totalHw30,     icon: 'assignment', colour: 'text-teal-700'   },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon name={s.icon} size="sm" className="text-gray-400" />
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
              <p className={`text-2xl font-bold ${s.colour}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Summary bar */}
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex flex-wrap items-center gap-6 text-sm">
          <span className="text-gray-500">School avg grade:</span>
          {overallAvg != null ? (
            <span className={`font-bold text-base ${ragGrade(overallAvg)}`}>
              {gradeLabel(Math.round(overallAvg))} <span className="text-xs font-normal text-gray-400">({overallAvg.toFixed(1)} avg)</span>
            </span>
          ) : <span className="text-gray-400">No data</span>}
          {lowGradeCount > 0 && (
            <span className="ml-auto flex items-center gap-1.5 text-rose-600 font-medium text-xs">
              <Icon name="warning" size="sm" />
              {lowGradeCount} teacher{lowGradeCount !== 1 ? 's' : ''} with avg below grade 4
            </span>
          )}
        </div>

        {/* Teacher table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Teacher</th>
                <th className="px-4 py-3 text-left">Dept</th>
                <th className="px-4 py-3 text-center">Classes</th>
                <th className="px-4 py-3 text-center">Students</th>
                <th className="px-4 py-3 text-center">SEND</th>
                <th className="px-4 py-3 text-left">Avg Grade</th>
                <th className="px-4 py-3 text-left">Submission</th>
                <th className="px-4 py-3 text-center">HW 30d</th>
                <th className="px-4 py-3 text-center">Turnaround</th>
                <th className="px-4 py-3 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400 text-sm">
                    No teacher data available. Run MIS sync or assign classes to staff.
                  </td>
                </tr>
              )}
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.department}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{r.classCount}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{r.studentCount}</td>
                  <td className="px-4 py-3 text-center">
                    {r.sendCount > 0 ? (
                      <span className="text-purple-700 font-medium">{r.sendCount}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.avgGrade != null ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${gradePillClass(Math.round(r.avgGrade))}`}>
                        {gradeLabel(Math.round(r.avgGrade))}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">No data</span>
                    )}
                  </td>
                  <td className="px-4 py-3 min-w-[120px]">
                    <SubmissionBar rate={r.submissionRate} />
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">{r.homeworkSet30d}</td>
                  <td className="px-4 py-3 text-center text-gray-600 tabular-nums">
                    {r.turnaroundDays != null ? `${r.turnaroundDays}d` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/analytics/teacher?teacherId=${r.id}`}
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                    >
                      View <Icon name="arrow_forward" size="sm" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
