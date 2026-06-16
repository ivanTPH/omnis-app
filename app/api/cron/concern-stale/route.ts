import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import { sendStaleConcernAlertEmail } from '@/lib/email'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now   = new Date()
  const ago30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Concerns that are open AND have never been reviewed AND were created 30+ days ago
  const concerns = await prisma.sendConcern.findMany({
    where: {
      status:     { notIn: ['closed', 'no_action'] },
      reviewedAt: null,
      createdAt:  { lte: ago30 },
    },
    select: {
      id:          true,
      schoolId:    true,
      category:    true,
      createdAt:   true,
      student:     { select: { firstName: true, lastName: true, yearGroup: true } },
      raisedByUser: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (concerns.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No stale concerns found' })
  }

  // Group by school
  const bySchool = new Map<string, typeof concerns>()
  for (const c of concerns) {
    if (!bySchool.has(c.schoolId)) bySchool.set(c.schoolId, [])
    bySchool.get(c.schoolId)!.push(c)
  }

  let sent   = 0
  const errors: string[] = []

  for (const [schoolId, schoolConcerns] of bySchool) {
    try {
      const school = await prisma.school.findUnique({
        where:  { id: schoolId },
        select: { name: true },
      })
      if (!school) continue

      const sencos = await prisma.user.findMany({
        where:  { schoolId, role: 'SENCO', isActive: true },
        select: { id: true, firstName: true, email: true },
      })
      if (sencos.length === 0) continue

      const rows = schoolConcerns.map(c => ({
        studentName: `${c.student.firstName} ${c.student.lastName}`,
        yearGroup:   c.student.yearGroup,
        category:    c.category,
        daysOpen:    Math.floor((now.getTime() - new Date(c.createdAt).getTime()) / 86_400_000),
        raiserName:  `${c.raisedByUser.firstName} ${c.raisedByUser.lastName}`,
      }))

      await Promise.allSettled(
        sencos.map(s =>
          sendStaleConcernAlertEmail({
            to:             s.email,
            sencoFirstName: s.firstName,
            schoolName:     school.name,
            concerns:       rows,
          })
        )
      )

      sent += sencos.length
    } catch (err) {
      errors.push(`schoolId ${schoolId}: ${String(err)}`)
    }
  }

  return NextResponse.json({
    ok:       errors.length === 0,
    sent,
    schools:  bySchool.size,
    concerns: concerns.length,
    errors:   errors.length > 0 ? errors : undefined,
  })
}
