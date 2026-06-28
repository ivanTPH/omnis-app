import { requireAuth }       from '@/lib/session'
import { redirect }          from 'next/navigation'
import Link                  from 'next/link'
import AppShell              from '@/components/AppShell'
import Icon                  from '@/components/ui/Icon'
import { getSencoAnalytics } from '@/app/actions/send-support'

export const dynamic = 'force-dynamic'

const ALLOWED = ['SENCO', 'SLT', 'SCHOOL_ADMIN']

function pct(n: number, total: number) {
  if (total === 0) return 0
  return Math.round((n / total) * 100)
}

function ProgressBar({ value, max, colour }: { value: number; max: number; colour: string }) {
  const width = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-2 rounded-full transition-all ${colour}`} style={{ width: `${width}%` }} />
    </div>
  )
}

function StatCard({ label, value, sub, colour = 'text-gray-900' }: {
  label: string; value: number | string; sub?: string; colour?: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-[28px] font-bold mt-1 ${colour}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default async function SencoAnalyticsPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()
  if (!ALLOWED.includes(role)) redirect('/dashboard')

  const data = await getSencoAnalytics()

  const evidencePct    = pct(data.ilpTargetsEvidenced, data.ilpTargetsTotal)
  const gapCount       = data.ilpTargetsTotal - data.ilpTargetsEvidenced
  const apdrCompletePct = pct(data.apdrCompleted, data.apdrTotal)
  const totalFlags     = data.flagsHigh + data.flagsMedium + data.flagsLow

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Link href="/senco/dashboard" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <Icon name="chevron_left" size="sm" /> SENCO Dashboard
            </Link>
          </div>
          <h1 className="text-[22px] font-bold text-gray-900 mb-1">SEND Analytics</h1>
          <p className="text-[13px] text-gray-400 mb-6">
            APDR completion, ILP evidence coverage, SEND register, and early warning signals.
          </p>

          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="On SEND register" value={data.totalSend} />
            <StatCard
              label="SEN Support"
              value={data.senSupport}
              sub={`${pct(data.senSupport, data.totalSend)}% of register`}
              colour="text-amber-700"
            />
            <StatCard
              label="EHCP"
              value={data.ehcp}
              sub={`${pct(data.ehcp, data.totalSend)}% of register`}
              colour="text-rose-700"
            />
            <StatCard
              label="Active flags"
              value={totalFlags}
              sub="last 30 days"
              colour={totalFlags > 0 ? 'text-rose-600' : 'text-emerald-600'}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

            {/* APDR Completion */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="assignment_turned_in" size="sm" className="text-indigo-600" />
                <h2 className="text-[14px] font-semibold text-gray-900">APDR Cycle Completion</h2>
              </div>

              {data.apdrTotal === 0 ? (
                <p className="text-sm text-gray-400">No APDR cycles recorded yet.</p>
              ) : (
                <>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-[32px] font-bold text-indigo-700">{apdrCompletePct}%</span>
                    <span className="text-[12px] text-gray-400 pb-1">
                      {data.apdrCompleted} of {data.apdrTotal} cycles complete
                    </span>
                  </div>
                  <ProgressBar value={data.apdrCompleted} max={data.apdrTotal} colour="bg-indigo-500" />

                  <div className="mt-4 space-y-2">
                    {[
                      { label: 'Completed',   count: data.apdrCompleted,  colour: 'bg-indigo-500', text: 'text-indigo-700' },
                      { label: 'In progress', count: data.apdrInProgress, colour: 'bg-amber-400', text: 'text-amber-700' },
                      { label: 'Not started', count: data.apdrNotStarted, colour: 'bg-gray-200', text: 'text-gray-500' },
                    ].map(row => (
                      <div key={row.label} className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${row.colour}`} />
                        <span className="text-[12px] text-gray-600 flex-1">{row.label}</span>
                        <span className={`text-[12px] font-semibold ${row.text}`}>{row.count}</span>
                        <span className="text-[11px] text-gray-400 w-8 text-right">
                          {pct(row.count, data.apdrTotal)}%
                        </span>
                      </div>
                    ))}
                  </div>

                  <Link
                    href="/senco/apdr"
                    className="mt-4 flex items-center gap-1 text-[12px] font-semibold text-indigo-600 hover:underline"
                  >
                    View all APDR cycles <Icon name="arrow_forward" size="sm" />
                  </Link>
                </>
              )}
            </div>

            {/* ILP Evidence Gap */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="fact_check" size="sm" className="text-emerald-600" />
                <h2 className="text-[14px] font-semibold text-gray-900">ILP Evidence Coverage</h2>
              </div>

              {data.ilpTargetsTotal === 0 ? (
                <p className="text-sm text-gray-400">No active ILP targets found.</p>
              ) : (
                <>
                  <div className="flex items-end gap-2 mb-2">
                    <span className={`text-[32px] font-bold ${evidencePct >= 50 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {evidencePct}%
                    </span>
                    <span className="text-[12px] text-gray-400 pb-1">
                      {data.ilpTargetsEvidenced} of {data.ilpTargetsTotal} targets evidenced
                    </span>
                  </div>
                  <ProgressBar
                    value={data.ilpTargetsEvidenced}
                    max={data.ilpTargetsTotal}
                    colour={evidencePct >= 50 ? 'bg-emerald-500' : 'bg-rose-500'}
                  />

                  {gapCount > 0 && (
                    <div className="mt-4 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2.5 flex items-start gap-2">
                      <Icon name="warning" size="sm" className="text-rose-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[12px] font-semibold text-rose-800">
                          {gapCount} target{gapCount !== 1 ? 's' : ''} without evidence
                        </p>
                        <p className="text-[11px] text-rose-600 mt-0.5">
                          Teachers have not yet linked homework to these ILP targets.
                        </p>
                      </div>
                    </div>
                  )}

                  {gapCount === 0 && (
                    <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5 flex items-center gap-2">
                      <Icon name="check_circle" size="sm" className="text-emerald-600" />
                      <p className="text-[12px] font-semibold text-emerald-800">
                        All active targets are evidenced
                      </p>
                    </div>
                  )}

                  <Link
                    href="/senco/ilp-evidence"
                    className="mt-4 flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:underline"
                  >
                    View ILP evidence <Icon name="arrow_forward" size="sm" />
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* SEND Tier Distribution */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="bar_chart" size="sm" className="text-blue-600" />
                <h2 className="text-[14px] font-semibold text-gray-900">SEND Tier Distribution</h2>
              </div>

              {data.totalSend === 0 ? (
                <p className="text-sm text-gray-400">No students on SEND register.</p>
              ) : (
                <div className="space-y-4">
                  {[
                    {
                      tier:   'Specialist (EHCP)',
                      count:  data.ehcp,
                      colour: 'bg-rose-500',
                      text:   'text-rose-700',
                      desc:   'Education, Health and Care Plan',
                    },
                    {
                      tier:   'Targeted (SEN Support)',
                      count:  data.senSupport,
                      colour: 'bg-amber-400',
                      text:   'text-amber-700',
                      desc:   'SEN Support provision',
                    },
                  ].map(row => (
                    <div key={row.tier}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className={`text-[12px] font-semibold ${row.text}`}>{row.tier}</span>
                          <span className="text-[11px] text-gray-400 ml-2">{row.desc}</span>
                        </div>
                        <span className={`text-[13px] font-bold ${row.text}`}>
                          {row.count} <span className="font-normal text-gray-400 text-[11px]">({pct(row.count, data.totalSend)}%)</span>
                        </span>
                      </div>
                      <ProgressBar value={row.count} max={data.totalSend} colour={row.colour} />
                    </div>
                  ))}
                </div>
              )}

              <Link
                href="/senco/concerns"
                className="mt-4 flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:underline"
              >
                SEND register <Icon name="arrow_forward" size="sm" />
              </Link>
            </div>

            {/* Early Warning Flags */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="notifications_active" size="sm" className="text-rose-600" />
                <h2 className="text-[14px] font-semibold text-gray-900">Early Warning Signals</h2>
                <span className="text-[11px] text-gray-400 ml-auto">last 30 days</span>
              </div>

              {/* Flag severity breakdown */}
              <div className="space-y-2 mb-4">
                {[
                  { label: 'High severity',   count: data.flagsHigh,   colour: 'bg-rose-100 text-rose-700 border-rose-200' },
                  { label: 'Medium severity', count: data.flagsMedium, colour: 'bg-amber-100 text-amber-700 border-amber-200' },
                  { label: 'Low severity',    count: data.flagsLow,    colour: 'bg-blue-100 text-blue-700 border-blue-200' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-[12px] text-gray-600">{row.label}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${row.colour}`}>
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>

              {/* Low attendance SEND students */}
              {data.lowAttendanceSend.length > 0 && (
                <>
                  <div className="border-t border-gray-100 pt-3 mb-2">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      SEND students below 85% attendance
                    </p>
                    <div className="space-y-1.5">
                      {data.lowAttendanceSend.slice(0, 5).map(s => (
                        <div key={s.studentId} className="flex items-center justify-between">
                          <Link
                            href={`/students/${s.studentId}`}
                            className="text-[12px] font-medium text-gray-800 hover:text-blue-600 hover:underline truncate max-w-[180px]"
                          >
                            {s.studentName}
                          </Link>
                          <span className="text-[12px] font-semibold text-rose-600 shrink-0">
                            {s.attendance.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {totalFlags === 0 && data.lowAttendanceSend.length === 0 && (
                <div className="flex items-center gap-2 text-emerald-700">
                  <Icon name="check_circle" size="sm" />
                  <p className="text-[12px] font-semibold">No active early warning flags</p>
                </div>
              )}

              <Link
                href="/senco/early-warning"
                className="mt-3 flex items-center gap-1 text-[12px] font-semibold text-rose-600 hover:underline"
              >
                View early warning flags <Icon name="arrow_forward" size="sm" />
              </Link>
            </div>
          </div>

        </div>
      </main>
    </AppShell>
  )
}
