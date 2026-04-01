import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { PlanStatus } from '@prisma/client'
import { formatAvgGrade } from '@/lib/gradeUtils'

function termLabel(id: string) {
  return id.replace('term-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default async function SltAnalyticsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, firstName, lastName, schoolName } = session.user as any
  if (!['SLT', 'SCHOOL_ADMIN'].includes(role)) redirect('/dashboard')

  // All classes with teachers and enrolment counts
  const allClasses = await prisma.schoolClass.findMany({
    where: { schoolId },
    include: {
      teachers:   { include: { user: { select: { firstName: true, lastName: true } } } },
      _count:     { select: { enrolments: true } },
    },
  })

  // Latest aggregate per class
  const allAggs = await prisma.classPerformanceAggregate.findMany({
    where: { schoolId },
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

  // SEND overview
  const in30days = new Date(Date.now() + 30 * 86_400_000) // eslint-disable-line react-hooks/purity
  const [sendTotal, activePlans, reviewsDue] = await Promise.all([
    prisma.sendStatus.count({ where: { student: { schoolId }, NOT: { activeStatus: 'NONE' } } }),
    prisma.plan.count({ where: { schoolId, status: { in: [PlanStatus.ACTIVE_INTERNAL, PlanStatus.ACTIVE_PARENT_SHARED] } } }),
    prisma.plan.count({ where: { schoolId, reviewDate: { lte: in30days }, status: { notIn: [PlanStatus.ARCHIVED] } } }),
  ])

  // School-wide live submission stats
  const [totalHw, totalSubs, pendingMark] = await Promise.all([
    prisma.homework.count({ where: { schoolId, status: 'PUBLISHED' } }),
    prisma.submission.count({ where: { schoolId } }),
    prisma.submission.count({ where: { schoolId, status: 'SUBMITTED' } }),
  ])

  // School-level aggregates
  const aggsArr          = Array.from(aggByClass.values())
  const schoolCompletion = aggsArr.length ? aggsArr.reduce((s, a) => s + a.completionRate, 0) / aggsArr.length : 0
  const schoolScore      = aggsArr.length ? aggsArr.reduce((s, a) => s + a.avgScore, 0) / aggsArr.length : 0
  const flaggedCount     = aggsArr.filter(a => a.integrityFlagRate > 0.03).length
  const currentTerm      = aggsArr[0]?.termId ?? ''

  // Group classes by subject for the main table
  const bySubject = new Map<string, typeof allClasses>()
  for (const cls of allClasses) {
    if (!bySubject.has(cls.subject)) bySubject.set(cls.subject, [])
    bySubject.get(cls.subject)!.push(cls)
  }

  // Classes needing attention (below median on both metrics)
  const needsAttention = allClasses.filter(cls => {
    const agg    = aggByClass.get(cls.id)
    const median = medianMap.get(`${cls.subject}-${cls.yearGroup}`)
    const mJson  = median?.mediansJson as any
    if (!agg || !mJson) return false
    return agg.completionRate < mJson.completionRate - 0.05 || agg.avgScore < mJson.avgScore - 0.3
  })

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">School Analytics</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">Performance overview across all classes</p>
            </div>
            {currentTerm && (
              <span className="text-[11px] font-semibold px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full">
                {termLabel(currentTerm)}
              </span>
            )}
          </div>

          {/* School KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
            {[
              { label: 'Classes',       value: allClasses.length,                        colour: 'text-gray-900' },
              { label: 'Homework Set',  value: totalHw,                                  colour: 'text-gray-900' },
              { label: 'Avg Completion',value: `${Math.round(schoolCompletion * 100)}%`, colour: 'text-blue-600' },
              { label: 'Avg Score',     value: schoolScore.toFixed(1),                   colour: 'text-gray-900' },
              { label: 'Flagged Classes',value: flaggedCount, colour: flaggedCount > 0 ? 'text-amber-600' : 'text-gray-300' },
            ].map(k => (
              <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5">
                <p className={`text-[26px] font-bold ${k.colour}`}>{k.value}</p>
                <p className="text-[12px] text-gray-400 mt-1">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left: subject breakdown table */}
            <div className="lg:col-span-2 space-y-4">

              {/* Needs attention */}
              {needsAttention.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="warning" size="sm" className="text-amber-600" />
                    <h2 className="text-[12px] font-bold text-amber-900 uppercase tracking-wide">
                      Needs Attention — Below Subject Median
                    </h2>
                  </div>
                  <div className="space-y-2">
                    {needsAttention.map(cls => {
                      const agg    = aggByClass.get(cls.id)
                      const median = medianMap.get(`${cls.subject}-${cls.yearGroup}`)
                      const mJson  = median?.mediansJson as any
                      return (
                        <div key={cls.id} className="flex items-center gap-4 bg-white rounded-xl px-4 py-3 border border-amber-100">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-gray-900">{cls.name}</p>
                            <p className="text-[11px] text-gray-400">
                              {cls.teachers.map(t => `${t.user.firstName} ${t.user.lastName}`).join(', ')}
                            </p>
                          </div>
                          {agg && mJson && (
                            <div className="flex items-center gap-4 text-right shrink-0">
                              <div>
                                <p className={`text-[13px] font-bold ${agg.completionRate < mJson.completionRate ? 'text-rose-600' : 'text-gray-700'}`}>
                                  {Math.round(agg.completionRate * 100)}%
                                </p>
                                <p className="text-[10px] text-gray-400">completion</p>
                              </div>
                              <div>
                                <p className={`text-[13px] font-bold ${agg.avgScore < mJson.avgScore ? 'text-rose-600' : 'text-gray-700'}`}>
                                  {formatAvgGrade(agg.avgScore).main}
                                </p>
                                <p className="text-[10px] text-gray-400">avg score</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Per-subject sections */}
              {Array.from(bySubject.entries()).map(([subject, classes]) => {
                const subjectAggs = classes.map(c => aggByClass.get(c.id)).filter(Boolean) as typeof allAggs
                const subAvgComp  = subjectAggs.length ? subjectAggs.reduce((s, a) => s + a.completionRate, 0) / subjectAggs.length : null
                const subAvgScore = subjectAggs.length ? subjectAggs.reduce((s, a) => s + a.avgScore, 0) / subjectAggs.length : null

                return (
                  <div key={subject} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {/* Subject header */}
                    <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <h2 className="text-[14px] font-bold text-gray-900">{subject}</h2>
                        <span className="text-[11px] text-gray-400">{classes.length} class{classes.length !== 1 ? 'es' : ''}</span>
                      </div>
                      {subAvgComp !== null && subAvgScore !== null && (
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <p className="text-[13px] font-bold text-blue-600">{Math.round(subAvgComp * 100)}%</p>
                            <p className="text-[10px] text-gray-400">avg completion</p>
                          </div>
                          <div>
                            <p className="text-[13px] font-bold text-gray-900">{formatAvgGrade(subAvgScore).main}</p>
                            <p className="text-[10px] text-gray-400">avg score</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Class rows */}
                    <div className="divide-y divide-gray-100">
                      {classes.sort((a, b) => a.yearGroup - b.yearGroup).map(cls => {
                        const agg    = aggByClass.get(cls.id)
                        const median = medianMap.get(`${cls.subject}-${cls.yearGroup}`)
                        const mJson  = median?.mediansJson as any
                        const teacher = cls.teachers[0]?.user
                        const enrolled = cls._count.enrolments

                        return (
                          <div key={cls.id} className="flex items-center gap-4 px-5 py-3.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-gray-900">{cls.name}</p>
                              <p className="text-[11px] text-gray-400">
                                Year {cls.yearGroup} · {enrolled} pupils
                                {teacher && ` · ${teacher.firstName} ${teacher.lastName}`}
                              </p>
                            </div>

                            {agg ? (
                              <div className="flex items-center gap-6 shrink-0">
                                {/* Completion bar */}
                                <div className="w-32">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[11px] text-gray-500">{Math.round(agg.completionRate * 100)}%</span>
                                    {mJson && (
                                      <span className={`text-[10px] font-bold ${
                                        agg.completionRate >= mJson.completionRate ? 'text-green-600' : 'text-rose-600'
                                      }`}>
                                        {agg.completionRate >= mJson.completionRate ? '▲' : '▼'}
                                        {Math.abs(Math.round((agg.completionRate - mJson.completionRate) * 100))}%
                                      </span>
                                    )}
                                  </div>
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${agg.completionRate * 100}%` }} />
                                  </div>
                                </div>

                                {/* Score */}
                                <div className="text-right w-20">
                                  <p className="text-[12px] font-bold text-gray-900">{formatAvgGrade(agg.avgScore).main}</p>
                                  {mJson && (
                                    <p className={`text-[10px] font-bold ${
                                      agg.avgScore >= mJson.avgScore ? 'text-green-600' : 'text-rose-600'
                                    }`}>
                                      {agg.avgScore >= mJson.avgScore ? '+' : ''}{(agg.avgScore - mJson.avgScore).toFixed(1)}
                                    </p>
                                  )}
                                </div>

                                {/* Trend */}
                                <div className="w-6">
                                  {agg.predictedDelta >= 0
                                    ? <Icon name="trending_up"   size="sm" className="text-green-500" />
                                    : <Icon name="trending_down" size="sm" className="text-rose-500"  />}
                                </div>

                                {/* Integrity flag */}
                                {agg.integrityFlagRate > 0.02 && (
                                  <Icon name="warning" size="sm" className="text-amber-500 shrink-0" aria-label={`${Math.round(agg.integrityFlagRate * 100)}% flagged`} />
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-300 shrink-0">No data</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Right: summary cards */}
            <div className="space-y-4">

              {/* Live submission stats */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-[13px] font-semibold text-gray-900 mb-4">Live Activity</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Homework published', value: totalHw,     colour: 'text-gray-900' },
                    { label: 'Submissions received', value: totalSubs, colour: 'text-gray-900' },
                    { label: 'Awaiting marking',  value: pendingMark,  colour: pendingMark > 0 ? 'text-amber-600' : 'text-gray-400' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between">
                      <span className="text-[12px] text-gray-500">{s.label}</span>
                      <span className={`text-[14px] font-bold ${s.colour}`}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SEND overview */}
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Icon name="favorite" size="sm" className="text-purple-600" />
                  <h3 className="text-[13px] font-semibold text-purple-900">SEND Overview</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'On register',    value: sendTotal,    colour: 'text-purple-900' },
                    { label: 'Active plans',   value: activePlans,  colour: 'text-teal-700'   },
                    { label: 'Reviews due (30d)', value: reviewsDue, colour: reviewsDue > 0 ? 'text-amber-600' : 'text-gray-400' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between">
                      <span className="text-[12px] text-purple-700">{s.label}</span>
                      <span className={`text-[14px] font-bold ${s.colour}`}>{s.value}</span>
                    </div>
                  ))}
                </div>
                <Link href="/send/dashboard" className="mt-4 flex items-center gap-1 text-[11px] text-purple-700 font-medium hover:underline">
                  SEND Dashboard <Icon name="chevron_right" size="sm" />
                </Link>
              </div>

              {/* Integrity */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Icon name="shield" size="sm" className="text-gray-500" />
                  <h3 className="text-[13px] font-semibold text-gray-900">Integrity</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-gray-500">Classes with flags</span>
                    <span className={`text-[14px] font-bold ${flaggedCount > 0 ? 'text-amber-600' : 'text-gray-300'}`}>{flaggedCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-gray-500">School avg flag rate</span>
                    <span className="text-[14px] font-bold text-gray-700">
                      {aggsArr.length
                        ? `${(aggsArr.reduce((s, a) => s + a.integrityFlagRate, 0) / aggsArr.length * 100).toFixed(1)}%`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>
    </AppShell>
  )
}
