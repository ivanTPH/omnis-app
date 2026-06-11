export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { auth }        from '@/lib/auth'
import type { AuthUser } from '@/lib/session'
import { prisma }      from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf/generator'
import { apdrPdf }     from '@/lib/pdf/apdr-template'

const ALLOWED_ROLES = ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ apdrId: string }> },
) {
  // Use auth() directly so unauthenticated API requests get 401, not a redirect.
  // (requireAuth() calls redirect('/login') which Playwright follows → 200.)
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = session.user as AuthUser
  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { apdrId } = await params
  const apdr = await prisma.assessPlanDoReview.findFirst({
    where: { id: apdrId, schoolId: user.schoolId },
    include: {
      student: {
        select: {
          firstName: true, lastName: true, yearGroup: true,
          sendStatus: { select: { needArea: true } },
        },
      },
      creator: { select: { firstName: true, lastName: true } },
    },
  })

  if (!apdr) return NextResponse.json({ error: 'APDR not found' }, { status: 404 })

  let approvedByName: string | null = null
  if (apdr.approvedBy) {
    const approver = await prisma.user.findUnique({
      where:  { id: apdr.approvedBy },
      select: { firstName: true, lastName: true },
    })
    if (approver) approvedByName = `${approver.firstName} ${approver.lastName}`
  }

  const studentName = `${apdr.student.firstName} ${apdr.student.lastName}`
  const completedAt = apdr.status === 'COMPLETED' ? apdr.updatedAt : null

  const html = apdrPdf({
    studentName,
    yearGroup:      apdr.student.yearGroup,
    sendCategory:   apdr.student.sendStatus?.needArea ?? 'General Learning Support',
    schoolName:     user.schoolName,
    cycleNumber:    apdr.cycleNumber,
    reviewDate:     apdr.reviewDate,
    completedAt,
    approvedBySenco: apdr.approvedBySenco,
    approvedAt:     apdr.approvedAt,
    approvedByName,
    createdByName:  `${apdr.creator.firstName} ${apdr.creator.lastName}`,
    assessContent:  apdr.assessContent,
    planContent:    apdr.planContent,
    doContent:      apdr.doContent,
    reviewContent:  apdr.reviewContent,
    outcomeRating:  apdr.outcomeRating,
    parentComments: apdr.parentComments,
  })

  const pdf  = await generatePdf(html)
  const slug = studentName.toLowerCase().replace(/\s+/g, '-')

  return new NextResponse(pdf, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="apdr-cycle-${apdr.cycleNumber}-${slug}.pdf"`,
    },
  })
}
