/**
 * GET /api/cron/oak-sync
 *
 * Weekly Oak content sync — Sunday 02:00 UTC (crons.yml).
 * Also callable manually from the Platform Admin dashboard.
 *
 * Strategy:
 *   When OAK_API_KEY is set → runBulkSync (official Oak bulk download API, ~17 calls)
 *   When OAK_API_KEY is absent → runDeltaSync (web-scraping fallback, ~11,000 calls)
 *
 * All data is persisted in Supabase (OakSubject / OakUnit / OakLesson tables).
 * The 'oak-lessons' cache tag is busted after every sync so searchOakLessons()
 * serves fresh data on the next request.
 *
 * SECURITY:
 * - When CRON_SECRET is set: request must include Authorization: Bearer <secret>
 * - When CRON_SECRET is unset (dev only): unauthenticated requests are allowed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runDeltaSync }              from '@/lib/oak-delta-sync'
import { runBulkSync }               from '@/lib/oak-bulk-sync'
import { revalidateTag }             from 'next/cache'

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
    const useBulk = !!process.env.OAK_API_KEY
    console.log(`[oak-sync] Using ${useBulk ? 'bulk API sync' : 'delta scrape sync'}`)

    const { counts, durationMs } = useBulk
      ? await runBulkSync()
      : await runDeltaSync()

    revalidateTag('oak-lessons', 'default')  // Bust cached searchOakLessons results after sync
    return NextResponse.json({ success: true, syncType: useBulk ? 'bulk' : 'delta', counts, durationMs })
  } catch (err) {
    const durationMs = Date.now() - startTime
    console.error('[oak-sync cron] FATAL:', err)
    return NextResponse.json(
      { success: false, error: String(err), durationMs },
      { status: 500 },
    )
  }
}
