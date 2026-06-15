import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf/generator'
import { boardReportPdf } from '@/lib/pdf/board-report-template'

const ALLOWED = ['SLT', 'SCHOOL_ADMIN']

export const maxDuration = 60

export async function GET() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { schoolId } = user
  const last30days = new Date(Date.now() - 30 * 86_400_000)

  const [
    totalStudents,
    totalStaff,
    totalClasses,
    attendanceAgg,
    sendCount,
    ilpCount,
    ehcpCount,
    openConcerns,
    totalHomework,
    pendingMark,
    integrityFlagged,
    allAggs,
    school,
  ] = await Promise.all([
    prisma.user.count({ where: { schoolId, role: 'STUDENT', isActive: true } }),
    prisma.user.count({ where: { schoolId, role: { notIn: ['STUDENT', 'PARENT'] }, isActive: true } }),
    prisma.schoolClass.count({ where: { schoolId } }),
    prisma.user.aggregate({
      where: { schoolId, role: 'STUDENT', isActive: true, attendancePercentage: { not: null } },
      _avg: { attendancePercentage: true },
    }),
    prisma.sendStatus.count({ where: { student: { schoolId }, NOT: { activeStatus: 'NONE' } } }),
    prisma.individualLearningPlan.count({ where: { schoolId, status: 'active', approvedBySenco: true } }),
    prisma.ehcpPlan.count({ where: { schoolId, status: { not: 'ceased' } } }),
    prisma.sendConcern.count({ where: { schoolId, status: { in: ['open', 'under_review', 'escalated'] } } }),
    prisma.homework.count({ where: { schoolId, status: 'PUBLISHED' } }),
    prisma.submission.count({ where: { schoolId, status: 'SUBMITTED' } }),
    prisma.submissionIntegritySignal.count({
      where: {
        riskLevel: { in: ['MEDIUM', 'HIGH'] },
        attempt: { submission: { schoolId } },
        createdAt: { gte: last30days },
      },
    }),
    prisma.classPerformanceAggregate.findMany({
      where: { schoolId },
      orderBy: { termId: 'desc' },
    }),
    prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
  ])

  // Latest aggregate per class
  const aggByClass = new Map<string, typeof allAggs[0]>()
  for (const a of allAggs) { if (!aggByClass.has(a.classId)) aggByClass.set(a.classId, a) }
  const aggsArr = Array.from(aggByClass.values())

  const avgCompletion = aggsArr.length
    ? aggsArr.reduce((s, a) => s + a.completionRate, 0) / aggsArr.length * 100
    : 0
  const avgGrade = aggsArr.length
    ? aggsArr.reduce((s, a) => s + a.avgScore, 0) / aggsArr.length
    : null

  // Per-subject summaries from class performance aggregates
  const classes = await prisma.schoolClass.findMany({
    where: { schoolId },
    select: { id: true, subject: true },
  })
  const subjectMap = new Map<string, { aggs: number[]; completions: number[]; classCount: number }>()
  for (const cls of classes) {
    const agg = aggByClass.get(cls.id)
    if (!subjectMap.has(cls.subject)) subjectMap.set(cls.subject, { aggs: [], completions: [], classCount: 0 })
    const entry = subjectMap.get(cls.subject)!
    entry.classCount++
    if (agg) {
      entry.aggs.push(agg.avgScore)
      entry.completions.push(agg.completionRate * 100)
    }
  }

  const subjectSummaries = [...subjectMap.entries()].map(([subject, d]) => ({
    subject,
    classCount: d.classCount,
    avgGrade:   d.aggs.length ? d.aggs.reduce((a, b) => a + b, 0) / d.aggs.length : null,
    completion: d.completions.length ? d.completions.reduce((a, b) => a + b, 0) / d.completions.length : 0,
  })).sort((a, b) => a.subject.localeCompare(b.subject))

  const avgAttendance = attendanceAgg._avg.attendancePercentage
  const sendPct = totalStudents > 0 ? (sendCount / totalStudents) * 100 : 0

  const html = boardReportPdf({
    schoolName:       school?.name ?? user.schoolName,
    generatedAt:      new Date(),
    totalStudents,
    totalStaff,
    totalClasses,
    avgAttendance,
    sendCount,
    sendPct,
    ilpCount,
    ehcpCount,
    openConcerns,
    totalHomework,
    avgCompletion,
    avgGrade,
    pendingMark,
    integrityFlagged,
    subjectSummaries,
  })

  const pdf  = await generatePdf(html)
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="board-report-${date}.pdf"`,
    },
  })
}
