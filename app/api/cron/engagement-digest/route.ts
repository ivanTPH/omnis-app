import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEngagementDigestEmail } from '@/lib/email'

export const maxDuration = 60

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const monthAgo = new Date()
  monthAgo.setDate(monthAgo.getDate() - 30)

  // Find all active schools via their SLT/SCHOOL_ADMIN users
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

  // Deduplicate by schoolId — send once per school (to all eligible recipients)
  const schoolMap = new Map<string, typeof recipients>()
  for (const r of recipients) {
    if (!schoolMap.has(r.schoolId)) schoolMap.set(r.schoolId, [])
    schoolMap.get(r.schoolId)!.push(r)
  }

  let sent = 0

  await Promise.allSettled(
    [...schoolMap.entries()].map(async ([schoolId, schoolRecipients]) => {
      const [
        totalStudents,
        activeStudents,
        submissionAgg,
        allAggs,
        pendingMark,
        openConcerns,
        newFlags,
      ] = await Promise.all([
        prisma.user.count({ where: { schoolId, role: 'STUDENT', isActive: true } }),
        // Students who submitted anything in the last 30 days
        prisma.submission.groupBy({
          by:    ['studentId'],
          where: { schoolId, submittedAt: { gte: monthAgo } },
        }).then(r => r.length),
        prisma.submission.aggregate({
          where: { schoolId, finalScore: { not: null }, submittedAt: { gte: monthAgo } },
          _avg:  { finalScore: true },
        }),
        prisma.classPerformanceAggregate.findMany({
          where:   { schoolId },
          orderBy: { termId: 'desc' },
        }),
        prisma.submission.count({ where: { schoolId, status: 'SUBMITTED' } }),
        prisma.sendConcern.count({ where: { schoolId, status: { in: ['open', 'under_review', 'escalated'] } } }),
        prisma.earlyWarningFlag.count({ where: { schoolId, createdAt: { gte: monthAgo } } }),
      ])

      // Avg completion rate from class aggregates
      const aggByClass = new Map<string, typeof allAggs[0]>()
      for (const a of allAggs) { if (!aggByClass.has(a.classId)) aggByClass.set(a.classId, a) }
      const aggsArr = Array.from(aggByClass.values())
      const avgCompletion = aggsArr.length
        ? aggsArr.reduce((s, a) => s + a.completionRate, 0) / aggsArr.length * 100
        : 0

      const baseUrl = process.env.NEXTAUTH_URL ?? 'https://omnis-app-ten.vercel.app'

      await Promise.allSettled(
        schoolRecipients.map(r =>
          sendEngagementDigestEmail({
            to:                 r.email,
            recipientFirstName: r.firstName,
            schoolName:         r.school.name,
            activeStudents,
            totalStudents,
            submissionRate:     avgCompletion,
            avgGrade:           submissionAgg._avg.finalScore,
            pendingMark,
            openConcerns,
            newFlags,
            dashboardUrl:       `${baseUrl}/slt/analytics`,
          })
        ),
      )
      sent += schoolRecipients.length
    }),
  )

  return NextResponse.json({ ok: true, sent })
}
