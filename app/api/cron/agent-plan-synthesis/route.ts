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

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret     = process.env.CRON_SECRET

  if (secret && authHeader !== `Bearer ${secret}`) {
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

  for (const school of schools) {
    try {
      const result = await runPlanSynthesisBatchForSchool(school.id)
      grandProcessed += result.processed
      grandErrors    += result.errors
      grandUrgent    += result.urgent
      schoolResults.push({ schoolId: school.id, name: school.name, ...result })
    } catch (err) {
      grandErrors++
      console.error(`[agent-plan-synthesis] School ${school.id} failed:`, err)
      schoolResults.push({
        schoolId: school.id, name: school.name,
        processed: 0, skipped: 0, errors: 1, urgent: 0,
      })
    }
  }

  return NextResponse.json({
    ok:             true,
    grandProcessed,
    grandErrors,
    grandUrgent,
    schools:        schoolResults,
    durationMs:     Date.now() - started,
  })
}
