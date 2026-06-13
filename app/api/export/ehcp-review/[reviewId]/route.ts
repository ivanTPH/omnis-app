export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { auth }          from '@/lib/auth'
import type { AuthUser } from '@/lib/session'
import { prisma }        from '@/lib/prisma'
import { generatePdf }   from '@/lib/pdf/generator'
import { ehcpReviewPdf } from '@/lib/pdf/ehcp-review-template'

const ALLOWED_ROLES = ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as AuthUser
  if (!ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { reviewId } = await params

  const review = await prisma.ehcpAnnualReview.findFirst({
    where: { id: reviewId, schoolId: user.schoolId },
    include: {
      ehcp: {
        select: {
          localAuthority: true,
          student: { select: { firstName: true, lastName: true, yearGroup: true } },
        },
      },
      reviewer: { select: { firstName: true, lastName: true } },
    },
  })

  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  const studentName = `${review.ehcp.student.firstName} ${review.ehcp.student.lastName}`

  const html = ehcpReviewPdf({
    studentName,
    yearGroup:        review.ehcp.student.yearGroup,
    localAuthority:   review.ehcp.localAuthority,
    schoolName:       user.schoolName,
    reviewDate:       review.reviewDate,
    reviewerName:     `${review.reviewer.firstName} ${review.reviewer.lastName}`,
    summary:          review.summary,
    progressRating:   review.progressRating,
    parentComments:   review.parentComments,
    amendmentsNeeded: review.amendmentsNeeded,
    newReviewDate:    review.newReviewDate,
    laNotified:       review.laNotified,
  })

  const pdf  = await generatePdf(html)
  const slug = studentName.toLowerCase().replace(/\s+/g, '-')
  const year = new Date(review.reviewDate).getFullYear()

  return new NextResponse(pdf, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="ehcp-annual-review-${year}-${slug}.pdf"`,
    },
  })
}
