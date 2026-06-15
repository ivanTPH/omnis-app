import { requireAuth } from '@/lib/session'
import { redirect }    from 'next/navigation'
import { prisma }      from '@/lib/prisma'
import AppShell        from '@/components/AppShell'
import Link            from 'next/link'
import Icon            from '@/components/ui/Icon'
import { PageHeader }  from '@/components/ui/PageHeader'
import PrintButton     from '@/components/ui/PrintButton'
import AttendanceExportButton from '@/components/admin/AttendanceExportButton'

// ── helpers ───────────────────────────────────────────────────────────────────

function pctColour(pct: number) {
  if (pct >= 95) return 'text-green-600'
  if (pct >= 90) return 'text-amber-600'
  if (pct >= 85) return 'text-orange-600'
  return 'text-red-600 font-semibold'
}

function pctBg(pct: number) {
  if (pct >= 95) return 'bg-green-500'
  if (pct >= 90) return 'bg-amber-400'
  if (pct >= 85) return 'bg-orange-400'
  return 'bg-red-500'
}

function RagBar({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full ${pctBg(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function AttendancePage() {
  const { schoolId, role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT', 'HEAD_OF_YEAR'].includes(role)) redirect('/dashboard')

  // All active students with attendance data
  const allStudents = await prisma.user.findMany({
    where: { schoolId, role: 'STUDENT', isActive: true },
    select: {
      id: true, firstName: true, lastName: true,
      yearGroup: true, tutorGroup: true,
      attendancePercentage: true,
      sendStatus: { select: { activeStatus: true } },
    },
    orderBy: [{ yearGroup: 'asc' }, { lastName: 'asc' }],
  })

  const withData    = allStudents.filter(s => s.attendancePercentage != null)
  const withoutData = allStudents.filter(s => s.attendancePercentage == null)

  // School average
  const schoolAvg = withData.length > 0
    ? withData.reduce((sum, s) => sum + s.attendancePercentage!, 0) / withData.length
    : null

  // Year-group breakdown
  const yearGroups = Array.from(new Set(allStudents.map(s => s.yearGroup).filter(Boolean) as number[])).sort()

  type YearStat = {
    year: number
    count: number
    withData: number
    avg: number | null
    below95: number
    below90: number
    below85: number
  }

  const yearStats: YearStat[] = yearGroups.map(yr => {
    const students = allStudents.filter(s => s.yearGroup === yr)
    const graded   = students.filter(s => s.attendancePercentage != null)
    const avg      = graded.length > 0
      ? graded.reduce((s, u) => s + u.attendancePercentage!, 0) / graded.length
      : null
    return {
      year: yr,
      count:    students.length,
      withData: graded.length,
      avg,
      below95: graded.filter(s => s.attendancePercentage! < 95).length,
      below90: graded.filter(s => s.attendancePercentage! < 90).length,
      below85: graded.filter(s => s.attendancePercentage! < 85).length,
    }
  })

  // All students below 90%, sorted worst first
  const concerns = withData
    .filter(s => s.attendancePercentage! < 90)
    .sort((a, b) => a.attendancePercentage! - b.attendancePercentage!)

  // Threshold distribution counts
  const dist = {
    excellent: withData.filter(s => s.attendancePercentage! >= 95).length,
    good:      withData.filter(s => s.attendancePercentage! >= 90 && s.attendancePercentage! < 95).length,
    concern:   withData.filter(s => s.attendancePercentage! >= 85 && s.attendancePercentage! < 90).length,
    serious:   withData.filter(s => s.attendancePercentage! < 85).length,
  }

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-8 sm:py-8 space-y-6">

          <style>{`@media print{nav,aside,[data-sidebar],.print\\:hidden{display:none!important}body{background:#fff}}`}</style>

          <PageHeader
            title="Attendance Overview"
            subtitle={`${withData.length} of ${allStudents.length} students have attendance data · ${schoolName}`}
            action={
              <div className="flex items-center gap-2 print:hidden">
                <AttendanceExportButton students={withData} />
                <PrintButton />
              </div>
            }
          />

          {withData.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
              <Icon name="info" size="md" className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-amber-900">No attendance data available</p>
                <p className="text-[12px] text-amber-700 mt-0.5">
                  Attendance percentages are synced from your MIS via Wonde. Run a MIS sync to populate this view.
                </p>
                <Link href="/admin/wonde" className="text-[12px] text-blue-600 hover:underline mt-1 inline-flex items-center gap-1">
                  <Icon name="sync" size="sm" /> Go to MIS Sync
                </Link>
              </div>
            </div>
          )}

          {withData.length > 0 && (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {schoolAvg != null && (
                  <div className="bg-white border border-gray-200 rounded-xl p-5 sm:col-span-1">
                    <p className={`text-[26px] font-bold ${pctColour(schoolAvg)}`}>{schoolAvg.toFixed(1)}%</p>
                    <p className="text-[12px] text-gray-400 mt-1">School average</p>
                  </div>
                )}
                {[
                  { label: '≥95% Excellent',  value: dist.excellent, colour: 'text-green-600' },
                  { label: '90–94% Good',      value: dist.good,      colour: 'text-amber-600' },
                  { label: '85–89% Concern',   value: dist.concern,   colour: 'text-orange-600' },
                  { label: '<85% Serious',     value: dist.serious,   colour: dist.serious > 0 ? 'text-red-600 font-bold' : 'text-gray-300' },
                ].map(k => (
                  <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5">
                    <p className={`text-[26px] font-bold ${k.colour}`}>{k.value}</p>
                    <p className="text-[12px] text-gray-400 mt-1">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* Year-group breakdown */}
              <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                  <Icon name="bar_chart" size="sm" className="text-gray-400" />
                  <h2 className="text-[13px] font-semibold text-gray-800">By Year Group</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-5 py-2.5 text-gray-500 font-medium">Year</th>
                        <th className="text-right px-4 py-2.5 text-gray-500 font-medium">Students</th>
                        <th className="text-right px-4 py-2.5 text-gray-500 font-medium">Avg</th>
                        <th className="px-4 py-2.5 text-gray-500 font-medium min-w-[120px]"></th>
                        <th className="text-right px-4 py-2.5 text-gray-500 font-medium">{'<90%'}</th>
                        <th className="text-right px-5 py-2.5 text-gray-500 font-medium">{'<85%'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {yearStats.map(ys => (
                        <tr key={ys.year} className="hover:bg-gray-50">
                          <td className="px-5 py-3 font-semibold text-gray-800">Year {ys.year}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{ys.count}</td>
                          <td className="px-4 py-3 text-right">
                            {ys.avg != null
                              ? <span className={`font-semibold ${pctColour(ys.avg)}`}>{ys.avg.toFixed(1)}%</span>
                              : <span className="text-gray-300">—</span>
                            }
                          </td>
                          <td className="px-4 py-3">
                            {ys.avg != null && <RagBar pct={ys.avg} />}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {ys.below90 > 0
                              ? <span className="text-amber-600 font-medium">{ys.below90}</span>
                              : <span className="text-gray-300">0</span>
                            }
                          </td>
                          <td className="px-5 py-3 text-right">
                            {ys.below85 > 0
                              ? <span className="text-red-600 font-semibold">{ys.below85}</span>
                              : <span className="text-gray-300">0</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Students of concern */}
              <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Icon name="warning" size="sm" className="text-amber-500" />
                    <h2 className="text-[13px] font-semibold text-gray-800">Students Below 90%</h2>
                  </div>
                  <span className="text-[11px] text-gray-400">{concerns.length} students</span>
                </div>

                {concerns.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <Icon name="check_circle" size="md" className="text-green-400 mx-auto mb-2" />
                    <p className="text-[13px] text-gray-400">All students are above 90%</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-5 py-2.5 text-gray-500 font-medium">Student</th>
                          <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Year</th>
                          <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Form</th>
                          <th className="text-left px-4 py-2.5 text-gray-500 font-medium">SEND</th>
                          <th className="text-right px-4 py-2.5 text-gray-500 font-medium">Attendance</th>
                          <th className="px-4 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {concerns.map(s => {
                          const pct  = s.attendancePercentage!
                          const send = s.sendStatus?.activeStatus
                          return (
                            <tr key={s.id} className="hover:bg-gray-50">
                              <td className="px-5 py-2.5">
                                <Link href={`/students/${s.id}`} className="font-medium text-gray-800 hover:text-blue-600 transition">
                                  {s.firstName} {s.lastName}
                                </Link>
                              </td>
                              <td className="px-4 py-2.5 text-gray-500">{s.yearGroup ? `Yr ${s.yearGroup}` : '—'}</td>
                              <td className="px-4 py-2.5 text-gray-500">{s.tutorGroup ?? '—'}</td>
                              <td className="px-4 py-2.5">
                                {send && send !== 'NONE' && (
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                    send === 'EHCP' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                  }`}>{send === 'EHCP' ? 'EHCP' : 'SEN'}</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <span className={`font-bold text-[13px] ${pctColour(pct)}`}>{pct.toFixed(1)}%</span>
                              </td>
                              <td className="px-4 py-2.5 print:hidden">
                                <Link
                                  href={`/api/export/attendance-letter/${s.id}`}
                                  className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-blue-600 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                                >
                                  <Icon name="mail" size="sm" />
                                  Letter
                                </Link>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {withoutData.length > 0 && (
                <p className="text-[11px] text-gray-400 text-center">
                  {withoutData.length} student{withoutData.length !== 1 ? 's' : ''} have no attendance data (not yet synced from MIS).
                </p>
              )}
            </>
          )}

        </div>
      </main>
    </AppShell>
  )
}
