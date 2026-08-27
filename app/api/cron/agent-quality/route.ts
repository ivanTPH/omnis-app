/**
 * GET /api/cron/agent-quality
 *
 * Nightly cron — runs the Quality agent for all schools.
 * Scheduled at 03:00 UTC daily (after the Coach agent at 02:30).
 *
 * Secured by CRON_SECRET bearer token (checked by Vercel automatically
 * when invoked via vercel.json cron, and manually below for non-Vercel callers).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import { runQualityBatchForSchool }  from '@/lib/agents/quality'

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret     = process.env.CRON_SECRET

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const started = Date.now()

  // Fetch all active schools
  const schools = await prisma.school.findMany({
    where:  { isActive: true },
    select: { id: true, name: true },
  })

  let grandProcessed = 0
  let grandErrors    = 0
  let grandIssues    = 0
  const schoolResults: Array<{
    schoolId: string
    name:     string
    processed: number
    skipped:   number
    errors:    number
    totalIssues: number
  }> = []

  for (const school of schools) {
    try {
      const result = await runQualityBatchForSchool(school.id)
      grandProcessed += result.processed
      grandErrors    += result.errors
      grandIssues    += result.totalIssues
      schoolResults.push({ schoolId: school.id, name: school.name, ...result })
    } catch (err) {
      grandErrors++
      console.error(`[agent-quality] School ${school.id} failed:`, err)
      schoolResults.push({
        schoolId:    school.id,
        name:        school.name,
        processed:   0,
        skipped:     0,
        errors:      1,
        totalIssues: 0,
      })
    }
  }

  // See app/api/cron/agent-coach/route.ts's identical guard: nothing succeeded but
  // errors were recorded means a systemic failure (e.g. a revoked API key), not a few
  // bad students -- return non-2xx so the cron's `curl -sf` actually fails instead of a
  // silently-buried 200.
  const systemicFailure = grandProcessed === 0 && grandErrors > 0
  return NextResponse.json({
    ok:             !systemicFailure,
    grandProcessed,
    grandErrors,
    grandIssues,
    schools:        schoolResults,
    durationMs:     Date.now() - started,
  }, { status: systemicFailure ? 502 : 200 })
}
