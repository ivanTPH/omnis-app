/**
 * GET /api/cron/wonde-sync
 *
 * Nightly Wonde MIS sync (staff, pupils, contacts, classes, timetable) for the
 * Omnis school linked to WONDE_SCHOOL_ID. Scheduled from
 * .github/workflows/crons-agents.yml at 01:15 UTC.
 *
 * A full sync can take several minutes, longer than the GitHub Actions curl
 * timeout, so the route answers 202 immediately and runs the sync after the
 * response (next/server `after()`, which the self-hosted Node server on
 * Coolify supports). The outcome is recorded in WondeSyncLog (visible on
 * /admin/wonde), and any failure is reported to Sentry.
 *
 * SECURITY: requires Authorization: Bearer <CRON_SECRET>; an unset
 * CRON_SECRET denies all requests.
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { resolveWondeTarget, runLoggedWondeSync } from '@/lib/wonde-sync-runner'
import { reportFatalError, reportSystemicFailure } from '@/lib/monitoring'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const target = await resolveWondeTarget()
  if (!target.ok) {
    // Not configured is not an outage — say so, but don't fail the workflow.
    return NextResponse.json({ skipped: true, reason: target.error }, { status: 200 })
  }

  after(async () => {
    try {
      const run = await runLoggedWondeSync(target, 'scheduled')
      if (run.error) {
        reportSystemicFailure('wonde-sync', `sync failed: ${run.error}`, { logId: run.logId })
      } else if (!run.success) {
        reportSystemicFailure('wonde-sync', `sync finished with ${run.result?.errors.length ?? 0} errors`, {
          logId: run.logId, errors: run.result?.errors.slice(0, 20),
        })
      }
      revalidatePath('/admin/wonde')
      revalidateTag('class-rosters', 'default')
    } catch (err) {
      reportFatalError('wonde-sync', err)
    }
  })

  return NextResponse.json({ accepted: true, schoolId: target.omnisSchoolId }, { status: 202 })
}
