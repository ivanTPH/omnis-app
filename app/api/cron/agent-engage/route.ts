/**
 * GET /api/cron/agent-engage
 *
 * Runs the ENGAGE agent for all active schools.
 * Reads COACH snapshots to find students with weak topics, then generates
 * engagement-optimised homework packages using Oak curriculum data.
 *
 * Schedule: nightly at 04:00 UTC (after PLAN_SYNTHESIS at 03:30).
 *
 * Cost: haiku-only, module-level Oak cache, inference cache (7-day TTL).
 * Estimated Claude cost per run: ~$0.002 across all schools (cache hits reduce to ~$0.0005).
 *
 * SECURITY:
 *  - Requires Authorization: Bearer <CRON_SECRET> when env var is set.
 *  - In dev (no CRON_SECRET): unauthenticated requests are allowed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import { runEngageBatchForSchool }   from '@/lib/agents/engage'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  try {
    const schools = await prisma.school.findMany({ select: { id: true, name: true } })

    const results: Array<{
      schoolId:       string
      name:           string
      processed:      number
      skipped:        number
      errors:         number
      totalPackages:  number
      cacheHits:      number
    }> = []

    let grandProcessed = 0, grandErrors = 0, grandPackages = 0, grandCacheHits = 0

    for (const school of schools) {
      try {
        const r = await runEngageBatchForSchool(school.id)
        results.push({ schoolId: school.id, name: school.name, ...r })
        grandProcessed  += r.processed
        grandErrors     += r.errors
        grandPackages   += r.totalPackages
        grandCacheHits  += r.cacheHits
      } catch (err) {
        console.error(`[agent-engage cron] Error for school ${school.id}:`, err)
        results.push({ schoolId: school.id, name: school.name, processed: 0, skipped: 0, errors: 1, totalPackages: 0, cacheHits: 0 })
        grandErrors++
      }
    }

    const durationMs = Date.now() - startTime
    console.log(
      `[agent-engage cron] Complete — ${grandProcessed} students processed, ` +
      `${grandPackages} packages generated, ${grandCacheHits} cache hits, ` +
      `${grandErrors} errors across ${schools.length} schools in ${durationMs}ms`
    )

    return NextResponse.json({
      success: true,
      grandProcessed,
      grandErrors,
      grandPackages,
      grandCacheHits,
      schools: results,
      durationMs,
    })
  } catch (err) {
    const durationMs = Date.now() - startTime
    console.error('[agent-engage cron] FATAL:', err)
    return NextResponse.json(
      { success: false, error: String(err), durationMs },
      { status: 500 },
    )
  }
}
