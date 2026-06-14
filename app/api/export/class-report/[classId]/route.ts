export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf/generator'
import { classReportPdf } from '@/lib/pdf/class-report-template'

const ALLOWED = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'SENCO']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { classId } = await params

  // Verify class belongs to the school
  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: classId, schoolId: user.schoolId },
    include: {
      teachers: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  })
  if (!schoolClass) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 })
  }

  // For teachers, ensure they teach this class
  if (user.role === 'TEACHER') {
    const teaches = schoolClass.teachers.some(t => t.userId === user.id)
    if (!teaches) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Fetch enrolled students with SEND status
  const enrolments = await prisma.enrolment.findMany({
    where: { classId, class: { schoolId: user.schoolId } },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          sendStatus: {
            select: { activeStatus: true },
          },
        },
      },
    },
  })

  // Fetch recent homework for this class (last 10 published)
  const homeworkList = await prisma.homework.findMany({
    where: { classId, schoolId: user.schoolId, status: 'PUBLISHED' },
    orderBy: { dueAt: 'desc' },
    take: 10,
    select: {
      id: true,
      title: true,
      dueAt: true,
      type: true,
      submissions: {
        where: { schoolId: user.schoolId },
        select: { studentId: true, teacherScore: true, autoScore: true, status: true },
      },
    },
  })

  const enrolledCount = enrolments.length

  // Per-student: submission counts + avg score across all class homework
  const allHwIds = homeworkList.map(h => h.id)

  const allSubmissions = allHwIds.length > 0
    ? await prisma.submission.findMany({
        where: {
          schoolId: user.schoolId,
          homeworkId: { in: allHwIds },
          studentId: { in: enrolments.map(e => e.userId) },
        },
        select: { studentId: true, homeworkId: true, teacherScore: true, autoScore: true, status: true },
      })
    : []

  // Group submissions by student
  const subsByStudent = new Map<string, typeof allSubmissions>()
  for (const sub of allSubmissions) {
    if (!subsByStudent.has(sub.studentId)) subsByStudent.set(sub.studentId, [])
    subsByStudent.get(sub.studentId)!.push(sub)
  }

  // Build student rows
  const students = enrolments.map(e => {
    const subs = subsByStudent.get(e.userId) ?? []
    const scores = subs
      .map(s => s.teacherScore ?? s.autoScore)
      .filter((s): s is number => s != null)
    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null
    const sendStatus = (e.user.sendStatus?.activeStatus ?? 'NONE') as 'NONE' | 'SEN_SUPPORT' | 'EHCP'
    return {
      firstName: e.user.firstName,
      lastName: e.user.lastName,
      sendStatus,
      avgScore,
      submitted: subs.filter(s => s.status !== 'SUBMITTED' || true).length, // count any submission
      total: allHwIds.length,
    }
  })

  // ClassPerformanceAggregate for overall avg (most recent)
  const aggregate = await prisma.classPerformanceAggregate.findFirst({
    where: { classId, schoolId: user.schoolId },
    orderBy: { id: 'desc' },
    select: { avgScore: true },
  })

  // Build homework rows
  const homework = homeworkList.map(h => {
    const subs = h.submissions
    const submitted = subs.length
    const scores = subs
      .map(s => s.teacherScore ?? s.autoScore)
      .filter((s): s is number => s != null)
    const avgGrade = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null
    return {
      title: h.title,
      dueAt: h.dueAt.toISOString(),
      type: h.type,
      submitted,
      enrolled: enrolledCount,
      avgGrade,
    }
  })

  const teacherNames = schoolClass.teachers.map(t => `${t.user.firstName} ${t.user.lastName}`)

  const html = classReportPdf({
    className:   schoolClass.name,
    subject:     schoolClass.subject,
    yearGroup:   schoolClass.yearGroup,
    teachers:    teacherNames.length > 0 ? teacherNames : ['—'],
    examBoard:   schoolClass.examBoard ?? null,
    schoolName:  user.schoolName,
    generatedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    students,
    homework,
    overallAvg:  aggregate?.avgScore ?? null,
  })

  const pdf  = await generatePdf(html)
  const date = new Date().toISOString().slice(0, 10)
  const name = `class-report-${schoolClass.name.replace(/\s+/g, '-').toLowerCase()}-${date}.pdf`

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  })
}
