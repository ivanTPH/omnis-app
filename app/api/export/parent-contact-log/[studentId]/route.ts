import { NextRequest, NextResponse } from 'next/server'
import { requireAuth }              from '@/lib/session'
import { prisma }                   from '@/lib/prisma'
import { generatePdf }              from '@/lib/pdf/generator'
import { parentContactLogPdf }      from '@/lib/pdf/parent-contact-log-template'

export const maxDuration = 60

const ALLOWED_ROLES = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params

  const user = await requireAuth(ALLOWED_ROLES, '/dashboard')
  const { schoolId, schoolName } = user

  // Verify student belongs to this school
  const student = await prisma.user.findFirst({
    where:  { id: studentId, schoolId, role: 'STUDENT' },
    select: { id: true, firstName: true, lastName: true, yearGroup: true, tutorGroup: true },
  })
  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  }

  // Fetch contact log entries
  const entries = await prisma.parentContactEntry.findMany({
    where:   { studentId, schoolId },
    orderBy: { contactDate: 'desc' },
    select: {
      contactDate: true,
      method:      true,
      summary:     true,
      outcome:     true,
      author: {
        select: { firstName: true, lastName: true, role: true },
      },
    },
  })

  const html = parentContactLogPdf({
    studentName: `${student.firstName} ${student.lastName}`,
    yearGroup:   student.yearGroup,
    formClass:   student.tutorGroup,
    schoolName,
    entries: entries.map(e => ({
      contactDate: e.contactDate.toISOString(),
      method:      e.method,
      summary:     e.summary,
      outcome:     e.outcome,
      authorName:  `${e.author.firstName} ${e.author.lastName}`,
      authorRole:  e.author.role,
    })),
  })

  const pdf = await generatePdf(html)
  const safeName = `${student.firstName}_${student.lastName}`.replace(/\s+/g, '_')

  return new NextResponse(pdf, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="contact-log-${safeName}.pdf"`,
    },
  })
}
