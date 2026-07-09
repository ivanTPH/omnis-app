/**
 * GET /api/cron/platform-insights
 *
 * Runs the cross-school anonymised insight pipeline.
 * Triggered by Vercel Cron: Sundays at 05:00 UTC  (schedule: "0 5 * * 0")
 *
 * Reads all SchoolCohortAggregate rows (computed nightly by early-warning
 * cron), aggregates them cross-school with k-anonymity (MIN_SCHOOLS >= 3),
 * and upserts PlatformInsight rows.
 *
 * No Claude calls — pure DB aggregation.
 *
 * SECURITY: When CRON_SECRET is set, Authorization: Bearer <secret> required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { computePlatformInsights } from '@/lib/platform-insight'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const startTime = Date.now()

  try {
    const upsertCount = await computePlatformInsights()
    const durationMs  = Date.now() - startTime
    console.log(`[platform-insights cron] Complete — ${upsertCount} insight rows upserted in ${durationMs}ms`)
    return NextResponse.json({ success: true, upsertCount, durationMs })
  } catch (err) {
    const durationMs = Date.now() - startTime
    console.error('[platform-insights cron] FATAL:', err)
    return NextResponse.json({ success: false, error: String(err), durationMs }, { status: 500 })
  }
}
