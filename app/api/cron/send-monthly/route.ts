import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendSendMonthlySummaryEmail } from '@/lib/email'

export const maxDuration = 60

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Find all active SENCO users across all schools
  const sencos = await prisma.user.findMany({
    where: { role: 'SENCO', isActive: true },
    select: { id: true, email: true, firstName: true, schoolId: true, school: { select: { name: true } } },
  })

  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  let sent = 0

  await Promise.allSettled(
    sencos.map(async senco => {
      const { schoolId } = senco

      const [openConcernsCount, ilpsUnderReview, ehcpsDue30, concernsByStudent] = await Promise.all([
        prisma.sendConcern.count({
          where: { schoolId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
        }),
        prisma.iLP.count({
          where: { schoolId, status: 'UNDER_REVIEW' },
        }),
        prisma.ehcpPlan.count({
          where: { schoolId, reviewDate: { lte: in30Days } },
        }),
        // Top students by open concern count
        prisma.sendConcern.groupBy({
          by: ['studentId'],
          where: { schoolId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 5,
        }),
      ])

      // Resolve student names for top concern holders
      const topStudentIds = concernsByStudent.map(r => r.studentId)
      const topStudentUsers = topStudentIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: topStudentIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : []
      const nameMap = new Map(topStudentUsers.map(u => [u.id, `${u.firstName} ${u.lastName}`]))

      const topStudents = concernsByStudent.map(r => ({
        name: nameMap.get(r.studentId) ?? '—',
        concerns: r._count.id,
      }))

      const baseUrl = process.env.NEXTAUTH_URL ?? 'https://omnis-app-ten.vercel.app'

      await sendSendMonthlySummaryEmail({
        to:             senco.email,
        sencoFirstName: senco.firstName,
        schoolName:     senco.school.name,
        openConcerns:   openConcernsCount,
        ilpsUnderReview,
        ehcpsDue30,
        topStudents,
        dashboardUrl:   `${baseUrl}/senco/dashboard`,
      })

      sent++
    }),
  )

  return NextResponse.json({ ok: true, sent })
}
