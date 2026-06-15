import { NextResponse }                        from 'next/server'
import { prisma }                              from '@/lib/prisma'
import { sendParentActivationReminderEmail }   from '@/lib/email'

export const maxDuration = 60

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find schools with unactivated parents
  const unactivatedParents = await prisma.user.findMany({
    where: { role: 'PARENT', isActive: true, activatedAt: null },
    select: {
      id:        true,
      firstName: true,
      lastName:  true,
      email:     true,
      schoolId:  true,
      school:    { select: { name: true } },
    },
    orderBy: [{ schoolId: 'asc' }, { lastName: 'asc' }],
  })

  if (unactivatedParents.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  // Group by schoolId
  const bySchool = new Map<string, { schoolName: string; parents: { name: string; email: string }[] }>()
  for (const p of unactivatedParents) {
    if (!bySchool.has(p.schoolId)) {
      bySchool.set(p.schoolId, { schoolName: p.school.name, parents: [] })
    }
    bySchool.get(p.schoolId)!.parents.push({
      name:  `${p.firstName} ${p.lastName}`,
      email: p.email,
    })
  }

  let sent = 0

  await Promise.allSettled(
    [...bySchool.entries()].map(async ([schoolId, { schoolName, parents }]) => {
      // Find SCHOOL_ADMIN users for this school
      const admins = await prisma.user.findMany({
        where:  { schoolId, role: 'SCHOOL_ADMIN', isActive: true },
        select: { email: true, firstName: true },
      })

      await Promise.allSettled(
        admins.map(admin =>
          sendParentActivationReminderEmail({
            to:               admin.email,
            adminFirstName:   admin.firstName,
            schoolName,
            unactivatedCount: parents.length,
            parents,
          })
        )
      )

      sent += admins.length
    })
  )

  return NextResponse.json({ sent, schools: bySchool.size })
}
