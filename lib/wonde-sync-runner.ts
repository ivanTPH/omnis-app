/**
 * Shared, logged entry point for a Wonde MIS sync.
 *
 * Used by the admin "Run Sync" button (app/api/wonde/sync), the server action
 * (app/actions/wonde.ts triggerWondeSync) and the nightly cron
 * (app/api/cron/wonde-sync), so all three create the same WondeSyncLog rows.
 *
 * Tenant safety: the Wonde credentials in env (WONDE_API_TOKEN /
 * WONDE_SCHOOL_ID) belong to ONE Omnis school — the one whose WondeSchool row
 * has id === WONDE_SCHOOL_ID. Previously the manual sync imported that Wonde
 * school's data into whichever school the calling admin belonged to, so an
 * admin at a different school could pull another school's pupils into their
 * own tenant. resolveWondeTarget() now refuses unless the caller's school is
 * the linked one.
 */
import { prisma } from '@/lib/prisma'
import { runWondeSync, type WondeSyncResult } from '@/lib/wonde-sync'

export type WondeTarget =
  | { ok: true; omnisSchoolId: string; wondeSchoolId: string; token: string }
  | { ok: false; error: string }

/** Find the Omnis school linked to the configured Wonde school. */
export async function resolveWondeTarget(callerSchoolId?: string): Promise<WondeTarget> {
  const token         = process.env.WONDE_API_TOKEN
  const wondeSchoolId = process.env.WONDE_SCHOOL_ID
  if (!token || !wondeSchoolId) return { ok: false, error: 'Wonde credentials not configured' }

  const link = await prisma.wondeSchool.findUnique({
    where:  { id: wondeSchoolId },
    select: { schoolId: true },
  })

  // First-ever sync: no WondeSchool row yet, so the caller's own school is the
  // only candidate (runWondeSync creates the link).
  if (!link) {
    if (!callerSchoolId) return { ok: false, error: `No Omnis school is linked to Wonde school ${wondeSchoolId} yet — run the first sync from the admin panel` }
    return { ok: true, omnisSchoolId: callerSchoolId, wondeSchoolId, token }
  }

  if (callerSchoolId && callerSchoolId !== link.schoolId) {
    return { ok: false, error: 'This school is not linked to the configured Wonde school' }
  }
  return { ok: true, omnisSchoolId: link.schoolId, wondeSchoolId, token }
}

export function totalRecords(r: WondeSyncResult): number {
  return r.employees.upserted + r.students.upserted + r.contacts.upserted +
    r.groups.upserted + r.classes.upserted + r.enrolments.upserted +
    r.periods.upserted + r.timetable.upserted
}

/** Run a sync and record it in WondeSyncLog. Never throws. */
export async function runLoggedWondeSync(
  target: Extract<WondeTarget, { ok: true }>,
  syncType: 'full' | 'scheduled' = 'full',
): Promise<{ success: boolean; result?: WondeSyncResult; logId: string; error?: string }> {
  const { omnisSchoolId, wondeSchoolId, token } = target

  // Mark any stale "running" logs as failed before starting a new run
  await prisma.wondeSyncLog.updateMany({
    where: { schoolId: omnisSchoolId, status: 'running' },
    data:  { status: 'failed', errors: ['Superseded by a new sync run'], completedAt: new Date() },
  })

  const log = await prisma.wondeSyncLog.create({
    data: { schoolId: omnisSchoolId, syncType, status: 'running', startedAt: new Date() },
  })

  try {
    const result = await runWondeSync(omnisSchoolId, wondeSchoolId, token)
    await prisma.wondeSyncLog.update({
      where: { id: log.id },
      data: {
        status:           result.errors.length > 0 ? 'partial' : 'success',
        recordsProcessed: totalRecords(result),
        errors:           result.errors,
        summary: {
          counts: {
            students: result.students.upserted, employees: result.employees.upserted,
            classes: result.classes.upserted, contacts: result.contacts.upserted,
          },
          provisioned: result.provisioned,
          omnis: result.omnis ?? null,
        },
        completedAt:      new Date(),
      },
    })
    return { success: result.errors.length === 0, result, logId: log.id }
  } catch (err) {
    await prisma.wondeSyncLog.update({
      where: { id: log.id },
      data:  { status: 'failed', errors: [String(err)], completedAt: new Date() },
    })
    return { success: false, error: String(err), logId: log.id }
  }
}
