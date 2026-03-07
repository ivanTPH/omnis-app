import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, ChevronRight } from 'lucide-react'

function termLabel(id: string) {
  return id.replace('term-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function DeltaBadge({ delta, unit = '' }: { delta: number; unit?: string }) {
  const positive = delta >= 0
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
      positive ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
    }`}>
      {positive ? '+' : ''}{unit === '%' ? Math.round(delta * 100) : delta.toFixed(1)}{unit}
    </span>
  )
}

export default async function TeacherAnalyticsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, id: userId, firstName, lastName, schoolName } = session.user as any

  // Teacher's classes
  const classTeachers = await prisma.classTeacher.findMany({
    where: { userId },
    include: { class: { include: { enrolments: true } } },
  })
  const classIds = classTeachers.map(ct => ct.classId)
  const classes  = classTeachers.map(ct => ct.class)

  // Latest aggregate per class
  const allAggs = await prisma.classPerformanceAggregate.findMany({
    where: { classId: { in: classIds } },
    orderBy: { termId: 'desc' },
  })
  const aggByClass = new Map<string, typeof allAggs[0]>()
  for (const a of allAggs) { if (!aggByClass.has(a.classId)) aggByClass.set(a.classId, a) }

  // Subject medians for those classes
  const medians = await prisma.subjectMedianAggregate.findMany({
    where: {
      schoolId,
      OR: classes.map(c => ({ subjectId: c.subject, yearGroup: c.yearGroup })),
    },
    orderBy: { termId: 'desc' },
  })
  const medianMap = new Map<string, typeof medians[0]>()
  for (const m of medians) {
    const key = `${m.subjectId}-${m.yearGroup}`
    if (!medianMap.has(key)) medianMap.set(key, m)
  }

  // Recent homework with live submission counts
  const recentHw = await prisma.homework.findMany({
    where: { schoolId, classId: { in: classIds } },
    include: { submissions: { select: { id: true, status: true } } },
    orderBy: { dueAt: 'desc' },
    take: 30,
  })
  const hwByClass = new Map<string, typeof recentHw>()
  for (const hw of recentHw) {
    if (!hwByClass.has(hw.classId)) hwByClass.set(hw.classId, [])
    hwByClass.get(hw.classId)!.push(hw)
  }

  // Submissions needing marking across all classes
  const toMark = recentHw.reduce((sum, hw) =>
    sum + hw.submissions.filter(s => s.status === 'SUBMITTED').length, 0)

  // SEND students enrolled in teacher's classes
  const allStudentIds = classes.flatMap(c => c.enrolments.map(e => e.userId))
  const sendCount = await prisma.sendStatus.count({
    where: { studentId: { in: allStudentIds }, NOT: { activeStatus: 'NONE' } },
  })

  // School-wide KPIs from aggregates
  const aggsArr       = Array.from(aggByClass.values())
  const avgCompletion = aggsArr.length ? aggsArr.reduce((s, a) => s + a.completionRate, 0) / aggsArr.length : 0
  const avgScore      = aggsArr.length ? aggsArr.reduce((s, a) => s + a.avgScore, 0) / aggsArr.length : 0
  const currentTerm   = aggsArr[0]?.termId ?? ''

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">Analytics</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">Your classes this term</p>
            </div>
            {currentTerm && (
              <span className="text-[11px] font-semibold px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full">
                {termLabel(currentTerm)}
              </span>
            )}
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Classes',        value: classIds.length,                    colour: 'text-gray-900' },
              { label: 'Avg Completion', value: `${Math.round(avgCompletion * 100)}%`, colour: 'text-blue-600' },
              { label: 'Avg Score',      value: avgScore.toFixed(1),               colour: 'text-gray-900' },
              { label: 'To Mark',        value: toMark, colour: toMark > 0 ? 'text-amber-600' : 'text-gray-300' },
            ].map(k => (
              <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5">
                <p className={`text-[28px] font-bold ${k.colour}`}>{k.value}</p>
                <p className="text-[12px] text-gray-400 mt-1">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Per-class cards */}
          {classes.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
              <BarChart2 size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-[14px] font-medium">No classes assigned yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {classes.map(cls => {
                const agg      = aggByClass.get(cls.id)
                const median   = medianMap.get(`${cls.subject}-${cls.yearGroup}`)
                const mJson    = median?.mediansJson as any
                const enrolled = cls.enrolments.length
                const classHw  = hwByClass.get(cls.id) ?? []

                const compDelta  = agg && mJson ? agg.completionRate - mJson.completionRate : null
                const scoreDelta = agg && mJson ? agg.avgScore       - mJson.avgScore       : null

                return (
                  <div key={cls.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">

                    {/* Class header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                      <div>
                        <h2 className="text-[15px] font-bold text-gray-900">{cls.name}</h2>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {cls.subject} · Year {cls.yearGroup} · {enrolled} pupils
                          {sendCount > 0 && <span className="ml-2 text-rose-500">· {sendCount} SEND</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {agg && agg.integrityFlagRate > 0.02 && (
                          <div className="flex items-center gap-1 text-amber-600">
                            <AlertTriangle size={12} />
                            <span className="text-[11px] font-semibold">{Math.round(agg.integrityFlagRate * 100)}% flagged</span>
                          </div>
                        )}
                        <Link href="/homework" className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5">
                          Homework <ChevronRight size={11} />
                        </Link>
                      </div>
                    </div>

                    {agg ? (
                      <div className="px-6 py-5">
                        <div className="grid grid-cols-3 gap-8">

                          {/* Completion */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Completion</p>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[16px] font-bold text-gray-900">{Math.round(agg.completionRate * 100)}%</span>
                                {compDelta !== null && <DeltaBadge delta={compDelta} unit="%" />}
                              </div>
                            </div>
                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${agg.completionRate * 100}%` }} />
                            </div>
                            {mJson && (
                              <p className="text-[10px] text-gray-400 mt-1.5">
                                Subject median: {Math.round(mJson.completionRate * 100)}%
                              </p>
                            )}
                          </div>

                          {/* Avg Score */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Avg Score</p>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[16px] font-bold text-gray-900">{agg.avgScore.toFixed(1)}</span>
                                {scoreDelta !== null && <DeltaBadge delta={scoreDelta} />}
                              </div>
                            </div>
                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${
                                agg.avgScore / 9 >= 0.7 ? 'bg-green-500' :
                                agg.avgScore / 9 >= 0.5 ? 'bg-amber-500' : 'bg-rose-500'
                              }`} style={{ width: `${(agg.avgScore / 9) * 100}%` }} />
                            </div>
                            {mJson && (
                              <p className="text-[10px] text-gray-400 mt-1.5">Subject median: {mJson.avgScore.toFixed(1)}</p>
                            )}
                          </div>

                          {/* Predicted trend */}
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Predicted Trend</p>
                            <div className="flex items-center gap-2">
                              {agg.predictedDelta >= 0
                                ? <TrendingUp  size={20} className="text-green-500" />
                                : <TrendingDown size={20} className="text-rose-500"  />}
                              <span className={`text-[22px] font-bold ${
                                agg.predictedDelta >= 0 ? 'text-green-600' : 'text-rose-600'
                              }`}>
                                {agg.predictedDelta >= 0 ? '+' : ''}{agg.predictedDelta.toFixed(1)}
                              </span>
                              <span className="text-[11px] text-gray-400 leading-tight">pts vs<br/>last term</span>
                            </div>
                          </div>
                        </div>

                        {/* Recent homework submission bars */}
                        {classHw.length > 0 && (
                          <div className="mt-5 pt-4 border-t border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">Recent Homework</p>
                            <div className="space-y-2">
                              {classHw.slice(0, 4).map(hw => {
                                const subCount = hw.submissions.length
                                const pct      = enrolled > 0 ? (subCount / enrolled) * 100 : 0
                                const unmarked = hw.submissions.filter(s => s.status === 'SUBMITTED').length
                                return (
                                  <div key={hw.id} className="flex items-center gap-3">
                                    <Link href={`/homework/${hw.id}`} className="text-[12px] text-gray-700 truncate flex-1 hover:text-blue-600 transition-colors">
                                      {hw.title}
                                    </Link>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {unmarked > 0 && (
                                        <span className="text-[10px] text-amber-600 font-medium">{unmarked} to mark</span>
                                      )}
                                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${
                                          pct >= 75 ? 'bg-green-400' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                                        }`} style={{ width: `${pct}%` }} />
                                      </div>
                                      <span className="text-[11px] text-gray-400 w-8 text-right">{Math.round(pct)}%</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="px-6 py-6 text-center text-[13px] text-gray-400">
                        No aggregate data for this term yet
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </main>
    </AppShell>
  )
}
