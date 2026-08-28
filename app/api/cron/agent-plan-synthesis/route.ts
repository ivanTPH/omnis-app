/**
 * GET /api/cron/agent-plan-synthesis
 *
 * Nightly cron — runs the Plan Synthesis agent for all schools.
 * Scheduled at 03:30 UTC daily (after Quality agent at 03:00).
 *
 * Only processes students with an active SEND status or existing ILP,
 * so the runtime and cost scale with the SEND caseload, not total enrolment.
 */

import { NextRequest, NextResponse }       from 'next/server'
import { prisma }                           from '@/lib/prisma'
import { runPlanSynthesisBatchForSchool }   from '@/lib/agents/plan-synthesis'
import { reportBatchItemFailure, reportSystemicFailure }   from '@/lib/monitoring'
import { runBounded }                                       from '@/lib/batch'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret     = process.env.CRON_SECRET

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const started = Date.now()

  const schools = await prisma.school.findMany({
    where:  { isActive: true },
    select: { id: true, name: true },
  })

  let grandProcessed = 0
  let grandErrors    = 0
  let grandUrgent    = 0
  const schoolResults: Array<{
    schoolId:  string
    name:      string
    processed: number
    skipped:   number
    errors:    number
    urgent:    number
  }> = []

  // Bounded concurrency (3 schools at a time) -- see agent-coach's identical
  // comment; sequential per-school processing risked exceeding the 300s cap.
  await runBounded(schools, async (school) => {
    try {
      const result = await runPlanSynthesisBatchForSchool(school.id)
      grandProcessed += result.processed
      grandErrors    += result.errors
      grandUrgent    += result.urgent
      schoolResults.push({ schoolId: school.id, name: school.name, ...result })
    } catch (err) {
      grandErrors++
      reportBatchItemFailure('agent-plan-synthesis', school.id, err, { schoolName: school.name })
      schoolResults.push({
        schoolId: school.id, name: school.name,
        processed: 0, skipped: 0, errors: 1, urgent: 0,
      })
    }
  }, 3)

  // See app/api/cron/agent-coach/route.ts's identical guard: nothing succeeded but
  // errors were recorded means a systemic failure (e.g. a revoked API key), not a few
  // bad students -- return non-2xx so the cron's `curl -sf` actually fails instead of a
  // silently-buried 200.
  const systemicFailure = grandProcessed === 0 && grandErrors > 0
  if (systemicFailure) {
    reportSystemicFailure('agent-plan-synthesis', `all ${schools.length} schools failed, 0 processed`, { grandErrors, schoolCount: schools.length })
  }
  return NextResponse.json({
    ok:             !systemicFailure,
    grandProcessed,
    grandErrors,
    grandUrgent,
    schools:        schoolResults,
    durationMs:     Date.now() - started,
  }, { status: systemicFailure ? 502 : 200 })
}
