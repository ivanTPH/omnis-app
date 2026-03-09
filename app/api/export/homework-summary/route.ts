export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { auth }         from '@/lib/auth'
import { prisma }       from '@/lib/prisma'
import { generatePdf }  from '@/lib/pdf/generator'
import { homeworkSummaryPdf } from '@/lib/pdf/homework-summary-template'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any

  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId') ?? user.id

  // Auth: student can only export own; teachers/parents/admin can export any
  const allowedRoles = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'PLATFORM_ADMIN', 'PARENT']
  if (studentId !== user.id && !allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [student, enrolments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: { firstName: true, lastName: true },
    }),
    prisma.enrolment.findMany({
      where:   { userId: studentId },
      select:  { classId: true },
    }),
  ])

  const classIds = enrolments.map(e => e.classId)

  const homeworks = await prisma.homework.findMany({
    where:   { schoolId: user.schoolId, classId: { in: classIds }, status: { in: ['PUBLISHED', 'CLOSED'] } },
    orderBy: { dueAt: 'desc' },
    include: {
      class:       { select: { name: true, subject: true } },
      submissions: {
        where:  { studentId },
        select: { status: true, finalScore: true },
        take:   1,
      },
    },
  })

  const studentName = student
    ? `${student.firstName} ${student.lastName}`
    : studentId

  // Resolve max score from questions
  const hwIds = homeworks.map(h => h.id)
  const questionMaxes = await prisma.homeworkQuestion.groupBy({
    by: ['homeworkId'],
    _sum: { maxScore: true },
    where: { homeworkId: { in: hwIds } },
  })
  const maxByHw = new Map(questionMaxes.map(q => [q.homeworkId, q._sum.maxScore ?? null]))

  const html = homeworkSummaryPdf(
    homeworks.map(hw => ({
      title:     hw.title,
      subject:   hw.class?.subject ?? 'Unknown',
      className: hw.class?.name ?? null,
      type:      hw.type,
      setAt:     hw.createdAt,
      dueAt:     hw.dueAt,
      status:    hw.status,
      submission: hw.submissions[0]
        ? {
            status:     hw.submissions[0].status,
            finalScore: hw.submissions[0].finalScore,
            maxScore:   maxByHw.get(hw.id) ?? null,
          }
        : null,
    })),
    studentName,
    user.schoolName,
  )

  const pdf = await generatePdf(html)

  const safeName = studentName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const filename = `homework-summary-${safeName}.pdf`

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
