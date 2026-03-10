/**
 * GET /api/cron/early-warning
 *
 * Runs the early warning analysis engine for all active schools.
 * Triggered by Vercel Cron at 6am Mon–Fri (schedule: "0 6 * * 1-5").
 *
 * SECURITY:
 * - When CRON_SECRET is set: request must include Authorization: Bearer <secret>
 * - When CRON_SECRET is unset (dev only): unauthenticated requests are allowed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { analyseStudentPatterns } from '@/lib/send/early-warning'
import { prisma } from '@/lib/prisma'

export const maxDuration = 300

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
    // Get all active schools
    const schools = await prisma.school.findMany({
      select: { id: true, name: true },
    })

    let totalFlags = 0
    const results: { schoolId: string; name: string; newFlags: number }[] = []

    for (const school of schools) {
      try {
        const newFlags = await analyseStudentPatterns(school.id)
        totalFlags += newFlags
        results.push({ schoolId: school.id, name: school.name, newFlags })
      } catch (err) {
        console.error(`[early-warning cron] Error for school ${school.id}:`, err)
        results.push({ schoolId: school.id, name: school.name, newFlags: -1 })
      }
    }

    const durationMs = Date.now() - startTime
    console.log(`[early-warning cron] Complete — ${totalFlags} new flags across ${schools.length} schools in ${durationMs}ms`)

    return NextResponse.json({ success: true, totalFlags, schools: results, durationMs })
  } catch (err) {
    const durationMs = Date.now() - startTime
    console.error('[early-warning cron] FATAL:', err)
    return NextResponse.json(
      { success: false, error: String(err), durationMs },
      { status: 500 },
    )
  }
}
