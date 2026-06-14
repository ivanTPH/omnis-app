export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf/generator'
import { yearGroupReportPdf } from '@/lib/pdf/year-group-report-template'

const ALLOWED = ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'SENCO']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ yearGroup: string }> },
) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { yearGroup: ygParam } = await params
  const yearGroup = parseInt(ygParam, 10)
  if (isNaN(yearGroup) || yearGroup < 7 || yearGroup > 13) {
    return NextResponse.json({ error: 'Invalid year group' }, { status: 400 })
  }

  // Fetch students in year group
  const students = await prisma.user.findMany({
    where: { schoolId: user.schoolId, role: 'STUDENT', isActive: true, yearGroup },
    select: {
      id: true,
      attendancePercentage: true,
      sendStatus: { select: { activeStatus: true } },
      ehcpPlans: { select: { id: true }, take: 1 },
    },
  })

  const studentIds = students.map(s => s.id)

  // SEND counts
  const sendCount = students.filter(s =>
    s.sendStatus?.activeStatus && s.sendStatus.activeStatus !== 'NONE'
  ).length
  const ehcpCount = students.filter(s => s.ehcpPlans.length > 0).length
  const lowAttendance = students.filter(s =>
    s.attendancePercentage != null && s.attendancePercentage < 90
  ).length

  const attendancePcts = students
    .map(s => s.attendancePercentage)
    .filter((p): p is number => p != null)
  const avgAttendance = attendancePcts.length > 0
    ? Math.round(attendancePcts.reduce((a, b) => a + b, 0) / attendancePcts.length)
    : null

  // Open concerns for year group
  const openConcerns = await prisma.sendConcern.count({
    where: {
      schoolId: user.schoolId,
      studentId: { in: studentIds },
      status: { in: ['open', 'under_review', 'escalated'] },
    },
  })

  // Classes in this year group
  const classes = await prisma.schoolClass.findMany({
    where: { schoolId: user.schoolId, yearGroup },
    include: {
      enrolments: { select: { userId: true } },
      performanceAggregates: {
        orderBy: { id: 'desc' },
        take: 1,
        select: { avgScore: true, completionRate: true },
      },
    },
    orderBy: { subject: 'asc' },
  })

  // Homework completion for year group (last 30 days)
  const last30 = new Date(Date.now() - 30 * 86_400_000)
  const hwList = await prisma.homework.findMany({
    where: {
      schoolId: user.schoolId,
      classId: { in: classes.map(c => c.id) },
      status: 'PUBLISHED',
      dueAt: { gte: last30 },
    },
    select: {
      classId: true,
      _count: { select: { submissions: true } },
    },
  })

  const hwByClass = new Map<string, { submitted: number; total: number }>()
  for (const cls of classes) {
    hwByClass.set(cls.id, { submitted: 0, total: 0 })
  }
  for (const hw of hwList) {
    const entry = hwByClass.get(hw.classId)
    const enrolled = classes.find(c => c.id === hw.classId)?.enrolments.length ?? 0
    if (entry && enrolled > 0) {
      entry.submitted += hw._count.submissions
      entry.total     += enrolled
    }
  }

  // HOY name
  const hoyUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { firstName: true, lastName: true },
  })
  const teacherName = hoyUser ? `${hoyUser.firstName} ${hoyUser.lastName}` : user.id

  const classRows = classes.map(c => {
    const agg = c.performanceAggregates[0]
    const hw  = hwByClass.get(c.id)
    return {
      name:         c.name,
      subject:      c.subject,
      studentCount: c.enrolments.length,
      submitted:    hw?.submitted ?? 0,
      total:        hw?.total ?? 0,
      avgGrade:     agg?.avgScore ?? null,
    }
  })

  const html = yearGroupReportPdf({
    yearGroup,
    schoolName:   user.schoolName,
    generatedAt:  new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    teacherName,
    studentCount: students.length,
    sendCount,
    ehcpCount,
    avgAttendance,
    lowAttendance,
    openConcerns,
    classes: classRows,
  })

  const pdf  = await generatePdf(html)
  const date = new Date().toISOString().slice(0, 10)
  const name = `year-${yearGroup}-report-${date}.pdf`

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  })
}
