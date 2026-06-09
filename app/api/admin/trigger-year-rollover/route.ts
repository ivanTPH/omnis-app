/**
 * POST /api/admin/trigger-year-rollover
 *
 * Manual year rollover for the caller's school only.
 * Restricted to SCHOOL_ADMIN role.
 * Accepts optional { dryRun: true } body to preview counts without applying changes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma, writeAudit } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  const user    = session?.user
  if (!user?.schoolId || user.role !== 'SCHOOL_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let dryRun = false
  try {
    const body = await req.json()
    dryRun = body?.dryRun === true
  } catch { /* no body — fine */ }

  const students = await prisma.user.findMany({
    where:  { schoolId: user.schoolId, role: 'STUDENT', isActive: true },
    select: { id: true, yearGroup: true },
  })

  const toPromote  = students.filter(s => s.yearGroup !== null && s.yearGroup < 13)
  const toGraduate = students.filter(s => s.yearGroup === 13)

  if (dryRun) {
    return NextResponse.json({
      dryRun:    true,
      promoted:  toPromote.length,
      graduated: toGraduate.length,
    })
  }

  if (toPromote.length > 0) {
    await prisma.$executeRaw`
      UPDATE "User"
      SET "yearGroup" = "yearGroup" + 1
      WHERE id = ANY(${toPromote.map(s => s.id)})
    `
  }

  if (toGraduate.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: toGraduate.map(s => s.id) } },
      data:  { isActive: false },
    })
  }

  await writeAudit({
    schoolId:   user.schoolId,
    actorId:    user.id,
    action:     'YEAR_ROLLOVER',
    targetType: 'school',
    targetId:   user.schoolId,
    metadata:   { promoted: toPromote.length, graduated: toGraduate.length, triggeredBy: 'manual' },
  })

  return NextResponse.json({ ok: true, promoted: toPromote.length, graduated: toGraduate.length })
}
