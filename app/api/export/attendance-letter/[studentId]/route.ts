import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf/generator'
import { attendanceLetterPdf } from '@/lib/pdf/attendance-letter-template'

const ALLOWED = ['SCHOOL_ADMIN', 'SLT', 'HEAD_OF_YEAR']

export const maxDuration = 60

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { studentId } = await params

  const student = await prisma.user.findFirst({
    where: { id: studentId, schoolId: user.schoolId, role: 'STUDENT', isActive: true },
    select: {
      firstName:            true,
      lastName:             true,
      yearGroup:            true,
      tutorGroup:           true,
      attendancePercentage: true,
    },
  })
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (student.attendancePercentage == null) {
    return NextResponse.json({ error: 'No attendance data for this student' }, { status: 422 })
  }

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true },
  })

  const html = attendanceLetterPdf({
    studentName:   `${student.firstName} ${student.lastName}`,
    yearGroup:     student.yearGroup,
    tutorGroup:    student.tutorGroup,
    attendancePct: student.attendancePercentage,
    schoolName:    school?.name ?? user.schoolName,
    letterDate:    new Date(),
  })

  const pdf = await generatePdf(html)

  const safeName = `${student.lastName}-${student.firstName}`.replace(/[^a-zA-Z0-9-]/g, '')
  const date     = new Date().toISOString().slice(0, 10)

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="attendance-letter-${safeName}-${date}.pdf"`,
    },
  })
}
