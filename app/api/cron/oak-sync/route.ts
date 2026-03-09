/**
 * GET /api/cron/oak-sync
 *
 * Weekly delta sync triggered by Vercel Cron (schedule: "0 2 * * 0" — Sunday 2am).
 * Vercel automatically passes Authorization: Bearer $CRON_SECRET when that env var
 * is set in the Vercel dashboard.
 *
 * Also callable manually from the Platform Admin dashboard via triggerDeltaSync().
 *
 * SECURITY:
 * - When CRON_SECRET is set: request must include Authorization: Bearer <secret>
 * - When CRON_SECRET is unset (dev only): unauthenticated requests are allowed.
 *   Always set CRON_SECRET in production (Vercel environment variables).
 * - Rate limiting: Vercel Cron runs at most once per configured schedule.
 *   Additional rate limiting is not required for cron routes in Vercel.
 *
 * NOTE: maxDuration = 300 requires Vercel Pro plan. Remove/lower for free plan.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runDeltaSync }              from '@/lib/oak-delta-sync'

// 5-minute timeout — requires Vercel Pro. Adjust or remove for free plan.
export const maxDuration = 300

export async function GET(request: NextRequest) {
  // ── Auth check ──────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const startTime = Date.now()

  try {
    const { counts, durationMs } = await runDeltaSync()
    return NextResponse.json({ success: true, counts, durationMs })
  } catch (err) {
    const durationMs = Date.now() - startTime
    console.error('[oak-sync cron] FATAL:', err)
    return NextResponse.json(
      { success: false, error: String(err), durationMs },
      { status: 500 },
    )
  }
}
