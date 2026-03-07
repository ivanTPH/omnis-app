import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, Users, BookOpen } from 'lucide-react'

function termLabel(id: string) {
  return id.replace('term-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default async function HoyAnalyticsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, id: userId, firstName, lastName, schoolName } = session.user as any
  if (!['HEAD_OF_YEAR', 'SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  // HoY's own year group (from user record) — admins see all
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { yearGroup: true },
  })
  const myYearGroup = role === 'HEAD_OF_YEAR' ? userRecord?.yearGroup : null

  // Classes in this year group (or all if admin)
  const allClasses = await prisma.schoolClass.findMany({
    where: {
      schoolId,
      ...(myYearGroup ? { yearGroup: myYearGroup } : {}),
    },
    include: {
      teachers:   { include: { user: { select: { firstName: true, lastName: true } } } },
      enrolments: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      homework:   { select: { id: true } },
    },
    orderBy: [{ yearGroup: 'asc' }, { subject: 'asc' }],
  })

  const classIds    = allClasses.map(c => c.id)
  const allStudents = allClasses.flatMap(c => c.enrolments.map(e => e.user))

  // Deduplicate students (enrolled in multiple classes)
  const studentMap = new Map<string, typeof allStudents[0]>()
  for (const s of allStudents) studentMap.set(s.id, s)
  const uniqueStudentIds = Array.from(studentMap.keys())

  // Latest aggregate per class
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

  // SEND overview for this year group's students
  const [sendCount, activePlanCount] = await Promise.all([
    prisma.sendStatus.count({
      where: { studentId: { in: uniqueStudentIds }, NOT: { activeStatus: 'NONE' } },
    }),
    prisma.plan.count({
      where: { schoolId, student: { id: { in: uniqueStudentIds } }, status: { in: ['ACTIVE_INTERNAL', 'ACTIVE_PARENT_SHARED'] } },
    }),
  ])

  // Per-student submission stats (to identify at-risk pupils)
  const submissionStats = await prisma.submission.groupBy({
    by: ['studentId'],
    where: { schoolId, studentId: { in: uniqueStudentIds } },
    _count: { id: true },
    _avg:   { finalScore: true },
  })
  const subStatByStudent = new Map<string, typeof submissionStats[0]>()
  for (const s of submissionStats) subStatByStudent.set(s.studentId, s)

  // Homework counts per class (for submission rate calc)
  const hwCounts = await prisma.homework.groupBy({
    by: ['classId'],
    where: { classId: { in: classIds }, status: 'PUBLISHED' },
    _count: { id: true },
  })
  const hwCountByClass = new Map<string, number>()
  for (const h of hwCounts) hwCountByClass.set(h.classId, h._count.id)

  // Total homework set in scope
  const totalHwSet = hwCounts.reduce((s, h) => s + h._count.id, 0)

  // Pending submissions to mark
  const toMark = await prisma.submission.count({
    where: { schoolId, status: 'SUBMITTED', homework: { classId: { in: classIds } } },
  })

  // KPIs
  const aggsArr       = Array.from(aggByClass.values())
  const avgCompletion = aggsArr.length ? aggsArr.reduce((s, a) => s + a.completionRate, 0) / aggsArr.length : 0
  const avgScore      = aggsArr.length ? aggsArr.reduce((s, a) => s + a.avgScore, 0) / aggsArr.length : 0
  const currentTerm   = aggsArr[0]?.termId ?? ''

  // Group classes by year group
  const byYearGroup = new Map<number, typeof allClasses>()
  for (const cls of allClasses) {
    if (!byYearGroup.has(cls.yearGroup)) byYearGroup.set(cls.yearGroup, [])
    byYearGroup.get(cls.yearGroup)!.push(cls)
  }

  // At-risk students: enrolled students who have below 50% submission rate across all their classes
  const atRisk: Array<{
    id: string; firstName: string; lastName: string
    submissionCount: number; expectedCount: number
    sendOnRegister: boolean; avgScore: number | null
  }> = []

  for (const [sid, student] of studentMap) {
    // How many homework tasks were set across all classes this student is in
    const studentClasses = allClasses.filter(c => c.enrolments.some(e => e.user.id === sid))
    const expected = studentClasses.reduce((s, c) => s + (hwCountByClass.get(c.id) ?? 0), 0)
    const stat = subStatByStudent.get(sid)
    const actual = stat?._count.id ?? 0
    if (expected > 0 && actual / expected < 0.5) {
      atRisk.push({
        id: sid,
        firstName: student.firstName,
        lastName: student.lastName,
        submissionCount: actual,
        expectedCount: expected,
        sendOnRegister: false, // populated below
        avgScore: stat?._avg.finalScore ?? null,
      })
    }
  }

  // Mark SEND students in at-risk list
  const sendStudentIds = new Set(
    (await prisma.sendStatus.findMany({
      where: { studentId: { in: atRisk.map(s => s.id) }, NOT: { activeStatus: 'NONE' } },
      select: { studentId: true },
    })).map(s => s.studentId)
  )
  for (const s of atRisk) s.sendOnRegister = sendStudentIds.has(s.id)

  // Sort at-risk: SEND first, then by submission rate ascending
  atRisk.sort((a, b) => {
    if (a.sendOnRegister !== b.sendOnRegister) return a.sendOnRegister ? -1 : 1
    return (a.submissionCount / a.expectedCount) - (b.submissionCount / b.expectedCount)
  })

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">Year Group Analytics</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">
                {myYearGroup ? `Year ${myYearGroup}` : 'All year groups'}
              </p>
            </div>
            {currentTerm && (
              <span className="text-[11px] font-semibold px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full">
                {termLabel(currentTerm)}
              </span>
            )}
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
            {[
              { label: 'Students',       value: uniqueStudentIds.length,              colour: 'text-gray-900' },
              { label: 'Classes',        value: allClasses.length,                    colour: 'text-gray-900' },
              { label: 'Avg Completion', value: `${Math.round(avgCompletion * 100)}%`, colour: 'text-blue-600' },
              { label: 'Avg Score',      value: aggsArr.length ? avgScore.toFixed(1) : '—', colour: 'text-gray-900' },
              { label: 'SEND Register',  value: sendCount, colour: sendCount > 0 ? 'text-purple-600' : 'text-gray-300' },
            ].map(k => (
              <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5">
                <p className={`text-[24px] font-bold ${k.colour}`}>{k.value}</p>
                <p className="text-[12px] text-gray-400 mt-1">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left: class list */}
            <div className="lg:col-span-2 space-y-6">

              {Array.from(byYearGroup.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([yg, classes]) => (
                  <div key={yg}>
                    {byYearGroup.size > 1 && (
                      <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">Year {yg}</h2>
                    )}
                    <div className="space-y-3">
                      {classes.map(cls => {
                        const agg    = aggByClass.get(cls.id)
                        const median = medianMap.get(`${cls.subject}-${cls.yearGroup}`)
                        const mJson  = median?.mediansJson as any
                        const compDelta  = agg && mJson ? agg.completionRate - mJson.completionRate : null
                        const scoreDelta = agg && mJson ? agg.avgScore - mJson.avgScore : null
                        const teacherNames = cls.teachers.map(t => `${t.user.firstName} ${t.user.lastName}`).join(', ') || 'Unassigned'

                        return (
                          <div key={cls.id} className="bg-white border border-gray-200 rounded-xl px-6 py-5">
                            {/* Class header */}
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-[14px] font-bold text-gray-900">{cls.name}</h3>
                                  {agg && agg.integrityFlagRate > 0.02 && (
                                    <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5">
                                      <AlertTriangle size={10} />
                                      {Math.round(agg.integrityFlagRate * 100)}% flagged
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  {cls.subject} · {teacherNames} · {cls.enrolments.length} pupils
                                </p>
                              </div>
                              {agg && (
                                <div className="flex items-center gap-1.5">
                                  {agg.predictedDelta >= 0
                                    ? <TrendingUp  size={14} className="text-green-500" />
                                    : <TrendingDown size={14} className="text-rose-500"  />}
                                  <span className={`text-[13px] font-bold ${
                                    agg.predictedDelta >= 0 ? 'text-green-600' : 'text-rose-600'
                                  }`}>
                                    {agg.predictedDelta >= 0 ? '+' : ''}{agg.predictedDelta.toFixed(1)}
                                  </span>
                                  <span className="text-[10px] text-gray-400">pts</span>
                                </div>
                              )}
                            </div>

                            {agg ? (
                              <div className="grid grid-cols-2 gap-5">
                                {/* Completion */}
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Completion</p>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[13px] font-bold text-gray-900">{Math.round(agg.completionRate * 100)}%</span>
                                      {compDelta !== null && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                          compDelta >= 0 ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
                                        }`}>
                                          {compDelta >= 0 ? '+' : ''}{Math.round(compDelta * 100)}%
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${agg.completionRate * 100}%` }} />
                                  </div>
                                  {mJson && <p className="text-[10px] text-gray-400 mt-1">Median {Math.round(mJson.completionRate * 100)}%</p>}
                                </div>

                                {/* Avg Score */}
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Avg Score</p>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[13px] font-bold text-gray-900">{agg.avgScore.toFixed(1)}</span>
                                      {scoreDelta !== null && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                          scoreDelta >= 0 ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'
                                        }`}>
                                          {scoreDelta >= 0 ? '+' : ''}{scoreDelta.toFixed(1)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${
                                      agg.avgScore / 9 >= 0.7 ? 'bg-green-500' :
                                      agg.avgScore / 9 >= 0.5 ? 'bg-amber-500' : 'bg-rose-500'
                                    }`} style={{ width: `${(agg.avgScore / 9) * 100}%` }} />
                                  </div>
                                  {mJson && <p className="text-[10px] text-gray-400 mt-1">Median {mJson.avgScore.toFixed(1)}</p>}
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
                ))}

              {allClasses.length === 0 && (
                <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
                  <BarChart2 size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-[14px] font-medium">No classes found for this year group</p>
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="space-y-4">

              {/* At-risk students */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={13} className="text-rose-500" />
                    <p className="text-[12px] font-bold text-gray-700">At-Risk Students</p>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">&lt;50% submission rate</p>
                </div>
                {atRisk.length === 0 ? (
                  <div className="px-5 py-6 text-center">
                    <p className="text-[12px] text-gray-400">No at-risk students identified</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {atRisk.slice(0, 8).map(s => {
                      const rate = Math.round((s.submissionCount / s.expectedCount) * 100)
                      return (
                        <div key={s.id} className="px-5 py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 text-[10px] font-bold shrink-0">
                                {s.firstName[0]}{s.lastName[0]}
                              </div>
                              <div>
                                <p className="text-[12px] font-semibold text-gray-800 leading-tight">
                                  {s.firstName} {s.lastName}
                                </p>
                                {s.sendOnRegister && (
                                  <span className="text-[10px] font-bold text-rose-600">SEND</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[13px] font-bold text-rose-600">{rate}%</p>
                              <p className="text-[10px] text-gray-400">{s.submissionCount}/{s.expectedCount}</p>
                            </div>
                          </div>
                          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-400 rounded-full" style={{ width: `${rate}%` }} />
                          </div>
                        </div>
                      )
                    })}
                    {atRisk.length > 8 && (
                      <div className="px-5 py-2.5 text-center">
                        <p className="text-[11px] text-gray-400">+{atRisk.length - 8} more students</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SEND snapshot */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users size={13} className="text-purple-600" />
                  <p className="text-[12px] font-bold text-purple-900">SEND Overview</p>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'On register',   value: sendCount },
                    { label: 'Active plans',   value: activePlanCount },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <p className="text-[12px] text-purple-700">{row.label}</p>
                      <p className="text-[14px] font-bold text-purple-900">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Homework snapshot */}
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen size={13} className="text-blue-500" />
                  <p className="text-[12px] font-bold text-gray-700">Homework</p>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Set this term', value: totalHwSet },
                    { label: 'Pending mark',  value: toMark,   colour: toMark > 0 ? 'text-amber-600' : undefined },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <p className="text-[12px] text-gray-500">{row.label}</p>
                      <p className={`text-[14px] font-bold ${row.colour ?? 'text-gray-800'}`}>{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>
    </AppShell>
  )
}
