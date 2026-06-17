import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma, writeAudit } from '@/lib/prisma'
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

  const [student, parentLink, school] = await Promise.all([
    prisma.user.findFirst({
      where: { id: studentId, schoolId: user.schoolId, role: 'STUDENT', isActive: true },
      select: {
        firstName:            true,
        lastName:             true,
        yearGroup:            true,
        tutorGroup:           true,
        attendancePercentage: true,
      },
    }),
    prisma.parentChildLink.findFirst({
      where: { childId: studentId },
      select: { parent: { select: { firstName: true, lastName: true } } },
    }),
    prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { name: true },
    }),
  ])

  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (student.attendancePercentage == null) {
    return NextResponse.json({ error: 'No attendance data for this student' }, { status: 422 })
  }

  const studentName = `${student.firstName} ${student.lastName}`
  const schoolName  = school?.name ?? user.schoolName
  const parentName  = parentLink
    ? `${parentLink.parent.firstName} ${parentLink.parent.lastName}`
    : null

  // Auto-log the letter as a parent contact entry
  void prisma.parentContactEntry.create({
    data: {
      schoolId:    user.schoolId,
      studentId,
      authorId:    user.id,
      contactDate: new Date(),
      method:      'LETTER',
      summary:     `Attendance warning letter generated (${student.attendancePercentage.toFixed(1)}%)`,
      outcome:     null,
    },
  }).catch(() => {})  // best-effort — never block PDF generation

  void writeAudit({
    schoolId:   user.schoolId,
    actorId:    user.id,
    action:     'PARENT_CONTACT_LOGGED',
    targetType: 'User',
    targetId:   studentId,
    metadata:   { method: 'LETTER', reason: 'attendance_warning', attendancePct: student.attendancePercentage },
  }).catch(() => {})

  const html = attendanceLetterPdf({
    studentName,
    yearGroup:         student.yearGroup,
    tutorGroup:        student.tutorGroup,
    attendancePct:     student.attendancePercentage,
    schoolName,
    parentGuardianName: parentName,
    letterDate:        new Date(),
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
