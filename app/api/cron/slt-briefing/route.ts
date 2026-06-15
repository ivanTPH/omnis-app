import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendSltBriefingEmail } from '@/lib/email'

export const maxDuration = 60

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const now      = new Date()
  const weekAgo  = new Date(now.getTime() - 7  * 86_400_000)
  const in14days = new Date(now.getTime() + 14 * 86_400_000)

  const weekLabel = now.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // Find all SLT/SCHOOL_ADMIN users grouped by school
  const recipients = await prisma.user.findMany({
    where: { role: { in: ['SLT', 'SCHOOL_ADMIN'] }, isActive: true },
    select: {
      id:        true,
      email:     true,
      firstName: true,
      schoolId:  true,
      school:    { select: { name: true } },
    },
  })

  const schoolMap = new Map<string, typeof recipients>()
  for (const r of recipients) {
    if (!schoolMap.has(r.schoolId)) schoolMap.set(r.schoolId, [])
    schoolMap.get(r.schoolId)!.push(r)
  }

  let sent = 0

  await Promise.allSettled(
    [...schoolMap.entries()].map(async ([schoolId, schoolRecipients]) => {
      const [
        newConcerns,
        pendingMark,
        ehcpReviewsDue14,
        highFlags,
        newIntegritySignals,
      ] = await Promise.all([
        prisma.sendConcern.count({
          where: { schoolId, createdAt: { gte: weekAgo } },
        }),
        prisma.submission.count({
          where: { schoolId, status: 'SUBMITTED' },
        }),
        prisma.ehcpPlan.count({
          where: { schoolId, reviewDate: { lte: in14days }, status: { not: 'ceased' } },
        }),
        prisma.earlyWarningFlag.count({
          where: { schoolId, severity: 'high', isActioned: false, expiresAt: { gte: now } },
        }),
        prisma.submissionIntegritySignal.count({
          where: {
            riskLevel: { in: ['MEDIUM', 'HIGH'] },
            createdAt: { gte: weekAgo },
            attempt:   { submission: { schoolId } },
          },
        }),
      ])

      const baseUrl = process.env.NEXTAUTH_URL ?? 'https://omnis-app-ten.vercel.app'

      await Promise.allSettled(
        schoolRecipients.map(r =>
          sendSltBriefingEmail({
            to:                 r.email,
            recipientFirstName: r.firstName,
            schoolName:         r.school.name,
            weekLabel,
            newConcerns,
            pendingMark,
            ehcpReviewsDue14,
            highFlags,
            newIntegritySignals,
            dashboardUrl:       `${baseUrl}/slt/analytics`,
          })
        ),
      )
      sent += schoolRecipients.length
    }),
  )

  return NextResponse.json({ ok: true, sent })
}
