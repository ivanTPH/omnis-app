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
 *  - Requires Authorization: Bearer <CRON_SECRET> when env var is set.
 *  - In dev (no CRON_SECRET): unauthenticated requests are allowed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import { runCoachBatchForSchool }    from '@/lib/agents/coach'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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

    for (const school of schools) {
      try {
        const r = await runCoachBatchForSchool(school.id)
        results.push({ schoolId: school.id, name: school.name, ...r })
        grandProcessed += r.processed
        grandErrors    += r.errors
        grandGaps      += r.totalGaps
      } catch (err) {
        console.error(`[agent-coach cron] Error for school ${school.id}:`, err)
        results.push({ schoolId: school.id, name: school.name, processed: 0, skipped: 0, errors: 1, totalGaps: 0 })
        grandErrors++
      }
    }

    const durationMs = Date.now() - startTime
    console.log(
      `[agent-coach cron] Complete — ${grandProcessed} students processed, ` +
      `${grandGaps} gaps found, ${grandErrors} errors across ${schools.length} schools in ${durationMs}ms`
    )

    return NextResponse.json({
      success: true,
      grandProcessed,
      grandErrors,
      grandGaps,
      schools: results,
      durationMs,
    })
  } catch (err) {
    const durationMs = Date.now() - startTime
    console.error('[agent-coach cron] FATAL:', err)
    return NextResponse.json(
      { success: false, error: String(err), durationMs },
      { status: 500 },
    )
  }
}
