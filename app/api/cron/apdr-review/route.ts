import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import { sendApdrReviewReminderEmail } from '@/lib/email'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now     = new Date()
  const in14    = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  // Find all active APDR cycles with review date within next 14 days (including overdue)
  const cycles = await prisma.assessPlanDoReview.findMany({
    where: { status: 'ACTIVE', reviewDate: { lte: in14 } },
    include: {
      student: { select: { firstName: true, lastName: true, yearGroup: true, schoolId: true } },
    },
    orderBy: { reviewDate: 'asc' },
  })

  if (cycles.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No upcoming APDR reviews' })
  }

  // Group by school
  const bySchool = new Map<string, typeof cycles>()
  for (const c of cycles) {
    const sid = c.student.schoolId
    if (!bySchool.has(sid)) bySchool.set(sid, [])
    bySchool.get(sid)!.push(c)
  }

  let sent = 0
  const errors: string[] = []

  for (const [schoolId, schoolCycles] of bySchool) {
    try {
      // Find the school's SENCO(s)
      const sencos = await prisma.user.findMany({
        where:  { schoolId, role: 'SENCO', isActive: true },
        select: { id: true, firstName: true, email: true },
      })
      if (sencos.length === 0) continue

      const school = await prisma.school.findUnique({
        where:  { id: schoolId },
        select: { name: true },
      })
      if (!school) continue

      const reviewsDue = schoolCycles.map(c => {
        const daysUntil = Math.ceil(
          (new Date(c.reviewDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
        return {
          studentName: `${c.student.firstName} ${c.student.lastName}`,
          yearGroup:   c.student.yearGroup,
          reviewDate:  c.reviewDate.toISOString(),
          daysUntil,
        }
      })

      await Promise.allSettled(
        sencos.map(senco =>
          sendApdrReviewReminderEmail({
            to:             senco.email,
            sencoFirstName: senco.firstName,
            schoolName:     school.name,
            reviewsDue,
          })
        )
      )

      sent += sencos.length
    } catch (err) {
      errors.push(`schoolId ${schoolId}: ${String(err)}`)
    }
  }

  return NextResponse.json({
    ok:     errors.length === 0,
    sent,
    schools: bySchool.size,
    cycles:  cycles.length,
    errors:  errors.length > 0 ? errors : undefined,
  })
}
