/**
 * GET /api/cron/agent-coach
 *
 * Runs the Coach agent for all active schools — processes only students
 * whose snapshot is dirty (new submissions/revision since last run) or
 * overdue for their weekly warm refresh.
 *
 * Schedule: nightly at 02:30 UTC (after early-warning at 02:00).
 *
 * SECURITY:
 *  - Requires Authorization: Bearer <CRON_SECRET>. An unset CRON_SECRET denies all
 *    requests (matching agent-quality/agent-plan-synthesis/agent-engage) rather than
 *    falling open -- a misconfigured/missing env var must never leave this endpoint
 *    publicly callable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import { runCoachBatchForSchool }    from '@/lib/agents/coach'
import { reportBatchItemFailure, reportSystemicFailure, reportFatalError } from '@/lib/monitoring'
import { runBounded } from '@/lib/batch'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const schools = await prisma.school.findMany({ select: { id: true, name: true } })

    const results: Array<{
      schoolId:  string
      name:      string
      processed: number
      skipped:   number
      errors:    number
      totalGaps: number
    }> = []

    let grandProcessed = 0, grandErrors = 0, grandGaps = 0

    // Schools run with bounded concurrency (3 at a time) rather than one at a
    // time -- sequential processing risked exceeding the 300s cap once the
    // school count grew, silently leaving schools later in the list without a
    // run that night. Concurrency is kept low (not unbounded) since each
    // school's batch already does its own internal concurrent DB + Anthropic
    // calls -- see docs/audit/2026-08-28-performance-efficiency-sweep.md.
    await runBounded(schools, async (school) => {
      try {
        const r = await runCoachBatchForSchool(school.id)
        results.push({ schoolId: school.id, name: school.name, ...r })
        grandProcessed += r.processed
        grandErrors    += r.errors
        grandGaps      += r.totalGaps
      } catch (err) {
        reportBatchItemFailure('agent-coach', school.id, err, { schoolName: school.name })
        results.push({ schoolId: school.id, name: school.name, processed: 0, skipped: 0, errors: 1, totalGaps: 0 })
        grandErrors++
      }
    }, 3)

    const durationMs = Date.now() - startTime
    console.log(
      `[agent-coach cron] Complete — ${grandProcessed} students processed, ` +
      `${grandGaps} gaps found, ${grandErrors} errors across ${schools.length} schools in ${durationMs}ms`
    )

    // Nothing succeeded but errors were recorded (e.g. every call failed the same way --
    // a revoked ANTHROPIC_API_KEY is the classic case) -- that's a systemic failure, not a
    // few bad students. Return non-2xx so the GitHub Actions cron's `curl -sf` fails loudly
    // instead of a 200 with the failure buried in the JSON body that nothing ever reads.
    const systemicFailure = grandProcessed === 0 && grandErrors > 0
    if (systemicFailure) {
      reportSystemicFailure('agent-coach', `all ${schools.length} schools failed, 0 processed`, { grandErrors, schoolCount: schools.length })
    }
    return NextResponse.json({
      success: !systemicFailure,
      grandProcessed,
      grandErrors,
      grandGaps,
      schools: results,
      durationMs,
    }, { status: systemicFailure ? 502 : 200 })
  } catch (err) {
    const durationMs = Date.now() - startTime
    reportFatalError('agent-coach', err, { durationMs })
    return NextResponse.json(
      { success: false, error: String(err), durationMs },
      { status: 500 },
    )
  }
}
