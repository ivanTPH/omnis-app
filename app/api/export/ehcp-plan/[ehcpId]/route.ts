import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { generatePdf } from '@/lib/pdf/generator'
import { ehcpPlanPdf } from '@/lib/pdf/ehcp-plan-template'

const ALLOWED = ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR']

export const maxDuration = 60

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ehcpId: string }> },
) {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { ehcpId } = await params

  const plan = await prisma.ehcpPlan.findFirst({
    where: { id: ehcpId, schoolId: user.schoolId },
    include: {
      student:  { select: { firstName: true, lastName: true, yearGroup: true, tutorGroup: true } },
      outcomes: {
        select: {
          section:          true,
          outcomeText:      true,
          successCriteria:  true,
          provisionRequired: true,
          targetDate:       true,
          status:           true,
        },
        orderBy: { section: 'asc' },
      },
    },
  })
  if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sections = (plan.sections as Record<string, string | null>) ?? {}

  const html = ehcpPlanPdf({
    studentName:     `${plan.student.firstName} ${plan.student.lastName}`,
    yearGroup:       plan.student.yearGroup,
    tutorGroup:      plan.student.tutorGroup,
    schoolName:      user.schoolName,
    localAuthority:  plan.localAuthority,
    coordinatorName: plan.coordinatorName,
    planDate:        plan.planDate,
    reviewDate:      plan.reviewDate,
    status:          plan.status,
    approvedBySenco: plan.approvedBySenco,
    approvedAt:      plan.approvedAt,
    sections,
    outcomes: plan.outcomes.map(o => ({
      section:          o.section,
      outcomeText:      o.outcomeText,
      successCriteria:  o.successCriteria,
      provisionRequired: o.provisionRequired,
      targetDate:       o.targetDate,
      status:           o.status,
    })),
  })

  const pdf      = await generatePdf(html)
  const safeName = `${plan.student.lastName}-${plan.student.firstName}`.replace(/[^a-zA-Z0-9-]/g, '')
  const date     = new Date().toISOString().slice(0, 10)

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="ehcp-plan-${safeName}-${date}.pdf"`,
    },
  })
}
