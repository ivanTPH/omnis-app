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
import { computeAndSaveAdaptiveProfile } from '@/lib/adaptive-profile'
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

    // Refresh adaptive learning profiles for all students across all schools.
    // Runs after flag analysis so profile data is fresh for SENCO dashboards.
    // Processes in batches of 5 with a 500ms pause to avoid DB connection spikes.
    let totalProfiles = 0
    for (const school of schools) {
      try {
        const students = await prisma.user.findMany({
          where:  { schoolId: school.id, role: 'STUDENT', isActive: true },
          select: { id: true },
        })
        const BATCH = 5
        for (let i = 0; i < students.length; i += BATCH) {
          const batch = students.slice(i, i + BATCH)
          await Promise.allSettled(
            batch.map(s => computeAndSaveAdaptiveProfile(s.id, school.id))
          )
          totalProfiles += batch.length
          if (i + BATCH < students.length) {
            await new Promise(r => setTimeout(r, 500))
          }
        }
      } catch (err) {
        console.error(`[early-warning cron] Profile refresh error for school ${school.id}:`, err)
      }
    }

    const durationMs = Date.now() - startTime
    console.log(`[early-warning cron] Complete — ${totalFlags} new flags, ${totalProfiles} profiles refreshed across ${schools.length} schools in ${durationMs}ms`)

    return NextResponse.json({ success: true, totalFlags, totalProfiles, schools: results, durationMs })
  } catch (err) {
    const durationMs = Date.now() - startTime
    console.error('[early-warning cron] FATAL:', err)
    return NextResponse.json(
      { success: false, error: String(err), durationMs },
      { status: 500 },
    )
  }
}
