/**
 * GET /api/cron/retention-review — weekly (Monday 06:30 UTC, crons-weekly.yml)
 *
 * For each school, finds pupils whose records have passed the school's
 * retention schedule (lib/retention.ts) and tells the school's admins, so the
 * school (as data controller) can decide and action deletion through the
 * GDPR page. It never deletes anything itself: deleting statutory records is
 * the controller's decision.
 *
 * SECURITY: requires Authorization: Bearer <CRON_SECRET>.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSchoolRetention, retentionEnds } from '@/lib/retention'
import { reportBatchItemFailure, reportFatalError } from '@/lib/monitoring'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const schools = await prisma.school.findMany({ select: { id: true, name: true } })
    const results: { schoolId: string; pupilsDue: number }[] = []

    for (const school of schools) {
      try {
        const r = await getSchoolRetention(school.id)
        // The shortest period decides the earliest review point.
        const shortest = Math.min(r.sendYears, r.pupilRecordYears, r.safeguardingYears)
        const cutoff = new Date(now)
        cutoff.setFullYear(cutoff.getFullYear() - shortest)

        const candidates = await prisma.user.findMany({
          where: { schoolId: school.id, role: 'STUDENT', dateOfBirth: { not: null, lte: cutoff } },
          select: { id: true, dateOfBirth: true },
        })

        let due = 0
        for (const c of candidates) {
          const where = { schoolId: school.id, studentId: c.id }
          const sendEnd = retentionEnds(c.dateOfBirth, r.sendYears)
          const pupilEnd = retentionEnds(c.dateOfBirth, r.pupilRecordYears)
          const sgEnd = retentionEnds(c.dateOfBirth, r.safeguardingYears)
          const [send, pupil, sg] = await Promise.all([
            sendEnd && sendEnd <= now ? prisma.individualLearningPlan.count({ where }) : 0,
            pupilEnd && pupilEnd <= now ? prisma.behaviourRecord.count({ where }) : 0,
            sgEnd && sgEnd <= now ? prisma.safeguardingRecord.count({ where }) : 0,
          ])
          if (send + pupil + sg > 0) due++
        }

        if (due > 0) {
          const admins = await prisma.user.findMany({
            where: { schoolId: school.id, role: 'SCHOOL_ADMIN', isActive: true },
            select: { id: true },
          })
          await prisma.notification.createMany({
            data: admins.map(a => ({
              schoolId: school.id,
              userId: a.id,
              type: 'GENERAL',
              title: 'Records past your retention schedule',
              body: `${due} former pupil${due === 1 ? ' has' : 's have'} records older than your school's retention schedule. Review them on the GDPR page and raise an erasure request if they should be deleted.`,
              linkHref: '/admin/gdpr',
            })),
          })
        }
        results.push({ schoolId: school.id, pupilsDue: due })
      } catch (err) {
        reportBatchItemFailure('retention-review', school.id, err, { schoolName: school.name })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    reportFatalError('retention-review', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
