export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { auth }         from '@/lib/auth'
import { prisma }       from '@/lib/prisma'
import { generatePdf }  from '@/lib/pdf/generator'
import { revisionTimetablePdf } from '@/lib/pdf/revision-timetable-template'

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any

  const { searchParams } = new URL(req.url)
  const studentId  = searchParams.get('studentId') ?? user.id
  const weekParam  = searchParams.get('weekStart')

  // Auth: student can only export own; staff/admin can export any
  const allowedRoles = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'PLATFORM_ADMIN']
  if (studentId !== user.id && !allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const monday = weekParam ? getMonday(new Date(weekParam)) : getMonday(new Date())
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const [sessions, exams, student] = await Promise.all([
    prisma.revisionSession.findMany({
      where: { studentId, scheduledAt: { gte: monday, lte: sunday } },
      orderBy: { scheduledAt: 'asc' },
    }),
    prisma.revisionExam.findMany({
      where: { studentId, examDate: { gte: new Date() } },
      orderBy: { examDate: 'asc' },
    }),
    prisma.user.findUnique({
      where: { id: studentId },
      select: { firstName: true, lastName: true },
    }),
  ])

  const studentName = student ? `${student.firstName} ${student.lastName}` : studentId

  const html = revisionTimetablePdf(
    sessions.map(s => ({
      subject:      s.subject,
      topic:        s.topic,
      scheduledAt:  s.scheduledAt,
      durationMins: s.durationMins,
      status:       s.status,
    })),
    exams.map(e => ({
      subject:   e.subject,
      examDate:  e.examDate,
      paperName: e.paperName,
      examBoard: e.examBoard,
    })),
    studentName,
    user.schoolName,
    monday,
  )

  const pdf = await generatePdf(html, { landscape: true })

  const weekStr  = monday.toISOString().slice(0, 10)
  const filename = `revision-timetable-${weekStr}.pdf`

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
