/**
 * GET /api/cron/year-rollover
 *
 * Runs on 1 September at 01:00 UTC each year.
 * For every active school: increments yearGroup by 1 for all active students.
 * Students who were in Year 13 are set isActive=false (leavers).
 * Writes a YEAR_ROLLOVER audit entry per school.
 *
 * Can also be triggered manually via POST /api/admin/trigger-year-rollover
 * (SCHOOL_ADMIN only — rolls over the caller's school only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma, writeAudit } from '@/lib/prisma'

export const maxDuration = 300

async function runRolloverForSchool(schoolId: string): Promise<{ promoted: number; graduated: number }> {
  // Fetch all active students for this school
  const students = await prisma.user.findMany({
    where: { schoolId, role: 'STUDENT', isActive: true },
    select: { id: true, yearGroup: true },
  })

  const toPromote   = students.filter(s => s.yearGroup !== null && s.yearGroup < 13)
  const toGraduate  = students.filter(s => s.yearGroup === 13)

  // Promote Year 7–12 students
  if (toPromote.length > 0) {
    await prisma.$executeRaw`
      UPDATE "User"
      SET "yearGroup" = "yearGroup" + 1
      WHERE id = ANY(${toPromote.map(s => s.id)})
    `
  }

  // Deactivate Year 13 leavers
  if (toGraduate.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: toGraduate.map(s => s.id) } },
      data:  { isActive: false },
    })
  }

  return { promoted: toPromote.length, graduated: toGraduate.length }
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const schools = await prisma.school.findMany({
    where:  { isActive: true },
    select: { id: true, name: true },
  })

  const results: Array<{ schoolId: string; schoolName: string; promoted: number; graduated: number }> = []
  const errors: string[] = []

  for (const school of schools) {
    try {
      const r = await runRolloverForSchool(school.id)
      results.push({ schoolId: school.id, schoolName: school.name, ...r })
      await writeAudit({
        schoolId:   school.id,
        actorId:    'cron',
        action:     'YEAR_ROLLOVER',
        targetType: 'school',
        targetId:   school.id,
        metadata:   r,
      })
    } catch (err) {
      errors.push(`${school.name}: ${String(err)}`)
    }
  }

  return NextResponse.json({ ok: true, results, errors })
}

// Export helper so the manual-trigger route can reuse it
export { runRolloverForSchool }
