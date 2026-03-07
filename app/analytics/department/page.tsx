import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, ChevronRight, Users } from 'lucide-react'

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

export default async function DeptAnalyticsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, id: userId, firstName, lastName, schoolName } = session.user as any
  if (!['HEAD_OF_DEPT', 'SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  // Find which department this HoD manages — use their user record's department field
  // For SCHOOL_ADMIN / SLT we show all departments
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { department: true },
  })

  // Fetch all classes (scoped by department if HoD)
  const allClasses = await prisma.schoolClass.findMany({
    where: {
      schoolId,
      ...(role === 'HEAD_OF_DEPT' && userRecord?.department
        ? { department: userRecord.department }
        : {}),
    },
    include: {
      teachers: { include: { user: { select: { firstName: true, lastName: true } } } },
      _count: { select: { enrolments: true } },
    },
    orderBy: [{ department: 'asc' }, { subject: 'asc' }, { yearGroup: 'asc' }],
  })

  // Latest aggregate per class
  const classIds = allClasses.map(c => c.id)
  const allAggs = await prisma.classPerformanceAggregate.findMany({
    where: { classId: { in: classIds } },
    orderBy: { termId: 'desc' },
  })
  const aggByClass = new Map<string, typeof allAggs[0]>()
  for (const a of allAggs) { if (!aggByClass.has(a.classId)) aggByClass.set(a.classId, a) }

  // Subject medians
  const allMedians = await prisma.subjectMedianAggregate.findMany({
    where: { schoolId },
    orderBy: { termId: 'desc' },
  })
  const medianMap = new Map<string, typeof allMedians[0]>()
  for (const m of allMedians) {
    const key = `${m.subjectId}-${m.yearGroup}`
    if (!medianMap.has(key)) medianMap.set(key, m)
  }

  // Pending homework to mark in these classes
  const toMark = await prisma.submission.count({
    where: { schoolId, status: 'SUBMITTED', homework: { classId: { in: classIds } } },
  })

  // Group classes by department → subject
  const byDept = new Map<string, Map<string, typeof allClasses>>()
  for (const cls of allClasses) {
    if (!byDept.has(cls.department)) byDept.set(cls.department, new Map())
    const deptMap = byDept.get(cls.department)!
    if (!deptMap.has(cls.subject)) deptMap.set(cls.subject, [])
    deptMap.get(cls.subject)!.push(cls)
  }

  // KPIs
  const aggsArr        = Array.from(aggByClass.values())
  const avgCompletion  = aggsArr.length ? aggsArr.reduce((s, a) => s + a.completionRate, 0) / aggsArr.length : 0
  const avgScore       = aggsArr.length ? aggsArr.reduce((s, a) => s + a.avgScore, 0) / aggsArr.length : 0
  const flaggedClasses = aggsArr.filter(a => a.integrityFlagRate > 0.02).length
  const currentTerm    = aggsArr[0]?.termId ?? ''
  const deptLabel      = role === 'HEAD_OF_DEPT' ? (userRecord?.department ?? 'Department') : 'All Departments'

  // Classes needing attention (below median on completion OR score)
  const attentionClasses = allClasses.filter(cls => {
    const agg    = aggByClass.get(cls.id)
    const median = medianMap.get(`${cls.subject}-${cls.yearGroup}`)
    const mJson  = median?.mediansJson as any
    if (!agg || !mJson) return false
    return agg.completionRate < mJson.completionRate - 0.05 || agg.avgScore < mJson.avgScore - 0.3
  })

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">Department Analytics</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">{deptLabel}</p>
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
              { label: 'Classes',        value: allClasses.length,                    colour: 'text-gray-900' },
              { label: 'Avg Completion', value: `${Math.round(avgCompletion * 100)}%`, colour: 'text-blue-600' },
              { label: 'Avg Score',      value: aggsArr.length ? avgScore.toFixed(1) : '—', colour: 'text-gray-900' },
              { label: 'To Mark',        value: toMark, colour: toMark > 0 ? 'text-amber-600' : 'text-gray-300' },
            ].map(k => (
              <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5">
                <p className={`text-[28px] font-bold ${k.colour}`}>{k.value}</p>
                <p className="text-[12px] text-gray-400 mt-1">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Needs attention panel */}
          {attentionClasses.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-amber-600" />
                <p className="text-[13px] font-semibold text-amber-900">
                  {attentionClasses.length} {attentionClasses.length === 1 ? 'class' : 'classes'} below subject median
                </p>
              </div>
              <div className="space-y-2">
                {attentionClasses.map(cls => {
                  const agg    = aggByClass.get(cls.id)!
                  const median = medianMap.get(`${cls.subject}-${cls.yearGroup}`)
                  const mJson  = median?.mediansJson as any
                  return (
                    <div key={cls.id} className="flex items-center justify-between bg-white border border-amber-100 rounded-lg px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-[13px] font-semibold text-gray-800">{cls.name}</p>
                          <p className="text-[11px] text-gray-400">
                            {cls.subject} · Year {cls.yearGroup} ·{' '}
                            {cls.teachers.map(t => `${t.user.firstName} ${t.user.lastName}`).join(', ') || 'No teacher'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-[12px]">
                        {mJson && agg.completionRate < mJson.completionRate - 0.05 && (
                          <span className="text-rose-600">
                            Completion {Math.round(agg.completionRate * 100)}%{' '}
                            <span className="text-gray-400">(median {Math.round(mJson.completionRate * 100)}%)</span>
                          </span>
                        )}
                        {mJson && agg.avgScore < mJson.avgScore - 0.3 && (
                          <span className="text-rose-600">
                            Score {agg.avgScore.toFixed(1)}{' '}
                            <span className="text-gray-400">(median {mJson.avgScore.toFixed(1)})</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Per-department → per-subject sections */}
          {byDept.size === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
              <BarChart2 size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-[14px] font-medium">No classes found</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Array.from(byDept.entries()).map(([dept, subjectMap]) => (
                <div key={dept}>
                  {/* Department header (only shown when viewing multiple depts) */}
                  {byDept.size > 1 && (
                    <h2 className="text-[13px] font-bold text-gray-500 uppercase tracking-widest mb-3">{dept}</h2>
                  )}

                  <div className="space-y-4">
                    {Array.from(subjectMap.entries()).map(([subject, classes]) => {
                      // Subject-level stats
                      const subjAggs      = classes.map(c => aggByClass.get(c.id)).filter(Boolean) as typeof allAggs
                      const subjAvgComp   = subjAggs.length ? subjAggs.reduce((s, a) => s + a.completionRate, 0) / subjAggs.length : null
                      const subjAvgScore  = subjAggs.length ? subjAggs.reduce((s, a) => s + a.avgScore, 0) / subjAggs.length : null

                      return (
                        <div key={subject} className="bg-white border border-gray-200 rounded-xl overflow-hidden">

                          {/* Subject header */}
                          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
                            <div className="flex items-center gap-3">
                              <h3 className="text-[15px] font-bold text-gray-900">{subject}</h3>
                              <span className="text-[11px] text-gray-400 font-medium">{classes.length} class{classes.length !== 1 ? 'es' : ''}</span>
                            </div>
                            {subjAvgComp !== null && (
                              <div className="flex items-center gap-4 text-[12px] text-gray-500">
                                <span>Avg completion <span className="font-semibold text-gray-800">{Math.round(subjAvgComp * 100)}%</span></span>
                                <span>Avg score <span className="font-semibold text-gray-800">{subjAvgScore!.toFixed(1)}</span></span>
                              </div>
                            )}
                          </div>

                          {/* Class rows */}
                          <div className="divide-y divide-gray-100">
                            {classes.map(cls => {
                              const agg    = aggByClass.get(cls.id)
                              const median = medianMap.get(`${cls.subject}-${cls.yearGroup}`)
                              const mJson  = median?.mediansJson as any

                              const compDelta  = agg && mJson ? agg.completionRate - mJson.completionRate : null
                              const scoreDelta = agg && mJson ? agg.avgScore - mJson.avgScore : null

                              const teacherNames = cls.teachers
                                .map(t => `${t.user.firstName} ${t.user.lastName}`)
                                .join(', ') || 'Unassigned'

                              return (
                                <div key={cls.id} className="px-6 py-4">
                                  {/* Row header */}
                                  <div className="flex items-center justify-between mb-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="text-[13px] font-semibold text-gray-900">{cls.name}</p>
                                        <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                          Year {cls.yearGroup}
                                        </span>
                                        {agg && agg.integrityFlagRate > 0.02 && (
                                          <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5">
                                            <AlertTriangle size={10} /> {Math.round(agg.integrityFlagRate * 100)}% flagged
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-[11px] text-gray-400">{teacherNames}</p>
                                        <span className="text-[10px] text-gray-300">·</span>
                                        <div className="flex items-center gap-1 text-[11px] text-gray-400">
                                          <Users size={10} />
                                          {cls._count.enrolments} pupils
                                        </div>
                                      </div>
                                    </div>
                                    <Link
                                      href="/homework"
                                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5"
                                    >
                                      Homework <ChevronRight size={11} />
                                    </Link>
                                  </div>

                                  {agg ? (
                                    <div className="grid grid-cols-3 gap-6">

                                      {/* Completion */}
                                      <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Completion</p>
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[13px] font-bold text-gray-900">{Math.round(agg.completionRate * 100)}%</span>
                                            {compDelta !== null && <DeltaBadge delta={compDelta} unit="%" />}
                                          </div>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${agg.completionRate * 100}%` }} />
                                        </div>
                                        {mJson && (
                                          <p className="text-[10px] text-gray-400 mt-1">Median: {Math.round(mJson.completionRate * 100)}%</p>
                                        )}
                                      </div>

                                      {/* Avg Score */}
                                      <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Avg Score</p>
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[13px] font-bold text-gray-900">{agg.avgScore.toFixed(1)}</span>
                                            {scoreDelta !== null && <DeltaBadge delta={scoreDelta} />}
                                          </div>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                          <div className={`h-full rounded-full ${
                                            agg.avgScore / 9 >= 0.7 ? 'bg-green-500' :
                                            agg.avgScore / 9 >= 0.5 ? 'bg-amber-500' : 'bg-rose-500'
                                          }`} style={{ width: `${(agg.avgScore / 9) * 100}%` }} />
                                        </div>
                                        {mJson && (
                                          <p className="text-[10px] text-gray-400 mt-1">Median: {mJson.avgScore.toFixed(1)}</p>
                                        )}
                                      </div>

                                      {/* Predicted Trend */}
                                      <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Trend</p>
                                        <div className="flex items-center gap-2">
                                          {agg.predictedDelta >= 0
                                            ? <TrendingUp  size={16} className="text-green-500" />
                                            : <TrendingDown size={16} className="text-rose-500"  />}
                                          <span className={`text-[16px] font-bold ${
                                            agg.predictedDelta >= 0 ? 'text-green-600' : 'text-rose-600'
                                          }`}>
                                            {agg.predictedDelta >= 0 ? '+' : ''}{agg.predictedDelta.toFixed(1)}
                                          </span>
                                          <span className="text-[10px] text-gray-400">pts</span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-[12px] text-gray-400 italic">No aggregate data yet</p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Integrity callout */}
          {flaggedClasses > 0 && (
            <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-3">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <p className="text-[13px] text-amber-800">
                <span className="font-semibold">{flaggedClasses} {flaggedClasses === 1 ? 'class has' : 'classes have'}</span>{' '}
                integrity flags above 2% — review in Integrity section.
              </p>
            </div>
          )}

        </div>
      </main>
    </AppShell>
  )
}
