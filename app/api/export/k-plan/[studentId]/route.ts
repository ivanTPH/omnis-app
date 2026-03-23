export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { auth }        from '@/lib/auth'
import { prisma }      from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf/generator'
import { kPlanPdf }    from '@/lib/pdf/k-plan-template'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const user = session.user as { id: string; schoolId: string; schoolName: string; role: string }

  const allowedRoles = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN']
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { studentId } = await params
  const isSencoTier = ['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(user.role)

  const [student, passport] = await Promise.all([
    prisma.user.findFirst({
      where: { id: studentId, schoolId: user.schoolId, role: 'STUDENT' },
      select: { firstName: true, lastName: true, yearGroup: true, sendStatus: { select: { needArea: true } } },
    }),
    prisma.learnerPassport.findFirst({
      where: {
        studentId,
        schoolId: user.schoolId,
        ...(isSencoTier ? {} : { status: 'APPROVED' }),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    }),
  ])

  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
  if (!passport) return NextResponse.json({ error: 'No K Plan found' }, { status: 404 })

  // Resolve approvedBy name
  let approvedByName: string | null = null
  if (passport.approvedBy) {
    const approver = await prisma.user.findUnique({
      where: { id: passport.approvedBy },
      select: { firstName: true, lastName: true },
    })
    if (approver) approvedByName = `${approver.firstName} ${approver.lastName}`
  }

  // Find ILP review date for "review due" line
  const ilp = passport.ilpId
    ? await prisma.individualLearningPlan.findUnique({
        where:  { id: passport.ilpId },
        select: { reviewDate: true },
      })
    : null

  const studentName = `${student.firstName} ${student.lastName}`

  const html = kPlanPdf({
    studentName,
    yearGroup:          student.yearGroup,
    sendCategory:       student.sendStatus?.needArea ?? 'General Learning Support',
    schoolName:         user.schoolName,
    approvedAt:         passport.approvedAt,
    approvedByName,
    reviewDate:         ilp?.reviewDate ?? null,
    sendInformation:    passport.sendInformation,
    teacherActions:     passport.teacherActions,
    studentCommitments: passport.studentCommitments,
  })

  const pdf = await generatePdf(html, { landscape: true })

  const slug = studentName.toLowerCase().replace(/\s+/g, '-')
  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="k-plan-${slug}.pdf"`,
    },
  })
}
